export type Timestamp = Uint64
export type Uint64 = string
export type Uint128 = string
export type Addr = string

export interface NFT {
  collection: Addr
  token_id: number
}

export interface WagerInfo {
  currency: Currency
  token: NFT
}

export interface WagerExport {
  amount: Uint128
  expires_at: Timestamp
  wagers: [WagerInfo, WagerInfo]
}

export interface WagerResponse {
  wager: WagerExport
}

export type Currency =
  | 'dot'
  | 'avax'
  | 'uni'
  | 'atom'
  | 'link'
  | 'near'
  | 'icp'
  | 'sand'
  | 'btc'
  | 'eth'
  | 'bnb'
  | 'xrp'
  | 'ada'
  | 'doge'
  | 'sol'
  | 'mana'
  | 'cake'
  | 'ar'
  | 'osmo'
  | 'rune'
  | 'luna'
  | 'ustc'
  | 'stars'
  | 'mir'
