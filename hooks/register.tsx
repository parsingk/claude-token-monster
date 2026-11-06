import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Evolving, Game, ItemId, Mon } from '../types'
import { ELEMENT_COLOR, ELEMENT_NAME, SPECIES, speciesOf } from './data'
import { evoFrame, sparkle } from './evolution'
import {
  ITEMS, ITEM_ORDER, MAX_LEVEL, buy, expToNext, gainTokens, nameOf, newGame,
  setActive, tokensOf, useItem,
} from './game'
import type { Outcome } from './game'
import { sprite, spriteWidth } from './sprite'

const PANE = 'monster'
const STORE_KEY = 'game'
const WALK_MS = 400
const MESSAGE_MS = 5000

// 저장 형식이 바뀌면 shape 태그를 올린다: 예전 값은 null 로 읽힌다.
const gameAtom = atom({ plugin: 'token-monster', key: 'game' } as const, null, { shape: 'game-1' })
const tick = atom({ plugin: 'token-monster', key: 'tick' } as const, 0)
const selected = atom({ plugin: 'token-monster', key: 'selected' } as const, null)
const message = atom({ plugin: 'token-monster', key: 'message' } as const, '')
const isHidden = atom({ plugin: 'token-monster', key: 'isHidden' } as const, false)
const evolving = atom({ plugin: 'token-monster', key: 'evolving' } as const, null)

const loadGame = async ($: EngineInterface): Promise<Game> => {
  const stored = (await $.store.get(STORE_KEY)) as Game | undefined
  return stored ?? newGame()
}

/** 이번 변경에서 진화한 몬스터: 알이 아니었고, 종이 바뀐 것 */
const evolutionsOf = (before: Game, after: Game): Omit<Evolving, 'start'>[] =>
  after.party.flatMap(mon => {
    const old = before.party.find(m => m.uid === mon.uid)
    return old !== undefined && old.species >= 0 && old.species !== mon.species
      ? [{ uid: mon.uid, from: old.species, to: mon.species }]
      : []
  })

// 진행 상황의 정본은 $.store (여러 세션이 같이 쓴다). 매번 다시 읽고 고쳐 쓴다.
// 진화가 있었으면 입력칸 위 진화 연출을 시작한다(여럿이면 마지막 것).
const mutate = async ($: EngineInterface, change: (game: Game) => Outcome): Promise<string> => {
  const before = await loadGame($)
  const result = change(before)
  await $.store.set(STORE_KEY, result.game)
  await update($, gameAtom, () => result.game)
  const last = evolutionsOf(before, result.game).at(-1)
  if (last !== undefined) {
    const start = await read($, tick)
    await update($, evolving, () => ({ ...last, start }))
  }
  return result.message
}

const bar = (value: number, max: number, width: number): string => {
  const filled = max <= 0 ? 0 : Math.min(width, Math.floor((value / max) * width))
  return '#'.repeat(filled) + '-'.repeat(width - filled)
}

const GOLD = '#ffc400'

/** 이름 뒤에 붙는 부분. 알은 이름('알')까지 이 안에 든다. */
const detail = (mon: Mon): string => {
  if (mon.species < 0) return `알 · 깨어나기까지 토큰 ${Math.max(0, mon.hatchLeft).toLocaleString()}개`
  const exp = mon.level >= MAX_LEVEL ? 'MAX' : `[${bar(mon.exp, expToNext(mon.level), 10)}]`
  return ` Lv.${mon.level} ${exp}`
}

/** 전설은 이름을 금색으로 */
const nameColor = (mon: Mon): string | undefined =>
  mon.species >= 0 && speciesOf(mon.species).isLegendary ? GOLD : undefined

const speciesFor = (mon: Mon | undefined) => (mon === undefined || mon.species < 0 ? undefined : speciesOf(mon.species))

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'monster',
      description: '몬스터 가방·상점·도감을 엽니다',
    })
    const game = await loadGame($)
    await $.store.set(STORE_KEY, game)
    await update($, gameAtom, () => game)
    $.clock.every(WALK_MS, () => {
      void update($, tick, n => (n + 1) % 1_000_000)
    })
    return next(e)
  })

  on('command.run', { command: 'monster' }, async $ => {
    await update($, isHidden, () => false)
    await $.ui.open({ id: PANE, title: '몬스터' })
    return { text: '몬스터 가방을 열었습니다.' }
  })

  on('turn.complete', async ($, e, next) => {
    const usage = e.usage
    if (usage !== undefined) {
      const tokens = tokensOf(usage)
      let events: string[] = []
      await mutate($, game => {
        const result = gainTokens(game, tokens, Math.random)
        events = result.events
        return { game: result.game, message: '' }
      })
      for (const text of events) $.ui.toast(text)
    }
    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const game = await read($, gameAtom)
    if (e.props.hasSurvey || game === null || (await read($, isHidden))) return next(e)

    const { Box, Text, Button } = $.ui.resolve(e)
    const t = await read($, tick)

    // 진화 연출 중이면 걷기 대신 가운데에 멈춰서 연출을 그린다.
    const evo = await read($, evolving)
    if (evo !== null) {
      const from = speciesOf(evo.from)
      const to = speciesOf(evo.to)
      const k = t - evo.start
      const frame = evoFrame(k, from.name, to.name)
      if (frame !== undefined) {
        const shown = frame.showsTo ? to : from
        const body = sprite(shown, 0, false)
        const rows = frame.hasSparkles ? sparkle(body, k) : body
        const width = Math.max(...rows.map(r => r.length))
        const x = Math.max(0, Math.floor((e.props.bodyColumns - width) / 2))
        const color = frame.isGlowing ? '#ffffff' : ELEMENT_COLOR[shown.element]
        return (
          <Box flexDirection="column">
            {rows.map(row => (
              <Text color={color} bold={frame.isGlowing} wrap="truncate">
                {' '.repeat(x) + (row === '' ? ' ' : row)}
              </Text>
            ))}
            <Text bold color={frame.hasSparkles ? GOLD : undefined} wrap="truncate">
              {frame.text}
            </Text>
          </Box>
        )
      }
    }

    const mon = game.party.find(m => m.uid === game.activeUid) ?? game.party[0]
    if (mon === undefined) return next(e)
    const species = speciesFor(mon)

    const range = Math.max(0, e.props.bodyColumns - spriteWidth(species) - 1)
    const period = Math.max(1, range * 2)
    const phase = t % period
    const facingLeft = range > 0 && phase >= range
    const x = facingLeft ? period - phase : Math.min(phase, range)
    const color = species === undefined ? '#f5f5dc' : ELEMENT_COLOR[species.element]
    const rows = sprite(species, t, facingLeft)

    return (
      <Box flexDirection="column">
        {rows.map(row => (
          <Text color={color} wrap="truncate">
            {' '.repeat(x) + (row === '' ? ' ' : row)}
          </Text>
        ))}
        <Box flexDirection="row" gap={1}>
          <Box flexDirection="row">
            {mon.species >= 0 && (
              <Text color={nameColor(mon)} bold={nameColor(mon) !== undefined}>
                {nameOf(mon)}
              </Text>
            )}
            <Text wrap="truncate">
              {detail(mon)} · {game.coins.toLocaleString()}코인
            </Text>
          </Box>
          <Button key="bag" label="가방" plain onPress={() => void $.ui.open({ id: PANE, title: '몬스터' })} />
          <Button key="hide" label="숨기기" plain onPress={() => void update($, isHidden, () => true)} />
        </Box>
      </Box>
    )
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    const game = await read($, gameAtom)
    if (game === null) return <Text dimColor>불러오는 중...</Text>

    const pickedUid = await read($, selected)
    const picked = game.party.find(m => m.uid === pickedUid) ?? game.party.find(m => m.uid === game.activeUid)
    const pickedSpecies = speciesFor(picked)
    const note = await read($, message)
    const hidden = await read($, isHidden)

    const act = (change: (g: Game) => Outcome) => {
      void mutate($, change).then(async text => {
        await update($, message, () => text)
        // 5초 뒤 지운다. 그사이 다른 문구로 바뀌었으면 그 문구는 남긴다.
        $.clock.after(MESSAGE_MS, () => {
          void update($, message, current => (current === text ? '' : current))
        })
      })
    }

    return (
      <Box flexDirection="column" gap={1}>
        <Box flexDirection="column">
          <Text bold>
            {game.coins.toLocaleString()}코인 · 누적 토큰 {game.totalTokens.toLocaleString()} · 도감 {game.dex.length}/
            {SPECIES.length}
          </Text>
          {note !== '' && <Text color="#ffd54f">{note}</Text>}
          {hidden && (
            <Button key="show" label="입력칸 위에 다시 보이기" onPress={() => void update($, isHidden, () => false)} />
          )}
        </Box>

        <Box flexDirection="column">
          <Text bold>가방 속 몬스터 ({game.party.length})</Text>
          {game.party.map(mon => (
            <Button key={`mon-${mon.uid}`} plain onPress={() => void update($, selected, () => mon.uid)}>
              {mon.uid === picked?.uid ? '> ' : '  '}
              {mon.species >= 0 && (
                <Text color={nameColor(mon)} bold={nameColor(mon) !== undefined}>
                  {nameOf(mon)}
                </Text>
              )}
              {detail(mon)}
              {mon.uid === game.activeUid ? <Text dimColor> (함께 다니는 중)</Text> : ''}
            </Button>
          ))}
        </Box>

        {picked !== undefined && (
          <Box flexDirection="column">
            {sprite(pickedSpecies, 1, false).map(row => (
              <Text color={pickedSpecies === undefined ? '#f5f5dc' : ELEMENT_COLOR[pickedSpecies.element]}>
                {row === '' ? ' ' : row}
              </Text>
            ))}
            {pickedSpecies === undefined ? (
              <Text>{detail(picked)}</Text>
            ) : (
              <Box flexDirection="row">
                <Text>No.{String(pickedSpecies.id).padStart(3, '0')} </Text>
                <Text color={nameColor(picked)} bold={nameColor(picked) !== undefined}>
                  {pickedSpecies.name}
                </Text>
                <Text>
                  {` · ${ELEMENT_NAME[pickedSpecies.element]} 속성${pickedSpecies.isLegendary ? ' · 전설' : ''}`}
                </Text>
              </Box>
            )}
            {pickedSpecies !== undefined && pickedSpecies.evolutions.length > 0 && (
              <Text dimColor>
                진화:{' '}
                {pickedSpecies.evolutions
                  .map(evo => `${typeof evo.method === 'number' ? `Lv.${evo.method}` : ITEMS[evo.method].name} → ${speciesOf(evo.to).name}`)
                  .join(', ')}
              </Text>
            )}
            <Box flexDirection="row" gap={1} flexWrap="wrap">
              {picked.uid !== game.activeUid && (
                <Button key="walk" label="함께 다니기" variant="primary" onPress={() => act(g => setActive(g, picked.uid))} />
              )}
              {ITEM_ORDER.filter(id => id !== 'egg' && (game.items[id] ?? 0) > 0).map(id => (
                <Button
                  key={`use-${id}`}
                  label={`${ITEMS[id].name} 쓰기 (${game.items[id]})`}
                  onPress={() => act(g => useItem(g, picked.uid, id as ItemId))}
                />
              ))}
            </Box>
          </Box>
        )}

        <Box flexDirection="column">
          <Text bold>상점</Text>
          <Box flexDirection="row" gap={1} flexWrap="wrap">
            {ITEM_ORDER.map(id => (
              <Button key={`buy-${id}`} label={`${ITEMS[id].name} ${ITEMS[id].price}`} onPress={() => act(g => buy(g, id))} />
            ))}
          </Box>
          <Text dimColor>토큰 1,000개 = 1코인 · 토큰 100개 = 경험치 1 (cache read 는 1/10)</Text>
        </Box>
      </Box>
    )
  })
}
