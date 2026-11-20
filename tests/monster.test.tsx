import { expect, mock, test } from 'claude-code/testing'

import { EGG_POOL, LEGENDS, SPECIES, STARTERS, speciesOf } from '../hooks/data'
import { EGG_HATCH_TOKENS, buy, gainTokens, newGame, release, releaseSpares, spares, useItem } from '../hooks/game'
import { artOf } from '../hooks/art'
import { MIN_INFO_COLUMNS, cells, flowRows, listWindow, pickedLayout, textRows } from '../hooks/layout'
import { standRows, walkRows, widthOf } from '../hooks/pixels'

const fixed = (value: number) => () => value

/** 입력칸 위에 mount 할 인자. props 로 maxRows·bodyColumns 를 덮어쓴다. */
const bandOf = (surface: 'terminal' | 'desktop', props: { maxRows?: number; bodyColumns?: number } = {}) =>
  ({
    plugin: 'token-monster',
    surface,
    component: 'AbovePrompt',
    requestId: 'band',
    props: {
      hasSurvey: false,
      isCollapsed: false,
      isWorking: false,
      maxRows: 20,
      bodyColumns: 60,
      scroll: { offset: 0, bodyRows: 20 },
      view: {},
      ...props,
    },
  }) as const

test('몬스터는 151마리이고 이름이 겹치지 않는다', () => {
  expect(SPECIES.length).toBe(151)
  expect(new Set(SPECIES.map(s => s.name)).size).toBe(151)
  expect(STARTERS.length).toBe(4)
  expect(LEGENDS.length).toBe(5)
  expect(EGG_POOL.every(id => speciesOf(id).stage === 1 && !speciesOf(id).isLegendary)).toBe(true)
})

test('몬스터 자료에 문자 그림용 값(arch·accent·eye)이 남지 않았다', () => {
  for (const s of SPECIES) {
    expect([s.name, 'arch' in s, 'accent' in s, 'eye' in s]).toEqual([s.name, false, false, false])
  }
})

test('첫 알은 시작 몬스터 4마리 중 하나로 깨어난다', () => {
  for (const r of [0, 0.3, 0.6, 0.99]) {
    const { game, events } = gainTokens(newGame(), 5000, fixed(r))
    const mon = game.party[0]
    expect(mon !== undefined && STARTERS.includes(mon.species)).toBe(true)
    expect(events.length > 0).toBe(true)
  }
})

test('토큰이 코인·경험치가 되고 레벨 16 에서 진화한다', () => {
  let { game } = gainTokens(newGame(), 3000, fixed(0))
  expect(game.coins).toBe(3)
  const before = game.party[0]?.species ?? 0
  // 레벨 16 까지 필요한 경험치 = 20 * (1^2 + ... + 15^2) = 24800 → 토큰 2,480,000
  game = gainTokens(game, 2_480_000, fixed(0)).game
  const mon = game.party[0]
  expect(mon?.level).toBe(16)
  expect(mon?.species).toBe(speciesOf(before).evolutions[0]?.to)
})

test('알을 사면 진화 전 단계가 깨어나고, 돌로 진화한다', () => {
  let game = { ...newGame(), coins: 10_000 }
  game = buy(game, 'egg').game
  expect(game.coins).toBe(7_000)
  // 0.5 → 전설 아님, EGG_POOL 가운데에서
  game = gainTokens(game, EGG_HATCH_TOKENS, fixed(0.5)).game
  const hatched = game.party[1]
  expect(hatched !== undefined && EGG_POOL.includes(hatched.species)).toBe(true)

  const jelly = SPECIES.find(s => s.name === '변신젤리')
  if (jelly === undefined || hatched === undefined) throw new Error('setup')
  game = { ...game, party: game.party.map(m => (m.uid === hatched.uid ? { ...m, species: jelly.id } : m)) }
  game = buy(game, 'water').game
  const result = useItem(game, hatched.uid, 'water')
  expect(result.game.party[1]?.species).toBe(SPECIES.find(s => s.name === '물결젤리')?.id)
  expect(result.game.items.water).toBe(0)
})

test('코인이 모자라면 사지 못한다', () => {
  const game = newGame()
  const result = buy(game, 'fire')
  expect(result.game).toBe(game)
})

test('입력칸 위에 몬스터와 상태 줄을 그린다', async ($, on) => {
  mock.store(on)
  mock.clock(on)
  on('command.register', () => ({ value: { command: 'monster' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount(bandOf(surface))
    expect((await ui.find({ type: 'Text', text: /깨어나기까지/ })) !== undefined).toBe(true)
    await ui.unmount()
  }
})

test('가방의 노란 문구는 5초 뒤 사라진다', async ($, on) => {
  mock.store(on)
  const clock = mock.clock(on)
  on('command.register', () => ({ value: { command: 'monster' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

  const ui = await $.ui.mount({
    plugin: 'token-monster',
    surface: 'terminal',
    component: 'Pane',
    requestId: 'monster',
    props: {
      title: '몬스터',
      isFocused: true,
      bodyColumns: 80,
      placement: 'dock',
      scroll: { offset: 0, bodyRows: 40 },
      view: {},
    },
  })
  await ui.press({ key: 'buy-egg' })
  expect((await ui.find({ type: 'Text', text: /코인이 모자랍니다/ })) !== undefined).toBe(true)

  await clock.advance(4_000)
  expect((await ui.find({ type: 'Text', text: /코인이 모자랍니다/ })) !== undefined).toBe(true)

  await clock.advance(1_500)
  expect(await ui.find({ type: 'Text', text: /코인이 모자랍니다/ })).toBe(undefined)
  await ui.unmount()
})

test('전설 몬스터는 이름이 금색, 일반 몬스터는 아니다', async ($, on) => {
  const legend = SPECIES.find(s => s.name === '태양사자')
  const normal = SPECIES.find(s => s.name === '새싹뿔')
  if (legend === undefined || normal === undefined) throw new Error('setup')
  const mon = (uid: number, species: number) => ({ uid, species, level: 5, exp: 0, hatchLeft: 0, isStarter: false })
  mock.store(on, {
    game: {
      ...newGame(),
      party: [mon(1, legend.id), mon(2, normal.id)],
      activeUid: 1,
      nextUid: 3,
    },
  })
  mock.clock(on)
  on('command.register', () => ({ value: { command: 'monster' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

  for (const surface of ['terminal', 'desktop'] as const) {
    const band = await $.ui.mount(bandOf(surface))
    expect((await band.find({ type: 'Text', text: /^태양사자$/ }))?.props.color).toBe('#ffc400')
    await band.unmount()

    const pane = await $.ui.mount({
      plugin: 'token-monster',
      surface,
      component: 'Pane',
      requestId: 'monster',
      props: {
        title: '몬스터',
        isFocused: true,
        bodyColumns: 80,
        placement: 'dock',
        scroll: { offset: 0, bodyRows: 40 },
        view: {},
      },
    })
    expect((await pane.find({ type: 'Text', text: /^새싹뿔$/ }))?.props.color).toBe(undefined)
    expect((await pane.find({ type: 'Text', text: /^태양사자$/ }))?.props.color).toBe('#ffc400')
    await pane.unmount()
  }
})

test('진화하면 입력칸 위에서 알아챔 → 깜빡임 → 축하 순서로 연출하고 다시 걷는다', async ($, on) => {
  const seed = SPECIES.find(s => s.name === '새싹뿔')
  if (seed === undefined) throw new Error('setup')
  mock.store(on, {
    game: {
      ...newGame(),
      party: [{ uid: 1, species: seed.id, level: 15, exp: 0, hatchLeft: 0, isStarter: true }],
      activeUid: 1,
      nextUid: 2,
      items: { candy: 1 },
    },
  })
  const clock = mock.clock(on)
  on('command.register', () => ({ value: { command: 'monster' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

  const pane = await $.ui.mount({
    plugin: 'token-monster',
    surface: 'terminal',
    component: 'Pane',
    requestId: 'monster',
    props: {
      title: '몬스터',
      isFocused: true,
      bodyColumns: 80,
      placement: 'dock',
      scroll: { offset: 0, bodyRows: 40 },
      view: {},
    },
  })
  await pane.press({ key: 'use-candy' })
  await pane.unmount()

  const band = await $.ui.mount(bandOf('terminal'))
  const has = async (text: RegExp) => (await band.find({ type: 'Text', text })) !== undefined

  // 그림 상자(walker)의 바로 아래 자식 하나가 그림 한 줄이다
  const artRows = async () => (await band.find({ key: 'walker' }))?.children.length

  expect(await has(/어라\? 새싹뿔의 모습이/)).toBe(true)
  const rows = await artRows()
  await clock.advance(400 * 5)
  expect(await has(/새싹뿔이\(가\) 진화하고 있다/)).toBe(true)
  expect(await artRows()).toBe(rows)
  expect((await band.findAll({ type: 'Text', text: HALF })).some(t => t.props.color === 'text')).toBe(true)
  // 7번째 tick: 진화 후 모습(덩굴뿔)을 흰빛으로 그린다. 축하 때 같은 그림이 같은 칸에 있어야 한다.
  await clock.advance(400 * 2)
  const glowing = leftDot(await walkerRows(band))
  await clock.advance(400 * 9)
  expect(await has(/축하합니다! 새싹뿔은\(는\) 덩굴뿔\(으\)로 진화했다/)).toBe(true)
  expect(await artRows()).toBe(rows)
  expect((await band.find({ type: 'Text', text: /^[*.] $/ }))?.props.color).toBe('#ffc400')
  // 반짝이가 붙어도 그림은 옆으로 밀리지 않는다
  expect(leftDot(await walkerRows(band))).toBe(glowing)
  await clock.advance(400 * 5)
  expect(await has(/축하합니다/)).toBe(false)
  expect(await has(/Lv\.16/)).toBe(true)
  await band.unmount()
})

const HALF = /[▀▄]/

/** 그림 줄들의 모양. 걷는 위치(앞쪽 빈 칸)는 뺀다. */
const shapeOf = async (ui: { findAll: (q: { type: string; text: RegExp }) => Promise<{ text?: unknown }[]> }) =>
  (await ui.findAll({ type: 'Text', text: HALF })).map(t => String(t.text).trimStart()).join('\n')

/** 그려진 요소의 글자를 안쪽 Text 까지 모두 이어 붙인다 */
const textOf = (node: unknown): string =>
  typeof node === 'string'
    ? node
    : typeof node === 'object' && node !== null && 'children' in node && Array.isArray(node.children)
      ? node.children.map(textOf).join('')
      : ''

/** 그림 상자(walker)의 줄마다 그린 글자 */
const walkerRows = async (ui: { find: (q: { key: string }) => Promise<{ children: unknown[] } | undefined> }) =>
  ((await ui.find({ key: 'walker' }))?.children ?? []).map(textOf)

/** 그림에서 가장 왼쪽에 칠한 칸 (앞의 빈 칸·반짝이 글자는 세지 않는다) */
const leftDot = (rows: string[]): number => Math.min(...rows.map(row => row.search(HALF)).filter(at => at >= 0))

test('입력칸 위: 터미널은 반칸 블록, 데스크톱은 Svg 로 그리고, 알은 뜨지 않는다', async ($, on) => {
  mock.store(on)
  const clock = mock.clock(on)
  on('command.register', () => ({ value: { command: 'monster' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

  const term = await $.ui.mount(bandOf('terminal'))
  expect((await term.find({ key: 'walker' })) !== undefined).toBe(true)
  expect((await term.findAll({ type: 'Text', text: HALF })).length > 0).toBe(true)
  expect(await term.find({ type: 'Svg' })).toBe(undefined)
  // tick 1 과 2: 알이 기우는 때(4 의 배수)를 피한 이어진 두 tick 의 그림이 같다
  await clock.advance(400)
  const first = await shapeOf(term)
  await clock.advance(400)
  expect(await shapeOf(term)).toBe(first)
  await term.unmount()

  const desk = await $.ui.mount(bandOf('desktop'))
  expect((await desk.find({ type: 'Svg' })) !== undefined).toBe(true)
  expect((await desk.findAll({ type: 'Text', text: HALF })).length).toBe(0)
  await desk.unmount()
})

test('입력칸 위: 알은 기운 그림을 보여 줄 때도 한 칸씩 걷는다', async ($, on) => {
  mock.store(on)
  const clock = mock.clock(on)
  on('command.register', () => ({ value: { command: 'monster' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

  // 기운 알(4 tick 에 한 번)은 1칸 넓다. 그래서 그림마다 걷는 범위를 새로 재면 걸음이 튄다.
  expect(widthOf(artOf(undefined, 0)) - widthOf(artOf(undefined, 1))).toBe(1)

  // 1496~1505 tick: 기우는 1496·1500·1504 를 낀다. 알 그림은 어느 모습이든 맨 왼쪽 열에 점이 있어서
  // 가장 왼쪽에 칠한 칸이 곧 걷는 자리다.
  await clock.advance(400 * 1496)
  const band = await $.ui.mount(bandOf('terminal', { bodyColumns: 115 }))
  const lefts: number[] = []
  const shapes: string[] = []
  for (let t = 1496; t <= 1505; t++) {
    const rows = await walkerRows(band)
    const left = leftDot(rows)
    lefts.push(left)
    shapes.push(rows.map(row => row.slice(left)).join('\n'))
    await clock.advance(400)
  }
  await band.unmount()
  const steps = lefts.slice(1).map((left, i) => Math.abs(left - (lefts[i] ?? left)))
  expect(steps.every(step => step <= 1), `걷는 자리: ${lefts.join(' ')}`).toBe(true)
  expect(new Set(lefts).size > 1).toBe(true)
  // 기운 그림도 제대로 그린다: 1496·1500 은 기운 모습, 1497·1498 은 바로 선 모습
  expect([shapes[0] === shapes[4], shapes[1] === shapes[2], shapes[0] === shapes[1]]).toEqual([true, true, false])
})

test('입력칸 위: 알은 뜨지 않으므로 서 있는 줄 수만큼만 쓴다', async ($, on) => {
  mock.store(on)
  mock.clock(on)
  on('command.register', () => ({ value: { command: 'monster' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

  const rows = standRows(artOf('알'))
  expect(standRows(artOf('알-기움'))).toBe(rows)
  const band = await $.ui.mount(bandOf('terminal'))
  expect((await band.find({ key: 'walker' }))?.children.length).toBe(rows)
  // 맨 위 줄도 비어 있지 않다
  expect(HALF.test((await walkerRows(band))[0] ?? '')).toBe(true)
  await band.unmount()

  // 그림 + 상태 줄 1줄이 들어가면 그림을 그린다
  for (const [maxRows, isShown] of [
    [rows + 1, true],
    [rows, false],
  ] as const) {
    const short = await $.ui.mount(bandOf('terminal', { maxRows }))
    expect([maxRows, (await short.find({ key: 'walker' })) !== undefined]).toEqual([maxRows, isShown])
    expect((await short.find({ type: 'Text', text: /깨어나기까지/ })) !== undefined).toBe(true)
    await short.unmount()
  }
})

test('입력칸 위: 몬스터는 한 tick 걸러 1점 뜨고, 자리가 모자라면 상태 줄만, 폭이 좁아도 그려진다', async ($, on) => {
  mock.store(on, { game: gameWith(1) })
  const clock = mock.clock(on)
  on('command.register', () => ({ value: { command: 'monster' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

  const walking = await $.ui.mount(bandOf('terminal'))
  await clock.advance(400)
  const lifted = await shapeOf(walking)
  await clock.advance(400)
  expect((await shapeOf(walking)) === lifted).toBe(false)
  await walking.unmount()

  for (const [maxRows, isShown] of [[7, true], [6, false]] as const) {
    const band = await $.ui.mount(bandOf('terminal', { maxRows }))
    expect((await band.find({ key: 'walker' })) !== undefined).toBe(isShown)
    expect((await band.find({ type: 'Text', text: /Lv\.5/ })) !== undefined).toBe(true)
    await band.unmount()
  }
  const narrow = await $.ui.mount(bandOf('terminal', { bodyColumns: 5 }))
  expect((await narrow.find({ type: 'Text', text: /Lv\.5/ })) !== undefined).toBe(true)
  await narrow.unmount()
})

test('진화 연출도 자리가 모자라면 그림 없이 문구만 그린다', async ($, on) => {
  const seed = SPECIES.find(s => s.name === '새싹뿔')
  if (seed === undefined) throw new Error('setup')
  mock.store(on, {
    game: {
      ...newGame(),
      party: [{ uid: 1, species: seed.id, level: 15, exp: 0, hatchLeft: 0, isStarter: true }],
      activeUid: 1,
      nextUid: 2,
      items: { candy: 1 },
    },
  })
  mock.clock(on)
  on('command.register', () => ({ value: { command: 'monster' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

  const pane = await $.ui.mount(paneOf(40))
  await pane.press({ key: 'use-candy' })
  await pane.unmount()

  // 진화 전후 줄 수가 다르다(같으면 높이가 안 흔들린다는 확인이 아무것도 보지 못한다)
  const before = walkRows(artOf('새싹뿔'))
  const after = walkRows(artOf('덩굴뿔'))
  expect(before === after).toBe(false)
  const rows = Math.max(before, after)

  const short = await $.ui.mount(bandOf('terminal', { maxRows: rows }))
  expect(await short.find({ key: 'walker' })).toBe(undefined)
  expect((await short.find({ type: 'Text', text: /어라\? 새싹뿔의 모습이/ })) !== undefined).toBe(true)
  await short.unmount()

  const enough = await $.ui.mount(bandOf('terminal', { maxRows: rows + 1 }))
  expect((await enough.find({ key: 'walker' })) !== undefined).toBe(true)
  expect((await enough.find({ type: 'Text', text: /어라\? 새싹뿔의 모습이/ })) !== undefined).toBe(true)
  await enough.unmount()
})

// ---- 내보내기 · 목록만 스크롤 · 상점을 위로 ----

const seedId = SPECIES.find(s => s.name === '새싹뿔')?.id ?? 0
const monAt = (uid: number) => ({ uid, species: seedId, level: 5, exp: 0, hatchLeft: 0, isStarter: false })
const gameWith = (count: number) => ({
  ...newGame(),
  party: Array.from({ length: count }, (_, i) => monAt(i + 1)),
  activeUid: 1,
  nextUid: count + 1,
  dex: [seedId],
})
const paneOf = (bodyRows: number, bodyColumns = 80, surface: 'terminal' | 'desktop' = 'terminal') =>
  ({
    plugin: 'token-monster',
    surface,
    component: 'Pane',
    requestId: 'monster',
    props: {
      title: '몬스터',
      isFocused: true,
      bodyColumns,
      placement: 'dock',
      scroll: { offset: 0, bodyRows },
      view: {},
    },
  }) as const
const wheel = (by: number, row: number, rows: { bodyRows: number; contentRows: number }) =>
  ({
    component: 'Pane',
    requestId: 'monster',
    offset: 0,
    by,
    ...rows,
    origin: { kind: 'person' },
    pointer: { column: 5, row },
  }) as const

test('내보내면 가방에서 사라지고, 함께 다니는 몬스터와 마지막 한 마리는 못 내보낸다', () => {
  const game = gameWith(2)
  expect(release(game, 1).game).toBe(game)
  expect(release(game, 99).game).toBe(game)

  const done = release(game, 2)
  expect(done.game.party.map(m => m.uid)).toEqual([1])
  expect(done.game.dex).toEqual([seedId])
  expect(done.message).toBe('새싹뿔을(를) 내보냈습니다.')

  // 한 마리 남으면, 함께 다니는 몬스터가 아니어도 못 내보낸다
  const last = { ...done.game, activeUid: 0 }
  expect(release(last, 1).game).toBe(last)
})

test('고른 몬스터 부분: 넓으면 그림 옆에, 좁으면 그림 아래에 설명을 둔다', () => {
  const nameLine = 'No.001 새싹뿔 · 풀 속성' // 23칸
  const evoText = '진화: Lv.16 → 덩굴뿔' // 20칸
  const at = (columns: number, pictureRows: number, actionWidths: number[] = []) =>
    pickedLayout({ columns, pictureColumns: 9, pictureRows, nameLine, evoText, actionWidths })
  expect(at(80, 6)).toEqual({ isSideBySide: true, infoColumns: 69, rows: 6 })
  expect(at(35, 6)).toEqual({ isSideBySide: true, infoColumns: 24, rows: 6 })
  expect(at(34, 6)).toEqual({ isSideBySide: false, infoColumns: 34, rows: 8 })
  // 설명이 그림보다 길면 설명 줄 수를 따른다: 이름 1 + 진화 1 + 버튼 3
  expect(at(35, 4, [15, 12, 12])).toEqual({ isSideBySide: true, infoColumns: 24, rows: 5 })
  expect(pickedLayout({ columns: 80, pictureColumns: 9, pictureRows: 5, nameLine, evoText: '', actionWidths: [] }).rows).toBe(5)
})

test('고른 몬스터 부분: 이름 줄이 설명 칸보다 길면 낱말 사이에서 바뀐 줄 수만큼 센다', () => {
  // 32칸 → 27칸에서 'No.147 태양사자 · 불 속성 ·' / '전설' 두 줄
  const nameLine = 'No.147 태양사자 · 불 속성 · 전설'
  expect(cells(nameLine)).toBe(32)
  const of = (columns: number, pictureColumns: number, line: string) =>
    pickedLayout({ columns, pictureColumns, pictureRows: 2, nameLine: line, evoText: '', actionWidths: [15] })
  // 나란히: 이름 2 + 버튼 1 > 그림 2
  expect(of(49, 20, nameLine)).toEqual({ isSideBySide: true, infoColumns: 27, rows: 3 })
  // 쌓기: 그림 2 + 이름 2 + 버튼 1
  expect(of(27, 9, nameLine)).toEqual({ isSideBySide: false, infoColumns: 27, rows: 5 })
  // 알 줄(34칸)도 같다: 33칸에서 두 줄
  expect(of(43, 8, '알 · 깨어나기까지 토큰 1,000,000개')).toEqual({ isSideBySide: true, infoColumns: 33, rows: 3 })
  // 어느 이름도 설명 칸의 가장 좁은 폭보다 길지 않다.
  // 그래서 낱말 사이에서만 줄을 바꾸면, 나란히 놓을 때 이름이 반으로 잘리는 일이 없다.
  expect(SPECIES.filter(s => cells(s.name) > MIN_INFO_COLUMNS).map(s => s.name)).toEqual([])
})

test('줄 수 계산: 한글은 2칸이고, 넘치면 다음 줄로 간다', () => {
  expect(cells('알 3000')).toBe(7)
  expect(textRows('가나 다라', 9)).toBe(1)
  expect(textRows('가나 다라', 8)).toBe(2)
  expect(textRows('', 10)).toBe(1)
  expect(flowRows([5, 5, 5], 11)).toBe(2)
  expect(flowRows([], 10)).toBe(0)

  expect(listWindow(5, 10)).toEqual({ count: 5, isCut: false })
  expect(listWindow(30, 10)).toEqual({ count: 10, isCut: true })
  // 자리가 모자라도 3마리는 보여 준다
  expect(listWindow(6, 0)).toEqual({ count: 3, isCut: true })
  expect(listWindow(3, 0)).toEqual({ count: 3, isCut: false })
})

test('상점은 목록보다 위에 있고, 몬스터가 많으면 목록만 잘라서 보여 준다', async ($, on) => {
  mock.store(on, { game: gameWith(30) })
  mock.clock(on)
  on('command.register', () => ({ value: { command: 'monster' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

  // 30줄짜리 가방: 위(코인·상점·제목) 6줄 + 몬스터 17줄 + 아래(고른 몬스터) 7줄
  const ui = await $.ui.mount(paneOf(30))
  const keys = (await ui.findAll({ type: 'Button' })).map(b => b.key ?? '')
  const mons = keys.filter(k => k.startsWith('mon-'))
  expect(keys[0]).toBe('buy-egg')
  expect(keys.indexOf('buy-cord') < keys.indexOf('mon-1')).toBe(true)
  expect(mons.length).toBe(17)
  expect(mons[0]).toBe('mon-1')
  expect((await ui.find({ type: 'Text', text: /번째/ }))?.text).toBe('1–17번째')
  // 넉넉하면 몬스터 그림과 환율 안내도 그린다
  expect((await ui.find({ key: 'picture' })) !== undefined).toBe(true)
  expect((await ui.find({ key: 'picked' }))?.props.flexDirection).toBe('row')
  expect((await ui.find({ type: 'Text', text: /경험치 1/ })) !== undefined).toBe(true)
  await ui.unmount()
})

test('가방이 낮으면 그림·빈 줄·환율 안내를 빼고 목록과 버튼을 한 화면에 넣는다', async ($, on) => {
  mock.store(on, { game: gameWith(30) })
  mock.clock(on)
  on('command.register', () => ({ value: { command: 'monster' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

  // 11줄짜리 가방: 코인 1 + 상점 2 + 제목 1 + 몬스터 5 + 고른 몬스터 2(이름·진화)
  const ui = await $.ui.mount(paneOf(11))
  const mons = async () =>
    (await ui.findAll({ type: 'Button' })).map(b => b.key ?? '').filter(k => k.startsWith('mon-'))
  expect((await mons()).length).toBe(5)
  expect(await ui.find({ key: 'picture' })).toBe(undefined)
  expect(await ui.find({ type: 'Text', text: /경험치 1/ })).toBe(undefined)

  // 다른 몬스터를 고르면 버튼 줄이 생기는 만큼 목록이 한 줄 준다
  await ui.press({ key: 'mon-2' })
  expect((await mons()).length).toBe(4)
  expect((await ui.find({ key: 'release' })) !== undefined).toBe(true)
  await ui.unmount()
})

test('가방에서 휠을 굴리면 목록만 움직이고, 가방 전체는 그대로다', async ($, on) => {
  mock.store(on, { game: gameWith(30) })
  mock.clock(on)
  on('command.register', () => ({ value: { command: 'monster' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  let passedToEngine = 0
  on('ui.scroll', () => {
    passedToEngine += 1
    return {}
  })
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

  const ui = await $.ui.mount(paneOf(30))
  const shownMons = async () =>
    (await ui.findAll({ type: 'Button' })).map(b => b.key ?? '').filter(k => k.startsWith('mon-'))
  const fits = { bodyRows: 30, contentRows: 30 }

  await $.ui.scroll(wheel(1, 2, fits))
  expect((await shownMons())[0]).toBe('mon-2')
  expect((await ui.find({ type: 'Text', text: /번째/ }))?.text).toBe('2–18번째')

  // End: 맨 아래로
  await $.ui.scroll(wheel(31, 2, fits))
  expect((await shownMons()).at(-1)).toBe('mon-30')
  expect((await ui.find({ type: 'Text', text: /번째/ }))?.text).toBe('14–30번째')

  // 끝에서 더 굴려도 가방 전체는 움직이지 않는다
  await $.ui.scroll(wheel(1, 2, fits))
  expect(passedToEngine).toBe(0)

  // ▲ ▼ 를 누르면 한 쪽(보이는 수 - 1 = 16마리)씩 움직인다
  await $.ui.scroll(wheel(-3, 2, fits))
  await ui.press({ key: 'list-up' })
  expect((await shownMons())[0]).toBe('mon-1')
  await ui.press({ key: 'list-down' })
  expect((await shownMons())[0]).toBe('mon-14')
  await ui.unmount()
})

test('가방이 화면보다 길면, 목록 밖에서 굴린 휠과 목록 끝에서 굴린 휠은 가방 전체를 움직인다', async ($, on) => {
  mock.store(on, { game: gameWith(30) })
  mock.clock(on)
  on('command.register', () => ({ value: { command: 'monster' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  let passedToEngine = 0
  on('ui.scroll', () => {
    passedToEngine += 1
    return {}
  })
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

  // 6줄짜리 가방: 촘촘하게 그려도 9줄(코인 1 + 상점 2 + 제목 1 + 몬스터 3 + 고른 몬스터 2)이라 넘친다.
  // 몬스터는 5~7번째 줄(0부터 세면 4~6)에 있다.
  const ui = await $.ui.mount(paneOf(6))
  const shownMons = async () =>
    (await ui.findAll({ type: 'Button' })).map(b => b.key ?? '').filter(k => k.startsWith('mon-'))
  const over = { bodyRows: 6, contentRows: 9 }
  expect((await shownMons()).length).toBe(3)

  await $.ui.scroll(wheel(1, 1, over)) // 상점 위
  expect(passedToEngine).toBe(1)
  expect((await shownMons())[0]).toBe('mon-1')

  await $.ui.scroll(wheel(1, 5, over)) // 목록 위
  expect(passedToEngine).toBe(1)
  expect((await shownMons())[0]).toBe('mon-2')

  await $.ui.scroll(wheel(-1, 5, over))
  await $.ui.scroll(wheel(-1, 5, over)) // 목록이 이미 맨 위 → 가방 전체로
  expect(passedToEngine).toBe(2)
  await ui.unmount()
})

test('몬스터가 가방 높이에 다 들어가면 목록을 자르지 않고, 휠은 엔진이 처리한다', async ($, on) => {
  mock.store(on, { game: gameWith(3) })
  mock.clock(on)
  on('command.register', () => ({ value: { command: 'monster' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  let passedToEngine = 0
  on('ui.scroll', () => {
    passedToEngine += 1
    return {}
  })
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

  const ui = await $.ui.mount(paneOf(30))
  expect(await ui.find({ key: 'list-down' })).toBe(undefined)
  expect(await ui.find({ type: 'Text', text: /번째/ })).toBe(undefined)
  await $.ui.scroll(wheel(1, 7, { bodyRows: 30, contentRows: 16 }))
  expect(passedToEngine).toBe(1)
  await ui.unmount()
})

test('내보내기는 한 번 더 묻고, 함께 다니는 몬스터에는 버튼이 없다', async ($, on) => {
  mock.store(on, { game: gameWith(3) })
  mock.clock(on)
  on('command.register', () => ({ value: { command: 'monster' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

  const ui = await $.ui.mount(paneOf(40))
  const has = async (key: string) => (await ui.find({ key })) !== undefined

  // 처음에는 함께 다니는 몬스터가 골라져 있다
  expect(await has('release')).toBe(false)

  await ui.press({ key: 'mon-2' })
  expect(await has('release')).toBe(true)

  await ui.press({ key: 'release' })
  expect(await has('release')).toBe(false)
  expect(await has('release-yes')).toBe(true)
  await ui.press({ key: 'release-no' })
  expect(await has('release-yes')).toBe(false)
  expect(await has('mon-2')).toBe(true)

  // 묻는 중에 다른 몬스터를 고르면 묻기를 그만둔다
  await ui.press({ key: 'release' })
  await ui.press({ key: 'mon-3' })
  expect(await has('release-yes')).toBe(false)
  await ui.press({ key: 'mon-2' })

  await ui.press({ key: 'release' })
  await ui.press({ key: 'release-yes' })
  expect(await has('mon-2')).toBe(false)
  expect(await has('mon-3')).toBe(true)
  expect((await ui.find({ type: 'Text', text: /가방 속 몬스터/ }))?.text).toBe('가방 속 몬스터 (2)')
  expect((await ui.find({ type: 'Text', text: /내보냈습니다/ })) !== undefined).toBe(true)
  await ui.unmount()
})

// ---- 중복된 Lv.1 몬스터 한 번에 내보내기 ----

test('중복된 Lv.1 만 골라낸다: 종마다 한 마리는 남기고, 알·전설·함께 다니는 몬스터는 뺀다', () => {
  const idOf = (name: string) => SPECIES.find(s => s.name === name)?.id ?? -99
  const mon = (uid: number, name: string, level = 1, exp = 0) => ({
    uid,
    species: idOf(name),
    level,
    exp,
    hatchLeft: 0,
    isStarter: false,
  })
  const egg = (uid: number) => ({ uid, species: -1, level: 1, exp: 0, hatchLeft: 500, isStarter: false })
  const game = {
    ...newGame(),
    party: [
      // 전부 Lv.1 → 함께 다니는 1번이 남고 2·3번이 나간다
      mon(1, '새싹뿔'),
      mon(2, '새싹뿔'),
      mon(3, '새싹뿔'),
      // 레벨이 높은 4번이 남고 5·6번이 나간다
      mon(4, '불씨룡', 20),
      mon(5, '불씨룡'),
      mon(6, '불씨룡'),
      // 한 마리뿐이면 중복이 아니다
      mon(7, '물방울게'),
      // 레벨이 같으면 경험치가 많은 9번이 남는다
      mon(8, '찌릿여우'),
      mon(9, '찌릿여우', 1, 30),
      // 전설과 알은 건드리지 않는다
      mon(10, '태양사자'),
      mon(11, '태양사자'),
      egg(12),
      egg(13),
      // 중복이어도 Lv.1 이 아니면 남는다
      mon(14, '꼬물실', 3),
      mon(15, '꼬물실', 3),
    ],
    activeUid: 1,
    nextUid: 16,
  }
  expect(spares(game).map(m => m.uid)).toEqual([2, 3, 5, 6, 8])

  const done = releaseSpares(game)
  expect(done.game.party.map(m => m.uid)).toEqual([1, 4, 7, 9, 10, 11, 12, 13, 14, 15])
  expect(done.message).toBe('중복된 Lv.1 몬스터 5마리를 내보냈습니다.')
  expect(releaseSpares(done.game).game).toBe(done.game)
})

test('중복 Lv.1 한 번에 내보내기는 중복이 있을 때만 버튼이 나오고, 한 번 더 묻는다', async ($, on) => {
  // 1번은 Lv.5 로 함께 다니고, 2~4번은 같은 종 Lv.1
  const game = {
    ...gameWith(4),
    party: [monAt(1), ...[2, 3, 4].map(uid => ({ ...monAt(uid), level: 1 }))],
  }
  mock.store(on, { game })
  mock.clock(on)
  on('command.register', () => ({ value: { command: 'monster' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

  const ui = await $.ui.mount(paneOf(40))
  const has = async (key: string) => (await ui.find({ key })) !== undefined
  expect((await ui.find({ key: 'release-spares' }))?.props.label).toBe('중복 Lv.1 3마리 내보내기')

  await ui.press({ key: 'release-spares' })
  expect(await has('release-spares-yes')).toBe(true)
  expect((await ui.find({ type: 'Text', text: /종마다/ })) !== undefined).toBe(true)
  await ui.press({ key: 'release-spares-no' })
  expect(await has('release-spares-yes')).toBe(false)

  // 묻는 중에 몬스터를 고르면 묻기를 그만둔다
  await ui.press({ key: 'release-spares' })
  await ui.press({ key: 'mon-2' })
  expect(await has('release-spares-yes')).toBe(false)
  expect(await has('mon-4')).toBe(true)

  await ui.press({ key: 'release-spares' })
  await ui.press({ key: 'release-spares-yes' })
  expect((await ui.find({ type: 'Text', text: /가방 속 몬스터/ }))?.text).toBe('가방 속 몬스터 (1)')
  expect((await ui.find({ type: 'Text', text: /3마리를 내보냈습니다/ })) !== undefined).toBe(true)
  expect(await has('release-spares')).toBe(false)
  expect(await has('mon-1')).toBe(true)
  await ui.unmount()
})

test('가방: 좁으면 그림 아래에 쌓고, 그림보다 좁아도 그려지고, 데스크톱은 Svg 로 그린다', async ($, on) => {
  mock.store(on, { game: gameWith(3) })
  mock.clock(on)
  on('command.register', () => ({ value: { command: 'monster' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

  const stacked = await $.ui.mount(paneOf(40, 34))
  expect((await stacked.find({ key: 'picked' }))?.props.flexDirection).toBe('column')
  expect((await stacked.find({ key: 'picture' })) !== undefined).toBe(true)
  await stacked.unmount()

  const tiny = await $.ui.mount(paneOf(40, 12))
  expect((await tiny.find({ key: 'mon-1' })) !== undefined).toBe(true)
  await tiny.unmount()

  const desk = await $.ui.mount(paneOf(40, 80, 'desktop'))
  expect((await desk.find({ type: 'Svg' })) !== undefined).toBe(true)
  await desk.unmount()
})

/** 가방에 보이는 몬스터 목록 줄의 key */
const listedMons = async (ui: { findAll: (q: { type: string }) => Promise<{ key: string | undefined }[]> }) =>
  (await ui.findAll({ type: 'Button' })).map(b => b.key ?? '').filter(k => k.startsWith('mon-'))

test('가방: 이름 줄은 글 한 줄로 그려 낱말 사이에서 바꾸고, 바뀐 줄 수만큼 목록을 줄인다', async ($, on) => {
  const legend = SPECIES.find(s => s.name === '태양사자')
  if (legend === undefined) throw new Error('setup')
  // 태양사자(그림 20칸 × 8줄)가 함께 다닌다. 아이템이 7가지라 버튼이 7줄이어서 설명이 그림보다 길다.
  const base = gameWith(30)
  const items = { candy: 1, fire: 1, water: 1, thunder: 1, leaf: 1, moon: 1, cord: 1 }
  mock.store(on, { game: { ...base, party: [{ ...monAt(1), species: legend.id }, ...base.party.slice(1)], items } })
  mock.clock(on)
  on('command.register', () => ({ value: { command: 'monster' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

  // 49칸: 설명 칸 27칸에 32칸짜리 이름 줄 → 2줄. 설명 = 이름 2 + 버튼 7 = 9줄 > 그림 8줄.
  // 30줄 = 위 8(코인 1 + 상점 3 + 환율 2 + 빈 줄 1 + 제목 1) + 몬스터 12 + 아래 10(빈 줄 1 + 설명 9)
  const side = await $.ui.mount(paneOf(30, 49))
  expect((await side.find({ key: 'picked' }))?.props.flexDirection).toBe('row')
  // 이름 줄은 Text 하나이고 이름만 안쪽 Text(금색)다: 이름 안이 아니라 낱말 사이에서 줄이 바뀐다
  expect((await side.find({ type: 'Text', text: /^No\.147 태양사자 · 불 속성 · 전설$/ })) !== undefined).toBe(true)
  expect((await side.find({ type: 'Text', text: /^태양사자$/ }))?.props.color).toBe('#ffc400')
  expect((await listedMons(side)).length).toBe(12)
  await side.unmount()

  // 촘촘한 배치도 전체 폭(30칸)에서 바뀐 줄 수를 센다.
  // 26줄 = 위 11(코인 1 + 상점 8 + 제목 2) + 몬스터 6 + 아래 9(이름 2 + 버튼 7)
  const tight = await $.ui.mount(paneOf(26, 30))
  expect(await tight.find({ key: 'picture' })).toBe(undefined)
  expect((await listedMons(tight)).length).toBe(6)
  await tight.unmount()
})

test('가방: 알 줄도 설명 칸에서 바뀐 줄 수만큼 센다', async ($, on) => {
  const base = gameWith(30)
  const egg = { uid: 1, species: -1, level: 1, exp: 0, hatchLeft: 1_000_000, isStarter: false }
  mock.store(on, { game: { ...base, party: [egg, ...base.party.slice(1)] } })
  mock.clock(on)
  on('command.register', () => ({ value: { command: 'monster' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

  // 33칸: 쌓는다. '알 · 깨어나기까지 토큰 1,000,000개'(34칸)는 2줄.
  // 30줄 = 위 11(코인 1 + 상점 5 + 환율 2 + 빈 줄 1 + 제목 2) + 몬스터 11 + 아래 8(빈 줄 1 + 그림 5 + 알 줄 2)
  const ui = await $.ui.mount(paneOf(30, 33))
  expect((await ui.find({ key: 'picked' }))?.props.flexDirection).toBe('column')
  expect((await listedMons(ui)).length).toBe(11)
  await ui.unmount()
})

test('가방: 그림 아래에 쌓을 때도 목록에 보이는 마릿수가 줄 수 계산과 맞는다', async ($, on) => {
  mock.store(on, { game: gameWith(30) })
  mock.clock(on)
  on('command.register', () => ({ value: { command: 'monster' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

  // 34칸: 새싹뿔(9칸) 옆 설명 칸이 23칸이라 쌓는다.
  // 30줄 = 위 10(코인 1 + 상점 4 + 환율 2 + 빈 줄 1 + 제목 2) + 몬스터 11 + 아래 9(빈 줄 1 + 그림 6 + 이름 1 + 진화 1)
  const ui = await $.ui.mount(paneOf(30, 34))
  expect((await ui.find({ key: 'picked' }))?.props.flexDirection).toBe('column')
  expect((await ui.find({ key: 'picture' })) !== undefined).toBe(true)
  expect((await listedMons(ui)).length).toBe(11)
  expect((await ui.find({ type: 'Text', text: /번째/ }))?.text).toBe('1–11번째')
  await ui.unmount()
})

test('가방: 알을 고르면 알 그림이 나온다', async ($, on) => {
  mock.store(on, { game: newGame() })
  mock.clock(on)
  on('command.register', () => ({ value: { command: 'monster' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

  const ui = await $.ui.mount(paneOf(40))
  expect((await ui.find({ key: 'picture' })) !== undefined).toBe(true)
  expect((await ui.findAll({ type: 'Text', text: /[▀▄]/ })).length > 0).toBe(true)
  await ui.unmount()

  const desk = await $.ui.mount(paneOf(40, 80, 'desktop'))
  expect((await desk.find({ type: 'Svg' })) !== undefined).toBe(true)
  await desk.unmount()
})
