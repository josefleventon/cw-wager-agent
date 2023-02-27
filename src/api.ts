import type { TokenData } from './types/api'
import fetch from 'node-fetch'

export async function fetchPriceData(token: string) {
  return fetch(process.env.KNOWLEDGE_API! + '/' + token.toUpperCase()).then((res) => {
    return res.json() as Promise<TokenData>
  })
}
