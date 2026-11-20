import { expect, test } from 'claude-code/testing'

import { halfBlocks, standRows, svgOf, walkRows, widthOf } from '../hooks/pixels'

// 세로 3점(홀수), 가로 2점
const A = { palette: { a: '#111111', b: '#222222' }, rows: ['a.', 'ab', '.b'] }
// 세로 2점(짝수), 가로 3점, 한 색
const B = { palette: { a: '#111111' }, rows: ['aaa', 'aaa'] }

test('줄 수: 서 있을 때는 점의 절반, 걸을 때는 1점 뜰 자리를 더한다', () => {
  expect([standRows(A), walkRows(A)]).toEqual([2, 2])
  expect([standRows(B), walkRows(B)]).toEqual([1, 2])
})

test('폭: 가로 점 수가 그대로 터미널 칸 수다', () => {
  expect([widthOf(A), widthOf(B), widthOf({ palette: {}, rows: [] })]).toEqual([2, 3, 0])
})

test('반칸 변환: 바닥에 맞추고, 위·아래 점에 따라 글자와 색을 고른다', () => {
  expect(halfBlocks(A)).toEqual([
    [{ text: '▄', color: '#111111' }, { text: ' ' }],
    [{ text: '▀', color: '#111111' }, { text: '▀', color: '#222222', backgroundColor: '#222222' }],
  ])
})

test('반칸 변환: 글자와 색이 같은 칸은 하나로 묶는다', () => {
  expect(halfBlocks(B)).toEqual([[{ text: '▀▀▀', color: '#111111', backgroundColor: '#111111' }]])
})

test('반칸 변환: 1점 띄우기, 좌우 뒤집기, 줄 수 늘리기, 한 색으로 칠하기', () => {
  expect(halfBlocks(A, { lift: 1 })).toEqual([
    [{ text: '▀', color: '#111111', backgroundColor: '#111111' }, { text: '▄', color: '#222222' }],
    [{ text: ' ' }, { text: '▀', color: '#222222' }],
  ])
  expect(halfBlocks(A, { isMirrored: true })).toEqual([
    [{ text: ' ' }, { text: '▄', color: '#111111' }],
    [{ text: '▀', color: '#222222', backgroundColor: '#222222' }, { text: '▀', color: '#111111' }],
  ])
  expect(halfBlocks(B, { rows: 3 })).toEqual([
    [{ text: '   ' }],
    [{ text: '   ' }],
    [{ text: '▀▀▀', color: '#111111', backgroundColor: '#111111' }],
  ])
  expect(halfBlocks(A, { tint: 'text' })[1]).toEqual([
    { text: '▀', color: 'text' },
    { text: '▀', color: 'text', backgroundColor: 'text' },
  ])
})

test('Svg: 점 하나가 4px 이고, 줄 수만큼의 높이를 가진다', () => {
  const svg = svgOf(B, { rows: 2 })
  expect([svg.width, svg.height]).toEqual([12, 16])
  expect(/^<svg[^>]*viewBox="0 0 3 4"/.test(svg.source)).toBe(true)
  expect(svg.source.includes('shape-rendering="crispEdges"')).toBe(true)
  expect(svg.source.includes('fill="#111111"')).toBe(true)
  expect(svgOf(A, { tint: '#ffffff' }).source.includes('#111111')).toBe(false)
})
