// 진화 연출의 순서. k = 연출이 시작된 뒤 지난 tick 수(1 tick = 걷기 한 칸).
//   알아챔(4) → 깜빡임(11, 점점 빨라짐) → 축하(5)

const NOTICE_TICKS = 4
/** 1 = 진화 후 모습. 뒤로 갈수록 자주 바뀐다. */
const FLICKER = [0, 0, 0, 1, 0, 0, 1, 0, 1, 0, 1]
const DONE_TICKS = 5

export const EVO_TICKS = NOTICE_TICKS + FLICKER.length + DONE_TICKS

export type EvoFrame = {
  /** 진화 후 모습을 그릴지 */
  showsTo: boolean
  /** 흰빛으로 그릴지 (깜빡이는 동안) */
  isGlowing: boolean
  /** 반짝이를 붙일지 (축하) */
  hasSparkles: boolean
  text: string
}

/** k 번째 tick 에 그릴 모습. 연출이 끝났으면 undefined. */
export const evoFrame = (k: number, fromName: string, toName: string): EvoFrame | undefined => {
  if (k < 0 || k >= EVO_TICKS) return undefined
  if (k < NOTICE_TICKS) {
    return { showsTo: false, isGlowing: false, hasSparkles: false, text: `…어라? ${fromName}의 모습이…!` }
  }
  const f = k - NOTICE_TICKS
  if (f < FLICKER.length) {
    return { showsTo: FLICKER[f] === 1, isGlowing: true, hasSparkles: false, text: `${fromName}이(가) 진화하고 있다…` }
  }
  return {
    showsTo: true,
    isGlowing: false,
    hasSparkles: true,
    text: `축하합니다! ${fromName}은(는) ${toName}(으)로 진화했다!`,
  }
}

/** 몸 줄 양옆에 반짝이. 줄 수는 그대로(입력칸 위 높이가 흔들리지 않게), k 로 자리가 번갈아 바뀐다. */
export const sparkle = (rows: string[], k: number): string[] =>
  rows.map((row, i) => {
    const on = (i + k) % 2 === 0
    return `${on ? '*' : '.'} ${row} ${on ? '.' : '*'}`
  })
