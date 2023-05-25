import FormData from 'form-data'
import { getCosmWasmClient } from './chain'
import { NFT } from './types'
import { MatchmakingItemExport } from './types/wager'
import axios from 'axios'

export async function fireMatchmakingHook({
  token_id,
  name,
}: {
  expires_at: string
  name: string
} & NFT) {
  const client = await getCosmWasmClient(process.env.RPC!)

  // Get wager info
  const { matchmaking: token_status }: { matchmaking: MatchmakingItemExport } = await client.queryContractSmart(
    process.env.WAGER_CONTRACT!,
    {
      token_status: { token: token_id },
    },
  )

  const webhookContent = {
    content: null,
    embeds: [
      {
        title: 'I am seeking an opponent!',
        color: 4276735,
        fields: [
          {
            name: "Wizard's token",
            value: `$${token_status.currency.toUpperCase()}`,
          },
          {
            name: 'Versus',
            value: token_status.against_currencies.map((currency) => `$${currency.toUpperCase()}`).join(' '),
            inline: true,
          },
          {
            name: '💰',
            value: `${parseInt(token_status.amount) / 1_000_000} $STARS`,
            inline: true,
          },
          {
            name: '⏰',
            value: `${token_status.expiry / 60} minutes`,
            inline: true,
          },
        ],
        author: {
          name: 'CLICK HERE TO MATCHMAKE 🪄',
          url: `https://duel.pixelwizards.art/wager?currency=${token_status.currency}&amount=${token_status.amount}&expiry=${token_status.expiry}&wizard_currency=${token_status.against_currencies[0]}`,
        },
        footer: {
          text: 'I dare you  🫵',
        },
        timestamp: new Date().toISOString(),
      },
    ],
    username: name,
    avatar_url: `https://ipfs.io/ipfs/bafybeiawdykynb2757er3jikvi5yrpmbqrltsulhsli5mij3nfdmhxoity/png256_assets/${token_id}.png`,
    attachments: [],
  }

  const formData = new FormData()
  formData.append('payload_json', JSON.stringify(webhookContent))

  axios.post(process.env.WEBHOOK_URL!, formData)
}
