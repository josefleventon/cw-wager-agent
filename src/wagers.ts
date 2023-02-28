import type { NFT, WagerExport, WagerResponse } from './types'
import type { TokenData } from './types/api'

import { DirectSecp256k1HdWallet } from '@cosmjs/proto-signing'
import { GAS_FEE_CONFIG, getCosmWasmClient, getSigningCosmWasmClient } from './chain'

import { scheduleJob } from 'node-schedule'
import { fetchPriceData } from './api'

interface Price {
  readonly denom: string
  readonly price: number
}

interface Change {
  readonly denom: string
  readonly change: number
}

export interface Job {
  wager: WagerExport
  prices: [Price, Price]
}

export interface JobDetail {
  wager: Job['wager']
  prev_prices: Job['prices']
  current_prices: Job['prices']
  change: [Change, Change]
  current_winner: NFT | null
}

export let jobs = new Set<Job>()

export function activeJobs() {
  return [...jobs]
}

export async function activeJobByToken(token_id: number) {
  const arr = [...jobs].filter(
    (job) => job.wager.wagers[0].token.token_id === token_id || job.wager.wagers[1].token.token_id === token_id,
  )
  if (arr.length < 1) return null
  else {
    const job = arr[0]

    const token_1_price = await fetchPriceData(job.wager.wagers[0].currency)
    const token_2_price = await fetchPriceData(job.wager.wagers[1].currency)

    const token_1_change = token_1_price.price - job.prices[0].price
    const token_2_change = token_2_price.price - job.prices[1].price

    let winner

    if (token_1_change > token_2_change) {
      winner = job.wager.wagers[0].token
    } else if (token_2_change > token_1_change) {
      winner = job.wager.wagers[1].token
    } else {
      winner = null
    }

    return {
      ...job.wager,
      prev_prices: job.prices,
      current_prices: [
        {
          denom: token_1_price.symbol,
          price: token_1_price.price,
        },
        {
          denom: token_2_price.symbol,
          price: token_2_price.price,
        },
      ],
      change: [
        {
          denom: token_1_price.symbol,
          change: token_1_change,
        },
        {
          denom: token_2_price.symbol,
          change: token_2_change,
        },
      ],
      current_winner: winner,
    }
  }
}

export async function queueWagerResolution({
  expires_at,
  collection,
  token_id,
}: {
  expires_at: string
} & NFT) {
  const client = await getCosmWasmClient(process.env.RPC!)

  try {
    // Get wager info
    const { wager }: WagerResponse = await client.queryContractSmart(process.env.WAGER_CONTRACT!, {
      wager: { token: [collection, token_id] },
    })

    // Fetch price data
    const token_1_price = await fetchPriceData(wager.wagers[0].currency)
    const token_2_price = await fetchPriceData(wager.wagers[1].currency)

    // Get date for resolution
    const expiry_date = new Date(parseInt(expires_at) * 1000 + 12_000)
    const date = expiry_date.getTime() < Date.now() ? new Date(Date.now() + 1_000) : expiry_date

    console.log(
      `🧮 Wager resolution between #${wager.wagers[0].token.token_id} & #${wager.wagers[1].token.token_id} scheduled for`,
      date.toLocaleTimeString('en-US', { timeZone: 'America/New_York' }),
    )
    console.log(`\t${wager.wagers[0].currency}: $${token_1_price.price}`)
    console.log(`\t${wager.wagers[1].currency}: $${token_2_price.price}`)

    // Add job to queue
    jobs.add({
      wager,
      prices: [
        {
          denom: token_1_price.symbol,
          price: token_1_price.price,
        },
        {
          denom: token_2_price.symbol,
          price: token_2_price.price,
        },
      ],
    })

    // Schedule cron job
    scheduleJob(date, () => resolveWager(wager, [token_1_price, token_2_price]))
  } catch (e) {
    console.error('❌ ERROR: ', (e as Error).message)
  }
}

async function resolveWager(wager: WagerExport, priceInfo: [TokenData, TokenData]) {
  const wallet = await DirectSecp256k1HdWallet.fromMnemonic(process.env.MNEMONIC!, { prefix: 'stars' })
  const [account] = await wallet.getAccounts()

  const client = await getSigningCosmWasmClient(process.env.RPC!, wallet)

  // Fetch price data
  const { price: token_1_price } = await fetchPriceData(wager.wagers[0].currency)
  const { price: token_2_price } = await fetchPriceData(wager.wagers[1].currency)

  console.log(`✅ Wager resolved between #${wager.wagers[0].token.token_id} & #${wager.wagers[1].token.token_id}`)
  console.log(`\t${wager.wagers[0].currency}: $${token_1_price}`)
  console.log(`\t${wager.wagers[1].currency}: $${token_2_price}`)

  // Set the winner
  // The contract will determine the winner based on price data
  await client
    .execute(
      account.address,
      process.env.WAGER_CONTRACT!,
      {
        set_winner: {
          wager_key: [
            [wager.wagers[0].token.collection, wager.wagers[0].token.token_id],
            [wager.wagers[1].token.collection, wager.wagers[1].token.token_id],
          ],
          prev_prices: [priceInfo[0].price.toString(), priceInfo[1].price.toString()],
          current_prices: [token_1_price.toString(), token_2_price.toString()],
        },
      },
      GAS_FEE_CONFIG,
    )
    .then(() => {
      // Remove job from queue
      jobs.delete({
        wager,
        prices: [
          {
            denom: priceInfo[0].symbol,
            price: priceInfo[0].price,
          },
          {
            denom: priceInfo[1].symbol,
            price: priceInfo[1].price,
          },
        ],
      })
    })
}
