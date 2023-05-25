import type { Config, NFT, WagerExport, WagerResponse } from './types'
import type { TokenData } from './types/api'

import { DirectSecp256k1HdWallet } from '@cosmjs/proto-signing'
import { GAS_FEE_CONFIG, getCosmWasmClient, getSigningCosmWasmClient } from './chain'

import { scheduleJob } from 'node-schedule'
import { fetchPriceData } from './api'
import axios from 'axios'
import FormData from 'form-data'

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

let jobs = new Map<string, Job>()

export async function activeJobs() {
  const jobList = [...jobs].map((job) => job[1])
  const jobDetailList = jobList.map(async (job) => await activeJobByToken(job.wager.wagers[0].token.token_id))

  const result = await Promise.all(jobDetailList)
  return result
}

export async function activeJobByToken(token_id: number) {
  const arr = [...jobs].filter((job) => job[0].split('-').includes(token_id.toString())).map((job) => job[1])
  if (arr.length < 1) return null
  else {
    const job = arr[0]

    const token_1_price = await fetchPriceData(job.wager.wagers[0].currency)
    const token_2_price = await fetchPriceData(job.wager.wagers[1].currency)

    const token_1_change = token_1_price.price / job.prices[0].price - 1
    const token_2_change = token_2_price.price / job.prices[1].price - 1

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
  token_id,
}: {
  expires_at: string
} & NFT) {
  const client = await getCosmWasmClient(process.env.RPC!)

  try {
    // Get wager info
    const { wager }: WagerResponse = await client.queryContractSmart(process.env.WAGER_CONTRACT!, {
      wager: { token: token_id },
    })

    const existingJob = await activeJobByToken(token_id)
    if (existingJob) return console.log('Job already exists')

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
    jobs.set([wager.wagers[0].token.token_id, wager.wagers[1].token.token_id].join('-'), {
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

  // Delete job from queue
  jobs.delete([wager.wagers[0].token.token_id, wager.wagers[1].token.token_id].join('-'))

  // Set the winner
  // The contract will determine the winner based on price data
  await client.execute(
    account.address,
    process.env.WAGER_CONTRACT!,
    {
      set_winner: {
        wager_key: [wager.wagers[0].token.token_id, wager.wagers[1].token.token_id],
        prev_prices: [priceInfo[0].price.toString(), priceInfo[1].price.toString()],
        current_prices: [token_1_price.toString(), token_2_price.toString()],
      },
    },
    GAS_FEE_CONFIG,
  )

  const { config }: { config: Config } = await client.queryContractSmart(process.env.WAGER_CONTRACT!, {
    config: {},
  })

  const prettyAmount = parseInt(wager.amount) / 1_000_000
  const fairBurnFee = (parseInt(config.fairburn_percent) / 100) * (prettyAmount * 2)
  const configFee = (parseInt(config.fee_percent) / 100) * (prettyAmount * 2)

  const webhookContent = {
    content: null,
    embeds: [
      {
        title: `A duel between #${wager.wagers[0].token.token_id} and #1567 is over`,
        color: 65392,
        fields: [
          {
            name: 'Winner',
            value: 'stars14exvl768pree88sthmp9cp3za7z2cha24m9gs9',
          },
          {
            name: 'Wager',
            value: `${prettyAmount * 2 - (fairBurnFee + configFee)} $STARS`,
            inline: true,
          },
          {
            name: 'Fee',
            value: `${configFee} $STARS`,
            inline: true,
          },
          {
            name: 'Fair Burn',
            value: `${fairBurnFee} $STARS`,
            inline: true,
          },
        ],
        author: {
          name: 'MATCH CONCLUDED  ✅',
        },
      },
    ],
    attachments: [],
  }

  const formData = new FormData()
  formData.append('payload_json', JSON.stringify(webhookContent))

  axios
    .post(process.env.WEBHOOK_URL!, formData)
    .then((_) =>
      console.log(
        `⛓️ Posted result webhook for #${wager.wagers[0].token.token_id} vs #${wager.wagers[1].token.token_id}`,
      ),
    )
}
