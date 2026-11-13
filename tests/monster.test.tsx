import { expect, mock, test } from 'claude-code/testing'

import { EGG_POOL, LEGENDS, SPECIES, STARTERS, speciesOf } from '../hooks/data'
import { EGG_HATCH_TOKENS, buy, gainTokens, newGame, release, useItem } from '../hooks/game'
import { cells, flowRows, listWindow, textRows } from '../hooks/layout'

const fixed = (value: number) => () => value

test('몬스터는 151마리이고 이름이 겹치지 않는다', () => {
  expect(SPECIES.length).toBe(151)
  expect(new Set(SPECIES.map(s => s.name)).size).toBe(151)
  expect(STARTERS.length).toBe(4)
  expect(LEGENDS.length).toBe(5)
  expect(EGG_POOL.every(id => speciesOf(id).stage === 1 && !speciesOf(id).isLegendary)).toBe(true)
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
    const ui = await $.ui.mount({
      plugin: 'token-monster',
      surface,
      component: 'AbovePrompt',
      requestId: 'band',
      props: {
        hasSurvey: false,
        isWorking: false,
        maxRows: 20,
        bodyColumns: 60,
        scroll: { offset: 0, bodyRows: 20 },
        view: {},
      },
    })
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
    const band = await $.ui.mount({
      plugin: 'token-monster',
      surface,
      component: 'AbovePrompt',
      requestId: 'band',
      props: {
        hasSurvey: false,
        isWorking: false,
        maxRows: 20,
        bodyColumns: 60,
        scroll: { offset: 0, bodyRows: 20 },
        view: {},
      },
    })
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

  const band = await $.ui.mount({
    plugin: 'token-monster',
    surface: 'terminal',
    component: 'AbovePrompt',
    requestId: 'band',
    props: {
      hasSurvey: false,
      isWorking: false,
      maxRows: 20,
      bodyColumns: 60,
      scroll: { offset: 0, bodyRows: 20 },
      view: {},
    },
  })
  const has = async (text: RegExp) => (await band.find({ type: 'Text', text })) !== undefined

  expect(await has(/어라\? 새싹뿔의 모습이/)).toBe(true)
  await clock.advance(400 * 5)
  expect(await has(/새싹뿔이\(가\) 진화하고 있다/)).toBe(true)
  await clock.advance(400 * 11)
  expect(await has(/축하합니다! 새싹뿔은\(는\) 덩굴뿔\(으\)로 진화했다/)).toBe(true)
  await clock.advance(400 * 5)
  expect(await has(/축하합니다/)).toBe(false)
  expect(await has(/Lv\.16/)).toBe(true)
  await band.unmount()
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
const paneOf = (bodyRows: number) =>
  ({
    plugin: 'token-monster',
    surface: 'terminal',
    component: 'Pane',
    requestId: 'monster',
    props: {
      title: '몬스터',
      isFocused: true,
      bodyColumns: 80,
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
  expect((await ui.find({ type: 'Text', text: '(o o)' })) !== undefined).toBe(true)
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
  expect(await ui.find({ type: 'Text', text: '(o o)' })).toBe(undefined)
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
