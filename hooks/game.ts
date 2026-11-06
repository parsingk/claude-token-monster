import type { Game, ItemId, Mon } from '../types'
import { EGG_POOL, LEGENDS, STARTERS, speciesOf } from './data'

// 밸런스 값은 여기서만 바꾼다.
export const TOKENS_PER_COIN = 1000
export const TOKENS_PER_EXP = 100
export const STARTER_HATCH_TOKENS = 3000
export const EGG_HATCH_TOKENS = 20000
export const LEGEND_CHANCE = 0.01
export const MAX_LEVEL = 100

export const ITEMS: Record<ItemId, { name: string; price: number }> = {
  egg: { name: '알', price: 3000 },
  candy: { name: '성장사탕', price: 2000 },
  fire: { name: '불꽃돌', price: 5000 },
  water: { name: '물결돌', price: 5000 },
  thunder: { name: '번개돌', price: 5000 },
  leaf: { name: '새싹돌', price: 5000 },
  moon: { name: '달빛돌', price: 5000 },
  cord: { name: '연결끈', price: 8000 },
}

export const ITEM_ORDER: ItemId[] = ['egg', 'candy', 'fire', 'water', 'thunder', 'leaf', 'moon', 'cord']

/** level → level+1 에 필요한 경험치 */
export const expToNext = (level: number): number => 20 * level * level

export type Rand = () => number

const pick = (list: number[], rand: Rand): number =>
  list[Math.min(list.length - 1, Math.floor(rand() * list.length))] as number

const clone = (game: Game): Game => JSON.parse(JSON.stringify(game)) as Game

const newEgg = (game: Game, isStarter: boolean): Mon => ({
  uid: game.nextUid++,
  species: -1,
  level: 1,
  exp: 0,
  hatchLeft: isStarter ? STARTER_HATCH_TOKENS : EGG_HATCH_TOKENS,
  isStarter,
})

export const newGame = (): Game => {
  const game: Game = {
    coins: 0,
    coinCarry: 0,
    expCarry: 0,
    totalTokens: 0,
    party: [],
    activeUid: 0,
    nextUid: 1,
    items: {},
    dex: [],
  }
  const egg = newEgg(game, true)
  game.party.push(egg)
  game.activeUid = egg.uid
  return game
}

const see = (game: Game, id: number) => {
  if (!game.dex.includes(id)) game.dex.push(id)
}

export const nameOf = (mon: Mon): string => (mon.species < 0 ? '알' : speciesOf(mon.species).name)

const hatch = (game: Game, mon: Mon, rand: Rand): string => {
  mon.species = mon.isStarter
    ? pick(STARTERS, rand)
    : rand() < LEGEND_CHANCE
      ? pick(LEGENDS, rand)
      : pick(EGG_POOL, rand)
  mon.hatchLeft = 0
  see(game, mon.species)
  const species = speciesOf(mon.species)
  return species.isLegendary
    ? `알에서 전설의 ${species.name}이(가) 깨어났다!`
    : `알에서 ${species.name}이(가) 깨어났다!`
}

const evolveTo = (game: Game, mon: Mon, to: number): string => {
  const before = speciesOf(mon.species).name
  mon.species = to
  see(game, to)
  return `${before}이(가) ${speciesOf(to).name}(으)로 진화했다!`
}

const levelEvolve = (game: Game, mon: Mon): string[] => {
  const events: string[] = []
  for (;;) {
    const evo = speciesOf(mon.species).evolutions.find(
      e => typeof e.method === 'number' && mon.level >= e.method,
    )
    if (evo === undefined) return events
    events.push(evolveTo(game, mon, evo.to))
  }
}

const gainExp = (game: Game, mon: Mon, exp: number): string[] => {
  const events: string[] = []
  if (mon.level >= MAX_LEVEL) return events
  mon.exp += exp
  let grew = false
  while (mon.level < MAX_LEVEL && mon.exp >= expToNext(mon.level)) {
    mon.exp -= expToNext(mon.level)
    mon.level += 1
    grew = true
  }
  if (mon.level >= MAX_LEVEL) mon.exp = 0
  if (grew) events.push(`${nameOf(mon)}이(가) Lv.${mon.level}이(가) 됐다!`)
  return [...events, ...levelEvolve(game, mon)]
}

/** 한 turn 이 쓴 토큰을 코인·경험치·알 부화로 바꾼다 */
export const gainTokens = (
  before: Game,
  tokens: number,
  rand: Rand,
): { game: Game; events: string[] } => {
  const game = clone(before)
  const events: string[] = []
  if (tokens <= 0) return { game, events }

  game.totalTokens += tokens

  const coinTotal = game.coinCarry + tokens
  game.coins += Math.floor(coinTotal / TOKENS_PER_COIN)
  game.coinCarry = coinTotal % TOKENS_PER_COIN

  const expTotal = game.expCarry + tokens
  const exp = Math.floor(expTotal / TOKENS_PER_EXP)
  game.expCarry = expTotal % TOKENS_PER_EXP

  for (const mon of game.party) {
    if (mon.species >= 0) continue
    mon.hatchLeft -= tokens
    if (mon.hatchLeft <= 0) events.push(hatch(game, mon, rand))
  }

  const active = game.party.find(m => m.uid === game.activeUid)
  if (active !== undefined && active.species >= 0 && exp > 0) {
    events.push(...gainExp(game, active, exp))
  }
  return { game, events }
}

export type Outcome = { game: Game; message: string }

export const buy = (before: Game, item: ItemId): Outcome => {
  const game = clone(before)
  const { name, price } = ITEMS[item]
  if (game.coins < price) {
    return { game: before, message: `코인이 모자랍니다 (${name} ${price}코인, 보유 ${game.coins}코인)` }
  }
  game.coins -= price
  if (item === 'egg') {
    game.party.push(newEgg(game, false))
    return { game, message: `알을 샀습니다. 토큰 ${EGG_HATCH_TOKENS.toLocaleString()}개를 쓰면 깨어납니다.` }
  }
  game.items[item] = (game.items[item] ?? 0) + 1
  return { game, message: `${name}을(를) 샀습니다.` }
}

export const useItem = (before: Game, uid: number, item: ItemId): Outcome => {
  const game = clone(before)
  const mon = game.party.find(m => m.uid === uid)
  const { name } = ITEMS[item]
  if ((game.items[item] ?? 0) <= 0) return { game: before, message: `${name}이(가) 없습니다.` }
  if (mon === undefined || mon.species < 0) {
    return { game: before, message: '알에는 아이템을 쓸 수 없습니다.' }
  }

  if (item === 'candy') {
    if (mon.level >= MAX_LEVEL) return { game: before, message: '이미 최고 레벨입니다.' }
    game.items.candy = (game.items.candy ?? 0) - 1
    mon.level += 1
    mon.exp = 0
    const events = [`${nameOf(mon)}이(가) Lv.${mon.level}이(가) 됐다!`, ...levelEvolve(game, mon)]
    return { game, message: events.join(' ') }
  }

  const evo = speciesOf(mon.species).evolutions.find(e => e.method === item)
  if (evo === undefined) {
    return { game: before, message: `${nameOf(mon)}에게 ${name}은(는) 효과가 없습니다.` }
  }
  game.items[item] = (game.items[item] ?? 0) - 1
  return { game, message: evolveTo(game, mon, evo.to) }
}

export const setActive = (before: Game, uid: number): Outcome => {
  const mon = before.party.find(m => m.uid === uid)
  if (mon === undefined) return { game: before, message: '그 몬스터가 없습니다.' }
  return { game: { ...before, activeUid: uid }, message: `${nameOf(mon)}이(가) 함께 다닙니다.` }
}

/** turn 사용량을 토큰 수로. cache read 는 싸므로 1/10 만 친다. */
export const tokensOf = (usage: {
  input_tokens: number
  output_tokens: number
  cache_creation_input_tokens: number
  cache_read_input_tokens: number
}): number =>
  usage.input_tokens +
  usage.output_tokens +
  usage.cache_creation_input_tokens +
  Math.floor(usage.cache_read_input_tokens / 10)
