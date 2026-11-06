export type ItemId = 'egg' | 'fire' | 'water' | 'thunder' | 'leaf' | 'moon' | 'cord' | 'candy'

/** species -1 은 아직 깨지 않은 알 */
export type Mon = {
  uid: number
  species: number
  level: number
  exp: number
  hatchLeft: number
  isStarter: boolean
}

export type Game = {
  coins: number
  /** 코인으로 아직 바뀌지 않은 토큰 */
  coinCarry: number
  /** 경험치로 아직 바뀌지 않은 토큰 */
  expCarry: number
  totalTokens: number
  party: Mon[]
  activeUid: number
  nextUid: number
  items: Partial<Record<ItemId, number>>
  dex: number[]
}

declare module 'claude-code' {
  interface PluginState {
    'token-monster': {
      game: Shaped<Game | null>
      tick: number
      selected: number | null
      message: string
      isHidden: boolean
    }
  }
}
