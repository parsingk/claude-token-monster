import type { Art } from './types'

export const EGG_NAME = '알'
export const EGG_TILT_NAME = '알-기움'

const palette = { o: '#a8895c', a: '#f6e8c8', b: '#e0cc9f', s: '#d9a066' }

export const ART: Record<string, Art> = {
  [EGG_NAME]: {
    palette,
    rows: [
      '..oooo..',
      '.oaaaao.',
      'oaasaaao',
      'oaaaaaao',
      'oasaaaso',
      'oaaaaaso',
      'obaaaaao',
      'obbaaabo',
      '.obbbbo.',
      '..oooo..',
    ],
  },
  // 위쪽 절반(5줄)을 한 점 오른쪽으로 민 모습
  [EGG_TILT_NAME]: {
    palette,
    rows: [
      '...oooo..',
      '..oaaaao.',
      '.oaasaaao',
      '.oaaaaaao',
      '.oasaaaso',
      'oaaaaaso.',
      'obaaaaao.',
      'obbaaabo.',
      '.obbbbo..',
      '..oooo...',
    ],
  },
}
