import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Evolving, Game, ItemId, Mon } from '../types'
import { ELEMENT_COLOR, ELEMENT_NAME, SPECIES, speciesOf } from './data'
import { evoFrame, sparkle } from './evolution'
import {
  ITEMS, ITEM_ORDER, MAX_LEVEL, buy, canRelease, expToNext, gainTokens, nameOf, newGame,
  release, setActive, tokensOf, useItem,
} from './game'
import type { Outcome } from './game'
import { MIN_SHOWN, buttonCells, cells, clamp, flowRows, listStep, listWindow, textRows } from './layout'
import { sprite, spriteWidth } from './sprite'

const PANE = 'monster'
const STORE_KEY = 'game'
const WALK_MS = 400
const MESSAGE_MS = 5000
// 가방에 그리는 글자. 그릴 때와 줄 수를 셀 때 같은 글자를 쓴다.
const SHOP = '상점'
const RATE_HINT = '토큰 1,000개 = 1코인 · 토큰 100개 = 경험치 1 (cache read 는 1/10)'
const WALK = '함께 다니기'
const RELEASE = '내보내기'
const RELEASE_YES = '정말 내보내기 (되돌릴 수 없음)'
const RELEASE_NO = '취소'
const UP = '▲'
const DOWN = '▼'

// 저장 형식이 바뀌면 shape 태그를 올린다: 예전 값은 null 로 읽힌다.
const gameAtom = atom({ plugin: 'token-monster', key: 'game' } as const, null, { shape: 'game-1' })
const tick = atom({ plugin: 'token-monster', key: 'tick' } as const, 0)
const selected = atom({ plugin: 'token-monster', key: 'selected' } as const, null)
const message = atom({ plugin: 'token-monster', key: 'message' } as const, '')
const isHidden = atom({ plugin: 'token-monster', key: 'isHidden' } as const, false)
const evolving = atom({ plugin: 'token-monster', key: 'evolving' } as const, null)
const listTop = atom({ plugin: 'token-monster', key: 'listTop' } as const, null)
const releasing = atom({ plugin: 'token-monster', key: 'releasing' } as const, null)

// 가방에 마지막으로 그린 목록 창. ui.scroll 이 이걸 보고 목록만 움직인다.
//   top·count·total = 몇 번째부터 몇 마리를 보여 줬는지 / firstRow = 목록 첫 줄 / offset = 가방 전체가 스크롤된 줄
let shown = { top: 0, count: 0, total: 0, firstRow: 0, offset: 0 }

/** 가방을 연다. 목록은 고른 몬스터가 보이는 자리에서 다시 시작한다. */
const openBag = async ($: EngineInterface) => {
  await update($, listTop, () => null)
  await update($, releasing, () => null)
  return $.ui.open({ id: PANE, title: '몬스터' })
}

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

/** 가지고 있어서 몬스터에게 쓸 수 있는 아이템 (알은 쓰는 것이 아니다) */
const usableItems = (game: Game): ItemId[] => ITEM_ORDER.filter(id => id !== 'egg' && (game.items[id] ?? 0) > 0)

const useLabel = (game: Game, id: ItemId): string => `${ITEMS[id].name} 쓰기 (${game.items[id] ?? 0})`

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
    await openBag($)
    return { text: '몬스터 가방을 열었습니다.' }
  })

  // 가방 위에서 휠을 굴리면 가방 전체가 아니라 몬스터 목록만 움직인다.
  // 목록이 끝에 닿았거나, 가방이 화면보다 길 때 목록 밖에서 굴린 것은 엔진(가방 전체 스크롤)에 넘긴다.
  on('ui.scroll', { requestId: PANE }, async ($, e, next) => {
    const maxTop = shown.total - shown.count
    if (e.component !== 'Pane' || maxTop <= 0) return next(e)

    const isBagFitting = e.contentRows <= e.bodyRows
    const row = e.pointer === undefined ? undefined : shown.offset + e.pointer.row
    const isOverList = row === undefined || (row >= shown.firstRow && row < shown.firstRow + shown.count)
    if (!isBagFitting && !isOverList) return next(e)

    const top = clamp((await read($, listTop)) ?? shown.top, 0, maxTop)
    const moved = clamp(top + listStep(e.by, e.bodyRows, shown.count, shown.total), 0, maxTop)
    if (moved === top) return isBagFitting ? {} : next(e)
    await update($, listTop, () => moved)
    return {}
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
          <Button key="bag" label="가방" plain onPress={() => void openBag($)} />
          <Button key="hide" label="숨기기" plain onPress={() => void update($, isHidden, () => true)} />
        </Box>
      </Box>
    )
  })

  // 가방. 위에서부터: 코인·상점(고정) → 몬스터 목록(여기만 스크롤) → 고른 몬스터(고정).
  // 전체가 가방 높이(bodyRows) 안에 들어가도록 목록에 보여 줄 마릿수를 정한다.
  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    const game = await read($, gameAtom)
    if (game === null) return <Text dimColor>불러오는 중...</Text>

    const columns = e.props.bodyColumns
    const pickedUid = await read($, selected)
    const picked = game.party.find(m => m.uid === pickedUid) ?? game.party.find(m => m.uid === game.activeUid)
    const pickedSpecies = speciesFor(picked)
    const note = await read($, message)
    const hidden = await read($, isHidden)
    const isAsking = picked !== undefined && (await read($, releasing)) === picked.uid
    const wantedTop = await read($, listTop)

    const act = (change: (g: Game) => Outcome) => {
      void mutate($, change).then(async text => {
        await update($, message, () => text)
        // 5초 뒤 지운다. 그사이 다른 문구로 바뀌었으면 그 문구는 남긴다.
        $.clock.after(MESSAGE_MS, () => {
          void update($, message, current => (current === text ? '' : current))
        })
      })
    }

    // 그릴 글자를 먼저 정한다. 같은 글자로 줄 수도 세기 때문이다.
    const total = game.party.length
    const title = `가방 속 몬스터 (${total})`
    const buys = ITEM_ORDER.map(id => ({ id, label: `${ITEMS[id].name} ${ITEMS[id].price}` }))
    const body = sprite(pickedSpecies, 1, false)
    const evoText =
      pickedSpecies === undefined || pickedSpecies.evolutions.length === 0
        ? ''
        : `진화: ${pickedSpecies.evolutions
            .map(evo => `${typeof evo.method === 'number' ? `Lv.${evo.method}` : ITEMS[evo.method].name} → ${speciesOf(evo.to).name}`)
            .join(', ')}`
    const isReleasable = picked !== undefined && canRelease(game, picked.uid)
    const actionLabels =
      picked === undefined
        ? []
        : isAsking
          ? [RELEASE_YES, RELEASE_NO]
          : [
              ...(picked.uid !== game.activeUid ? [WALK] : []),
              ...usableItems(game).map(id => useLabel(game, id)),
              ...(isReleasable ? [RELEASE] : []),
            ]

    // 목록에 줄 수 있는 줄 수 = 가방 높이 - (위쪽 코인·상점 + 아래쪽 고른 몬스터).
    // 넉넉한 배치로 MIN_SHOWN 마리도 못 보여 주면 빈 줄·환율 안내·몬스터 그림을 뺀 촘촘한 배치로 바꾼다.
    const shopRows = flowRows([cells(SHOP), ...buys.map(b => buttonCells(b.label))], columns)
    const titleRows = flowRows([cells(title), buttonCells(UP), buttonCells(DOWN), cells(`${total}–${total}번째`)], columns)
    const rowsOf = (isTight: boolean) => {
      const gap = isTight ? 0 : 1
      const noteRows = note !== '' ? textRows(note, columns) : isTight ? 0 : textRows(RATE_HINT, columns)
      const first = 1 + shopRows + noteRows + (hidden ? 1 : 0) + gap + titleRows
      const below =
        picked === undefined
          ? 0
          : gap +
            (isTight ? 0 : body.length) +
            1 +
            (evoText === '' ? 0 : textRows(evoText, columns)) +
            flowRows(actionLabels.map(buttonCells), columns)
      return { first, room: e.props.scroll.bodyRows - first - below }
    }
    const roomy = rowsOf(false)
    const isTight = roomy.room < Math.min(total, MIN_SHOWN)
    const { first: firstRow, room } = isTight ? rowsOf(true) : roomy
    const win = listWindow(total, room)
    const maxTop = total - win.count
    // 한 번도 움직이지 않았으면 고른 몬스터가 가운데쯤 보이는 자리에서 시작한다
    const pickedIndex = picked === undefined ? 0 : game.party.indexOf(picked)
    const top = clamp(wantedTop ?? pickedIndex - Math.floor(win.count / 2), 0, maxTop)
    const page = Math.max(1, win.count - 1)
    shown = { top, count: win.count, total, firstRow, offset: e.props.scroll.offset }

    const moveList = (by: number) => void update($, listTop, () => clamp(top + by, 0, maxTop))
    // 몬스터를 고르거나 내보내도 목록이 제자리에 있도록 지금 자리를 붙잡아 둔다
    const holdList = () => void update($, listTop, () => top)
    const stopAsking = () => void update($, releasing, () => null)

    return (
      <Box flexDirection="column" gap={isTight ? 0 : 1}>
        <Box flexDirection="column">
          <Text bold wrap="truncate">
            {game.coins.toLocaleString()}코인 · 누적 토큰 {game.totalTokens.toLocaleString()} · 도감 {game.dex.length}/
            {SPECIES.length}
          </Text>
          <Box flexDirection="row" columnGap={1} flexWrap="wrap">
            <Text bold>{SHOP}</Text>
            {buys.map(b => (
              <Button key={`buy-${b.id}`} label={b.label} onPress={() => act(g => buy(g, b.id))} />
            ))}
          </Box>
          {note !== '' ? <Text color="#ffd54f">{note}</Text> : !isTight && <Text dimColor>{RATE_HINT}</Text>}
          {hidden && (
            <Button key="show" label="입력칸 위에 다시 보이기" onPress={() => void update($, isHidden, () => false)} />
          )}
        </Box>

        <Box flexDirection="column">
          <Box flexDirection="row" columnGap={1} flexWrap="wrap">
            <Text bold>{title}</Text>
            {win.isCut && <Button key="list-up" label={UP} dimColor={top === 0} onPress={() => moveList(-page)} />}
            {win.isCut && <Button key="list-down" label={DOWN} dimColor={top === maxTop} onPress={() => moveList(page)} />}
            {win.isCut && (
              <Text dimColor>
                {top + 1}–{top + win.count}번째
              </Text>
            )}
          </Box>
          {game.party.slice(top, top + win.count).map(mon => (
            <Button
              key={`mon-${mon.uid}`}
              plain
              onPress={() => {
                holdList()
                stopAsking()
                void update($, selected, () => mon.uid)
              }}
            >
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
            {!isTight &&
              body.map(row => (
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
            {evoText !== '' && <Text dimColor>{evoText}</Text>}
            {isAsking ? (
              // 내보내기는 되돌릴 수 없으므로 한 번 더 묻는다
              <Box flexDirection="row" columnGap={1} flexWrap="wrap">
                <Button
                  key="release-yes"
                  label={RELEASE_YES}
                  onPress={() => {
                    holdList()
                    stopAsking()
                    act(g => release(g, picked.uid))
                  }}
                />
                <Button key="release-no" label={RELEASE_NO} onPress={stopAsking} />
              </Box>
            ) : (
              <Box flexDirection="row" columnGap={1} flexWrap="wrap">
                {picked.uid !== game.activeUid && (
                  <Button key="walk" label={WALK} variant="primary" onPress={() => act(g => setActive(g, picked.uid))} />
                )}
                {usableItems(game).map(id => (
                  <Button key={`use-${id}`} label={useLabel(game, id)} onPress={() => act(g => useItem(g, picked.uid, id))} />
                ))}
                {isReleasable && (
                  <Button key="release" label={RELEASE} onPress={() => void update($, releasing, () => picked.uid)} />
                )}
              </Box>
            )}
          </Box>
        )}
      </Box>
    )
  })
}
