import { ART as EGG, EGG_NAME, EGG_TILT_NAME } from './egg'
import { ART as REST } from './rest'
import { ART as STARTERS } from './starters'
import { ART as THREE_A } from './three-a'
import { ART as THREE_B } from './three-b'
import { ART as TWO_A } from './two-a'
import { ART as TWO_B } from './two-b'
import { ART as TWO_C } from './two-c'
import type { Art } from './types'

// 그림 묶음을 모두 합친 것. 열쇠는 몬스터 이름.
export const ARTS: Record<string, Art> = { ...EGG, ...STARTERS, ...THREE_A, ...THREE_B, ...TWO_A, ...TWO_B, ...TWO_C, ...REST }

/** 이름으로 그림을 찾는다. 이름이 없으면 알(4 tick 에 한 번 기운 알). */
export const artOf = (name: string | undefined, frame = 0): Art =>
  ARTS[name ?? (frame % 4 === 0 ? EGG_TILT_NAME : EGG_NAME)] as Art
