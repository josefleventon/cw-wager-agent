import type { NFT, WagerExport, WagerResponse } from './types'
import type { TokenData } from './types/api'

import { DirectSecp256k1HdWallet } from '@cosmjs/proto-signing'
import { fromBech32, toBech32 } from '@cosmjs/encoding'
import { GAS_FEE_CONFIG, getCosmWasmClient, getSigningCosmWasmClient } from './chain'

import { scheduleJob } from 'node-schedule'
import { fetchPriceData } from './api'

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
  await client.execute(
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
}