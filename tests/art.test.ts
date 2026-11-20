import { expect, test } from 'claude-code/testing'

import { ARTS, artOf } from '../hooks/art'
import { EGG_NAME, EGG_TILT_NAME } from '../hooks/art/egg'
import { SPECIES, speciesOf } from '../hooks/data'

const EGGS = [EGG_NAME, EGG_TILT_NAME]
const dots = (name: string) => (ARTS[name]?.rows.join('') ?? '').replaceAll('.', '').length
const drawn = Object.keys(ARTS).filter(name => !EGGS.includes(name))

test('그림 자료: 줄 길이가 같고, 쓰인 글자와 색 이름표가 서로 맞는다', () => {
  for (const [name, art] of Object.entries(ARTS)) {
    const width = art.rows[0]?.length ?? 0
    const used = new Set(art.rows.join('').replaceAll('.', ''))
    const keys = Object.keys(art.palette)
    expect([name, art.rows.every(r => r.length === width)]).toEqual([name, true])
    expect([name, [...used].filter(ch => !keys.includes(ch))]).toEqual([name, []])
    expect([name, keys.filter(k => k.length !== 1 || !used.has(k))]).toEqual([name, []])
    expect([name, Object.values(art.palette).filter(c => !/^#[0-9a-f]{6}$/.test(c))]).toEqual([name, []])
    expect([name, keys.length >= 3 && keys.length <= 8]).toEqual([name, true])
  }
})

test('그림 자료: 가로 20점·세로 15점 이하이고 빈 테두리가 없다', () => {
  for (const [name, art] of Object.entries(ARTS)) {
    const width = art.rows[0]?.length ?? 0
    const column = (i: number) => art.rows.map(r => r[i]).join('')
    const edges = [art.rows[0] ?? '', art.rows.at(-1) ?? '', column(0), column(width - 1)]
    expect([name, width >= 1 && width <= 20 && art.rows.length <= 15]).toEqual([name, true])
    expect([name, edges.every(edge => /[^.]/.test(edge))]).toEqual([name, true])
  }
})

test('그림 자료: 몬스터에 없는 이름이 없고, 똑같은 그림·똑같은 색 묶음이 없다', () => {
  const names = SPECIES.map(s => s.name)
  expect(drawn.filter(name => !names.includes(name))).toEqual([])
  const shapes = Object.values(ARTS).map(art => art.rows.join('\n'))
  expect(new Set(shapes).size).toBe(shapes.length)
  const colors = drawn.map(name => Object.values(ARTS[name]?.palette ?? {}).sort().join(' '))
  expect(new Set(colors).size).toBe(colors.length)
})

test('그림 자료: 진화한 모습은 진화 전보다 칠한 점이 많다', () => {
  for (const s of SPECIES) {
    for (const evo of s.evolutions) {
      const to = speciesOf(evo.to).name
      if (ARTS[s.name] === undefined || ARTS[to] === undefined) continue
      expect([s.name, to, dots(to) > dots(s.name)]).toEqual([s.name, to, true])
    }
  }
})

test('그림 찾기: 알은 4 tick 에 한 번 기운다', () => {
  expect(artOf(undefined, 1)).toBe(ARTS[EGG_NAME])
  expect(artOf(undefined, 4)).toBe(ARTS[EGG_TILT_NAME])
  expect(artOf('새싹뿔', 4)).toBe(ARTS['새싹뿔'])
})

const missing = (from: number, to: number) =>
  SPECIES.slice(from - 1, to).map(s => s.name).filter(name => ARTS[name] === undefined)

test('151마리 모두 그림이 있다', () => {
  expect(drawn.length).toBe(151)
  expect(missing(1, 151)).toEqual([])
})
