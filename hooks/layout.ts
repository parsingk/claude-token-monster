// 가방 화면에서 몬스터 목록만 따로 스크롤시키기 위한 줄 수 계산.
// 화면 전체가 가방 높이 안에 들어가도록, 목록에 줄 수 있는 줄 수를 센다.
// 터미널 기준이고, 그래픽 surface(desktop 등)에서는 근사값이다.

const isWide = (code: number): boolean =>
  (code >= 0x1100 && code <= 0x115f) ||
  (code >= 0x2e80 && code <= 0xa4cf) ||
  (code >= 0xac00 && code <= 0xd7a3) ||
  (code >= 0xf900 && code <= 0xfaff) ||
  (code >= 0xfe30 && code <= 0xfe4f) ||
  (code >= 0xff00 && code <= 0xff60) ||
  (code >= 0xffe0 && code <= 0xffe6)

/** 터미널 칸 수. 한글·한자·전각 문자는 2칸. */
export const cells = (text: string): number => {
  let total = 0
  for (const ch of text) total += isWide(ch.codePointAt(0) ?? 0) ? 2 : 1
  return total
}

/** 터미널에서 Button 은 `[ label ]` 로 그려진다 */
export const buttonCells = (label: string): number => cells(label) + 4

/** 낱말 단위로 줄을 바꿔 그렸을 때의 줄 수 */
export const textRows = (text: string, columns: number): number => {
  const width = Math.max(1, columns)
  let rows = 1
  let used = 0
  for (const word of text.split(' ')) {
    let w = cells(word)
    if (used > 0) {
      if (used + 1 + w <= width) {
        used += 1 + w
        continue
      }
      rows += 1
      used = 0
    }
    // 한 줄보다 긴 낱말은 잘려서 다음 줄로 넘어간다
    while (w > width) {
      rows += 1
      w -= width
    }
    used = w
  }
  return rows
}

/** 가로로 늘어놓다가 넘치면 다음 줄로 넘길 때의 줄 수 (사이 1칸). 하나도 없으면 0. */
export const flowRows = (widths: number[], columns: number): number => {
  let rows = 0
  let used = 0
  for (const w of widths) {
    if (rows > 0 && used + 1 + w <= columns) {
      used += 1 + w
      continue
    }
    rows += 1
    used = w
  }
  return rows
}

export const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value))

/** 목록이 잘릴 때도 최소한 이만큼은 보여 준다 */
export const MIN_SHOWN = 3

/**
 * 목록 창의 크기. room = 목록에 쓸 수 있는 줄 수.
 * 다 들어가면 전부, 아니면 room 마리(적어도 MIN_SHOWN 마리)만 보여 준다.
 */
export const listWindow = (total: number, room: number): { count: number; isCut: boolean } => {
  const count = Math.max(MIN_SHOWN, room)
  return total <= count ? { count: total, isCut: false } : { count, isCut: true }
}

/**
 * 스크롤 한 번에 목록을 몇 마리 옮길지.
 * by = 요청된 줄 수(휠 한 칸 ±1, page 키 = bodyRows, Home·End = 그보다 큼).
 */
export const listStep = (by: number, bodyRows: number, count: number, total: number): number => {
  const size = Math.abs(by)
  if (size > bodyRows) return Math.sign(by) * total
  if (size === bodyRows) return Math.sign(by) * Math.max(1, count - 1)
  return by
}
