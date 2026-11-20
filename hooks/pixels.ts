// 그림 자료를 터미널의 반칸 블록과 Svg 로 바꾼다.
// 둘 다 같은 "점 격자"(줄 수 × 2 줄, 뒤집기·띄우기·칠하기를 적용한 것)에서 출발한다.
import type { Art } from './art/types'

export type Run = { text: string; color?: string; backgroundColor?: string }
export type Pose = {
  /** 왼쪽을 보게 좌우로 뒤집는다 */
  isMirrored?: boolean
  /** 바닥에서 띄우는 점 수. 걷기는 0 과 1 을 번갈아 쓴다. */
  lift?: number
  /** 그릴 터미널 줄 수. 없으면 standRows(art). 그림은 바닥에 맞추고 위를 비운다. */
  rows?: number
  /** 칠한 점을 전부 이 색으로 그린다 (진화 연출의 실루엣) */
  tint?: string
}

/** 그림의 가로 점 수 = 터미널 칸 수 */
export const widthOf = (art: Art): number => Math.max(0, ...art.rows.map(row => row.length))

/** 서 있는 그림의 터미널 줄 수: ceil(세로 점 / 2) */
export const standRows = (art: Art): number => Math.ceil(art.rows.length / 2)

/** 걷는 그림의 터미널 줄 수: ceil((세로 점 + 1) / 2) */
export const walkRows = (art: Art): number => Math.ceil((art.rows.length + 1) / 2)

/** Svg 의 점 하나 크기 (CSS px) */
export const SVG_DOT = 4

type Grid = { cells: (string | undefined)[][]; width: number; rows: number }

/** 점 격자: 줄 수 × 2 줄. 그림은 바닥에서 lift 점 위에 맞추고, 위로 넘치는 점은 버린다. */
const gridOf = (art: Art, pose: Pose = {}): Grid => {
  const rows = pose.rows ?? standRows(art)
  const width = widthOf(art)
  const height = rows * 2
  const top = height - art.rows.length - (pose.lift ?? 0)
  const cells: (string | undefined)[][] = Array.from({ length: height }, () => new Array(width).fill(undefined))
  art.rows.forEach((row, index) => {
    const line = cells[top + index]
    if (!line) return
    const dots = pose.isMirrored ? [...row].reverse() : [...row]
    dots.forEach((dot, x) => {
      const color = dot === '.' ? undefined : art.palette[dot]
      if (color !== undefined) line[x] = pose.tint ?? color
    })
  })
  return { cells, width, rows }
}

/** 터미널 줄마다, 글자·색이 같은 칸을 묶은 조각들 */
export const halfBlocks = (art: Art, pose?: Pose): Run[][] => {
  const { cells, width, rows } = gridOf(art, pose)
  return Array.from({ length: rows }, (_, row) => {
    const runs: Run[] = []
    for (let x = 0; x < width; x++) {
      const upper = cells[row * 2]![x]
      const lower = cells[row * 2 + 1]![x]
      const cell: Run =
        upper !== undefined && lower !== undefined
          ? { text: '▀', color: upper, backgroundColor: lower }
          : upper !== undefined
            ? { text: '▀', color: upper }
            : lower !== undefined
              ? { text: '▄', color: lower }
              : { text: ' ' }
      const last = runs[runs.length - 1]
      if (last && last.color === cell.color && last.backgroundColor === cell.backgroundColor && last.text[0] === cell.text) {
        last.text += cell.text
      } else {
        runs.push(cell)
      }
    }
    return runs
  })
}

/** 같은 색으로 가로로 이어진 점을 사각형 하나로 묶는다. width = 가로 점 × SVG_DOT, height = 줄 수 × 2 × SVG_DOT */
export const svgOf = (art: Art, pose?: Pose): { source: string; width: number; height: number } => {
  const { cells, width: dotsX, rows } = gridOf(art, pose)
  const dotsY = rows * 2
  const rects: string[] = []
  cells.forEach((line, y) => {
    let x = 0
    while (x < dotsX) {
      const color = line[x]
      if (color === undefined) {
        x++
        continue
      }
      let end = x + 1
      while (end < dotsX && line[end] === color) end++
      rects.push(`<rect x="${x}" y="${y}" width="${end - x}" height="1" fill="${color}"/>`)
      x = end
    }
  })
  const width = dotsX * SVG_DOT
  const height = dotsY * SVG_DOT
  const source =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" ` +
    `viewBox="0 0 ${dotsX} ${dotsY}" shape-rendering="crispEdges">${rects.join('')}</svg>`
  return { source, width, height }
}
