import { coins, DirectSecp256k1HdWallet } from '@cosmjs/proto-signing'
import { CosmWasmClient, SigningCosmWasmClient } from '@cosmjs/cosmwasm-stargate'

import gql from 'graphql-tag'
import type { DefaultOptions } from 'apollo-client'
import ApolloClient from 'apollo-client'
import { createHttpLink } from 'apollo-link-http'
import { InMemoryCache } from 'apollo-cache-inmemory'

import type { Edge } from './types/chain'
import { scheduleJob } from 'node-schedule'
import fetch from 'node-fetch'
import { queueWagerResolution } from './wagers'

export async function getCosmWasmClient(rpc: string) {
  if (!rpc) throw new Error('No RPC provided to connect CosmWasmClient.')
  return await CosmWasmClient.connect(rpc)
}

export async function getSigningCosmWasmClient(rpc: string, wallet: DirectSecp256k1HdWallet) {
  if (!rpc) throw new Error('No RPC provided to connect CosmWasmClient.')
  if (!wallet) throw new Error('No wallet provided to connect CosmWasmClient.')
  return await SigningCosmWasmClient.connectWithSigner(rpc, wallet)
}

export const GAS_FEE_CONFIG = {
  amount: coins(0, 'ustars'),
  gas: '666666',
}

const defaultOptions: DefaultOptions = {
  watchQuery: {
    fetchPolicy: 'no-cache',
    errorPolicy: 'ignore',
  },
  query: {
    fetchPolicy: 'no-cache',
    errorPolicy: 'all',
  },
}

export function loopIndexerQuery() {
  const client = new ApolloClient({
    link: createHttpLink({
      uri: process.env.GRAPHQL_API!,
      fetch,
    }),
    cache: new InMemoryCache(),
    defaultOptions,
  })

  console.log('🚀 Apollo client running')

  let prev_edges: Edge[] = []

  scheduleJob('*/6 * * * * *', async () => {
    const {
      data,
    }: {
      data: {
        events: {
          edges: Edge[]
        }
      }
    } = await client.query({
      query: gql`
        query Events {
          events(
            sortBy: BLOCK_HEIGHT_DESC
            contractFilters: [{ contractType: "crates.io:cw-wager", events: [{ name: "wasm", action: "wager" }] }]
          ) {
            edges {
              node {
                id
                data
                contractAddr
                createdAt
              }
            }
          }
        }
      `,
    })

    const edges = data.events.edges.filter(
      ({ node }) =>
        !prev_edges.some(({ node: prev_node }) => prev_node.id === node.id) &&
        node.contractAddr === process.env.WAGER_CONTRACT &&
        new Date(node.createdAt) > new Date(Date.now() - 15000),
    )
    console.log(edges)

    const node_data = edges.map(({ node }) => node.data)

    // Clear previous edges if they exceed 255 items to prevent memory leak
    if (prev_edges.length > 255) prev_edges = []
    prev_edges.push(...data.events.edges)

    node_data.forEach(({ collection, tokenId, expiresAt }) =>
      queueWagerResolution({
        expires_at: expiresAt,
        collection,
        token_id: parseInt(tokenId),
      }),
    )
  })
}
