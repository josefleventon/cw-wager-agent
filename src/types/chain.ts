export interface Edge {
  node: {
    id: string
    contractAddr: string
    createdAt: string
    data: {
      collection: string
      tokenId: string
      expiresAt: string
    }
  }
}
