import { expect, mock, test } from 'claude-code/testing'

import { EGG_POOL, LEGENDS, SPECIES, STARTERS, speciesOf } from '../hooks/data'
import { EGG_HATCH_TOKENS, buy, gainTokens, newGame, useItem } from '../hooks/game'

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
  expect(game.coins).toBe(9_700)
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
