import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Evolving, Game, ItemId, Mon } from '../types'
import { ELEMENT_NAME, SPECIES, speciesOf } from './data'
import { artOf } from './art'
import type { Art } from './art/types'
import { evoFrame, sparkleSides } from './evolution'
import {
  ITEMS, ITEM_ORDER, MAX_LEVEL, buy, canRelease, expToNext, gainTokens, nameOf, newGame,
  release, releaseSpares, setActive, spares, tokensOf, useItem,
} from './game'
import type { Outcome } from './game'
import {
  MIN_SHOWN, PICTURE_GAP, buttonCells, cells, clamp, flowRows, infoRowsOf, listStep, listWindow, pickedLayout, textRows,
} from './layout'
import { halfBlocks, standRows, svgOf, walkRows, widthOf } from './pixels'
import type { Pose } from './pixels'

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

type Els = ReturnType<EngineInterface['ui']['resolve']>
type PictureOptions = {
  key?: string
  /** Svg 로 그릴지. 시험용 엔진은 터미널의 표에도 Svg 를 넣어 두므로 `'Svg' in els` 만 보지 말고 surface 도 함께 보고 정한다. */
  isVector: boolean
  /** Svg 를 못 보는 쪽에 읽어 줄 말 */
  alt?: string
  /** 그림 앞의 빈 칸 수 (걷는 자리, 가운데 맞추기) */
  indent?: number
  /** 그림 줄 양옆에 붙는 글자 (줄 번호 → [왼쪽, 오른쪽]) */
  sides?: (row: number) => [string, string]
  sideColor?: string
}

/** 점 그림을 그린다. 터미널(Svg 가 없는 표)은 줄마다 Text 하나, 그 밖에는 Svg 하나. 돌려주는 상자의 바로 아래 자식이 그림 줄이다. */
const picture = (els: Els, art: Art, pose: Pose, options: PictureOptions) => {
  const { Box, Text } = els
  const { key, isVector, alt = '몬스터', indent = 0, sides, sideColor } = options
  const gap = indent > 0 ? ' '.repeat(indent) : ''

  if (isVector && 'Svg' in els) {
    const { Svg } = els
    const { source, width, height } = svgOf(art, { ...pose, tint: pose.tint === undefined ? undefined : '#ffffff' })
    const [left, right] = sides?.(0) ?? ['', '']
    return (
      <Box key={key} flexDirection="column">
        <Box flexDirection="row">
          {gap !== '' && <Text>{gap}</Text>}
          {left !== '' && <Text color={sideColor}>{left}</Text>}
          <Svg source={source} width={width} height={height} alt={alt} />
          {right !== '' && <Text color={sideColor}>{right}</Text>}
        </Box>
      </Box>
    )
  }

  return (
    <Box key={key} flexDirection="column">
      {halfBlocks(art, pose).map((runs, row) => {
        const [left, right] = sides?.(row) ?? ['', '']
        return (
          <Text wrap="truncate">
            {gap}
            {left !== '' && <Text color={sideColor}>{left}</Text>}
            {runs.map(run => (
              <Text color={run.color} backgroundColor={run.backgroundColor}>
                {run.text}
              </Text>
            ))}
            {right !== '' && <Text color={sideColor}>{right}</Text>}
          </Text>
        )
      })}
    </Box>
  )
}

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

    const els = $.ui.resolve(e)
    const { Box, Text, Button } = els
    const isVector = 'Svg' in els && e.surface !== 'terminal'
    const t = await read($, tick)

    // 진화 연출 중이면 걷기 대신 가운데에 멈춰서 연출을 그린다.
    const evo = await read($, evolving)
    if (evo !== null) {
      const from = speciesOf(evo.from)
      const to = speciesOf(evo.to)
      const k = t - evo.start
      const frame = evoFrame(k, from.name, to.name)
      if (frame !== undefined) {
        const art = artOf((frame.showsTo ? to : from).name, t)
        // 진화 전후 중 큰 쪽에 줄 수를 맞춘다: 모습이 바뀌어도 높이가 흔들리지 않는다
        const rows = Math.max(walkRows(artOf(from.name, t)), walkRows(artOf(to.name, t)))
        const x = Math.max(0, Math.floor((e.props.bodyColumns - widthOf(art)) / 2))
        // 축하 때는 그림 왼쪽에 반짝이 글자가 붙는다. 그만큼 앞의 빈 칸을 줄여 그림이 옆으로 밀리지 않게 한다.
        const sideCells = frame.hasSparkles ? cells(sparkleSides(0, k)[0]) : 0
        return (
          <Box flexDirection="column">
            {e.props.maxRows >= rows + 1 &&
              picture(
                els,
                art,
                { rows, lift: 0, tint: frame.isGlowing ? ('text' as const) : undefined },
                {
                  key: 'walker',
                  isVector,
                  alt: (frame.showsTo ? to : from).name,
                  indent: Math.max(0, x - sideCells),
                  sides: frame.hasSparkles ? row => sparkleSides(row, k) : undefined,
                  sideColor: GOLD,
                },
              )}
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

    const art = artOf(species?.name, t)
    // 알은 바로 선 모습과 기운 모습(4 tick 에 한 번, 1칸 넓다)을 번갈아 그린다.
    // 걷는 범위와 줄 수는 두 모습 중 큰 쪽으로 고정한다: 모습마다 다시 재면 걷는 자리가 튄다.
    const frames = species === undefined ? [artOf(undefined, 0), artOf(undefined, 1)] : [art]
    // 몬스터는 1점 뜰 자리까지 쓰고, 알은 뜨지 않으므로 서 있는 줄 수만 쓴다(맨 위에 빈 줄이 생기지 않게)
    const rows = species === undefined ? Math.max(...frames.map(standRows)) : walkRows(art)
    const range = Math.max(0, e.props.bodyColumns - Math.max(...frames.map(widthOf)) - 1)
    const period = Math.max(1, range * 2)
    const phase = t % period
    const facingLeft = range > 0 && phase >= range
    const x = facingLeft ? period - phase : Math.min(phase, range)
    // 몬스터는 한 tick 걸러 1점 뜨며 걷는다. 알은 뜨지 않는다.
    const lift = species === undefined ? 0 : t % 2
    // 그림과 상태 줄이 들어갈 자리가 모자라면 상태 줄만 그린다
    const hasRoom = e.props.maxRows >= rows + 1

    return (
      <Box flexDirection="column">
        {hasRoom &&
          picture(els, art, { isMirrored: facingLeft, lift, rows }, { key: 'walker', isVector, alt: species?.name ?? '알', indent: x })}
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
    const els = $.ui.resolve(e)
    const { Box, Text, Button } = els
    const isVector = 'Svg' in els && e.surface !== 'terminal'
    const game = await read($, gameAtom)
    if (game === null) return <Text dimColor>불러오는 중...</Text>

    const columns = e.props.bodyColumns
    const pickedUid = await read($, selected)
    const picked = game.party.find(m => m.uid === pickedUid) ?? game.party.find(m => m.uid === game.activeUid)
    const pickedSpecies = speciesFor(picked)
    const note = await read($, message)
    const hidden = await read($, isHidden)
    const asked = await read($, releasing)
    const isAsking = picked !== undefined && asked === picked.uid
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
    // 알은 기울지 않은 그림(1)을 쓴다
    const art = artOf(pickedSpecies?.name, 1)
    const pictureRows = standRows(art)
    // 고른 몬스터의 첫 줄: "No.### 이름 · 속성 · 전설", 알은 알 줄. 그릴 때는 이름에만 색을 입힌다.
    const numberText = pickedSpecies === undefined ? '' : `No.${String(pickedSpecies.id).padStart(3, '0')} `
    const kindText =
      pickedSpecies === undefined
        ? ''
        : ` · ${ELEMENT_NAME[pickedSpecies.element]} 속성${pickedSpecies.isLegendary ? ' · 전설' : ''}`
    const nameLine =
      picked === undefined ? '' : pickedSpecies === undefined ? detail(picked) : numberText + pickedSpecies.name + kindText
    const evoText =
      pickedSpecies === undefined || pickedSpecies.evolutions.length === 0
        ? ''
        : `진화: ${pickedSpecies.evolutions
            .map(evo => `${typeof evo.method === 'number' ? `Lv.${evo.method}` : ITEMS[evo.method].name} → ${speciesOf(evo.to).name}`)
            .join(', ')}`
    const isReleasable = picked !== undefined && canRelease(game, picked.uid)
    // 중복된 Lv.1 몬스터를 한 번에 내보내는 버튼은 그런 몬스터가 있을 때만 제목 줄에 나온다
    const spareCount = spares(game).length
    const sparesLabel = `중복 Lv.1 ${spareCount}마리 내보내기`
    const isAskingSpares = asked === 'spares' && spareCount > 0
    const sparesAsk = `중복된 Lv.1 몬스터 ${spareCount}마리를 내보냅니다. 종마다 레벨이 가장 높은 한 마리는 남습니다.`
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
    const askRows = isAskingSpares
      ? textRows(sparesAsk, columns) + flowRows([buttonCells(RELEASE_YES), buttonCells(RELEASE_NO)], columns)
      : 0
    // 제목 줄: 목록이 잘릴 때만 ▲ ▼ 와 "몇 번째" 가 붙는다
    const titleRowsOf = (isCut: boolean) =>
      flowRows(
        [
          cells(title),
          ...(isCut ? [buttonCells(UP), buttonCells(DOWN), cells(`${total}–${total}번째`)] : []),
          ...(spareCount > 0 ? [buttonCells(sparesLabel)] : []),
        ],
        columns,
      )
    const actionWidths = actionLabels.map(buttonCells)
    // 고른 몬스터 부분: 넉넉하면 그림과 함께(나란히 또는 쌓아서), 촘촘하면 그림 없이 전체 폭
    const layout = pickedLayout({ columns, pictureColumns: widthOf(art), pictureRows, nameLine, evoText, actionWidths })
    const tightRows = infoRowsOf({ nameLine, evoText, actionWidths }, columns)
    const rowsOf = (isTight: boolean, isCut: boolean) => {
      const gap = isTight ? 0 : 1
      const noteRows = note !== '' ? textRows(note, columns) : isTight ? 0 : textRows(RATE_HINT, columns)
      const first = 1 + shopRows + noteRows + (hidden ? 1 : 0) + gap + titleRowsOf(isCut) + askRows
      const below = picked === undefined ? 0 : gap + (isTight ? tightRows : layout.rows)
      return { first, room: e.props.scroll.bodyRows - first - below }
    }
    const fit = (isTight: boolean) => {
      const whole = rowsOf(isTight, false)
      return listWindow(total, whole.room).isCut ? rowsOf(isTight, true) : whole
    }
    const roomy = fit(false)
    const isTight = roomy.room < Math.min(total, MIN_SHOWN)
    const { first: firstRow, room } = isTight ? fit(true) : roomy
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
            {spareCount > 0 && (
              <Button
                key="release-spares"
                label={sparesLabel}
                onPress={() => {
                  holdList()
                  void update($, releasing, () => 'spares' as const)
                }}
              />
            )}
          </Box>
          {/* 확인 줄은 제목 줄 아래에 따로 둔다: 같은 자리를 두 번 눌러도 내보내지지 않게 */}
          {isAskingSpares && <Text color="#ffd54f">{sparesAsk}</Text>}
          {isAskingSpares && (
            <Box flexDirection="row" columnGap={1} flexWrap="wrap">
              <Button
                key="release-spares-yes"
                label={RELEASE_YES}
                onPress={() => {
                  holdList()
                  stopAsking()
                  act(releaseSpares)
                }}
              />
              <Button key="release-spares-no" label={RELEASE_NO} onPress={stopAsking} />
            </Box>
          )}
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
          <Box key="picked" flexDirection={!isTight && layout.isSideBySide ? 'row' : 'column'} columnGap={PICTURE_GAP}>
            {!isTight && (
              <Box flexShrink={0}>
                {picture(els, art, { lift: 0, rows: pictureRows }, { key: 'picture', isVector, alt: pickedSpecies?.name ?? '알' })}
              </Box>
            )}
            <Box flexDirection="column" flexGrow={1}>
              {/* 글 한 줄(Text 하나)로 그린다: 칸이 좁으면 이름 안이 아니라 낱말 사이에서 줄이 바뀐다 */}
              {pickedSpecies === undefined ? (
                <Text>{nameLine}</Text>
              ) : (
                <Text>
                  {numberText}
                  <Text color={nameColor(picked)} bold={nameColor(picked) !== undefined}>
                    {pickedSpecies.name}
                  </Text>
                  {kindText}
                </Text>
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
          </Box>
        )}
      </Box>
    )
  })
}
