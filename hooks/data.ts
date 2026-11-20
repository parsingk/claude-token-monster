// 몬스터 151마리. 이름과 모습은 전부 이 mod 를 위해 새로 지은 것이다.
// 진화 방법: 숫자 = 그 레벨, 'fire' | 'water' | 'thunder' | 'leaf' | 'moon' = 그 돌, 'cord' = 연결끈.

export type Element =
  | 'normal' | 'fire' | 'water' | 'electric' | 'grass' | 'ice' | 'fighting' | 'poison'
  | 'ground' | 'flying' | 'psychic' | 'bug' | 'rock' | 'ghost' | 'dragon'

export type EvoMethod = number | 'fire' | 'water' | 'thunder' | 'leaf' | 'moon' | 'cord'

export type Species = {
  id: number
  name: string
  element: Element
  stage: 1 | 2 | 3
  isLegendary: boolean
  evolutions: { method: EvoMethod; to: number }[]
}

type Chain = (string | EvoMethod)[]
type Branch = { base: string; to: Partial<Record<'fire' | 'water' | 'thunder', string>> }
type Family = {
  element: Element
  chain: Chain | Branch
  isLegendary?: true
}

const f = (element: Element, ...chain: Chain): Family => ({ element, chain })

const FAMILIES: Family[] = [
  // 시작 몬스터 4계열 (풀·불·물·전기)
  f('grass', '새싹뿔', 16, '덩굴뿔', 32, '고목뿔'),
  f('fire', '불씨룡', 16, '화염룡', 36, '폭염룡'),
  f('water', '물방울게', 16, '파도게', 36, '해일게'),
  f('electric', '찌릿여우', 16, '번개여우', 36, '천둥여우'),

  // 3단 진화
  f('bug', '꼬물실', 7, '고치실', 10, '비단나방'),
  f('poison', '침꼬마', 7, '껍질침', 10, '독창말벌'),
  f('flying', '깃털콩', 18, '바람깃', 36, '폭풍깃'),
  f('grass', '꽃망울', 21, '꽃봉오', 'leaf', '만개화'),
  f('poison', '독방울', 21, '늪방울', 'moon', '독안개'),
  f('water', '올챙이공', 25, '개구공', 'water', '해구공'),
  f('psychic', '졸음요정', 16, '꿈요정', 'cord', '몽환요정'),
  f('fighting', '주먹곰', 28, '권투곰', 'cord', '철권곰'),
  f('rock', '자갈이', 25, '바윗돌', 'cord', '산맥돌'),
  f('ghost', '그림자불', 25, '어둠불', 'cord', '망령불'),
  f('grass', '씨앗콩', 21, '덩굴콩', 'leaf', '대나무콩'),
  f('water', '물고기알', 20, '은지느러미', 30, '대해어'),
  f('dragon', '아기비늘', 30, '용비늘', 55, '천룡비늘'),
  f('normal', '솜뭉치', 'moon', '구름솜', 'cord', '하늘솜'),

  // 2단 진화
  f('normal', '들쥐콩', 20, '들쥐왕'),
  f('flying', '참깃새', 20, '매깃새'),
  f('poison', '독줄뱀', 22, '독왕뱀'),
  f('ground', '모래도마', 22, '사막도마'),
  f('electric', '전구알', 'thunder', '번개구'),
  f('psychic', '별토끼', 'moon', '달토끼'),
  f('fire', '불꼬리', 'fire', '화염꼬리'),
  f('normal', '노래솜', 'moon', '합창솜'),
  f('flying', '동굴날개', 22, '어둠날개'),
  f('bug', '버섯벌레', 24, '버섯왕벌레'),
  f('bug', '더듬이', 31, '나방더듬'),
  f('ground', '땅파개', 26, '굴착개'),
  f('normal', '동전너구리', 28, '금고너구리'),
  f('water', '멍물방울', 33, '꿈물방울'),
  f('fighting', '성난주먹', 28, '분노주먹'),
  f('fire', '화로돌', 'fire', '용광돌'),
  f('water', '거품물고기', 'water', '소용돌이어'),
  f('psychic', '수정알', 'cord', '수정왕'),
  f('water', '해파리방', 30, '해파리왕'),
  f('fire', '불갈기말', 40, '화염갈기'),
  f('water', '느림보물', 37, '느림보왕'),
  f('electric', '자석돌', 30, '자석탑'),
  f('flying', '깡총새', 31, '타조새'),
  f('ice', '서리펭귄', 34, '빙하펭귄'),
  f('poison', '녹슨깡통', 38, '고철깡통'),
  f('water', '소라집', 30, '나선소라'),
  f('psychic', '시계요정', 26, '시간요정'),
  f('water', '수달꼬마', 28, '수달대장'),
  f('electric', '찌릿장어', 30, '뇌전장어'),
  f('grass', '도토리꼬마', 'leaf', '참나무거인'),
  f('ground', '공굴리', 28, '갑옷굴리'),
  f('poison', '독버섯', 35, '독균왕'),
  f('ground', '진흙거북', 42, '대지거북'),
  f('water', '복어방울', 32, '가시복어'),
  f('water', '문어발', 33, '대왕문어'),
  f('water', '산호꼬마', 'water', '산호여왕'),
  f('water', '메기콩', 20, '수염메기'),

  // 돌에 따라 갈래가 나뉘는 계열
  {
    element: 'normal',
    chain: { base: '변신젤리', to: { fire: '불꽃젤리', water: '물결젤리', thunder: '번개젤리' } },
  },

  // 진화하지 않는 몬스터
  f('rock', '수호석상'),
  f('psychic', '거울요정'),
  f('normal', '철갑코끼리'),
  f('water', '등불물고기'),
  f('flying', '바람연'),
  f('electric', '번개고슴도치'),
  f('grass', '선인장무사'),
  f('fire', '용암두꺼비'),
  f('ice', '얼음늑대'),
  f('normal', '네잎토끼'),
  f('rock', '수정가재'),
  f('ground', '모래뱀'),
  f('ghost', '그림자고양이'),
  f('bug', '쇳물거미'),

  // 전설 (알에서 드물게만 나온다)
  { ...f('fire', '태양사자'), isLegendary: true },
  { ...f('water', '월광고래'), isLegendary: true },
  { ...f('electric', '뇌운룡'), isLegendary: true },
  { ...f('grass', '고대수목'), isLegendary: true },
  { ...f('psychic', '환상별'), isLegendary: true },
]

const build = (): Species[] => {
  const list: Species[] = []
  const add = (family: Family, name: string, stage: 1 | 2 | 3): Species => {
    const species: Species = {
      id: list.length + 1,
      name,
      element: family.element,
      stage,
      isLegendary: family.isLegendary === true,
      evolutions: [],
    }
    list.push(species)
    return species
  }

  for (const family of FAMILIES) {
    const chain = family.chain
    if (!Array.isArray(chain)) {
      const base = add(family, chain.base, 1)
      for (const [stone, name] of Object.entries(chain.to)) {
        const next = add(family, name, 2)
        base.evolutions.push({ method: stone as EvoMethod, to: next.id })
      }
      continue
    }
    let prev = add(family, String(chain[0]), 1)
    for (let i = 1; i + 1 < chain.length; i += 2) {
      const next = add(family, String(chain[i + 1]), (prev.stage + 1) as 2 | 3)
      prev.evolutions.push({ method: chain[i] as EvoMethod, to: next.id })
      prev = next
    }
  }
  return list
}

export const SPECIES: Species[] = build()

export const speciesOf = (id: number): Species => SPECIES[id - 1] as Species

/** 첫 알에서 나오는 4마리: 풀·불·물·전기 계열의 첫 단계 */
export const STARTERS: number[] = SPECIES.filter(
  s => s.stage === 1 && ['새싹뿔', '불씨룡', '물방울게', '찌릿여우'].includes(s.name),
).map(s => s.id)

/** 알에서 나올 수 있는 진화 전 단계 몬스터 (전설 제외) */
export const EGG_POOL: number[] = SPECIES.filter(s => s.stage === 1 && !s.isLegendary).map(s => s.id)

export const LEGENDS: number[] = SPECIES.filter(s => s.isLegendary).map(s => s.id)

export const ELEMENT_NAME: Record<Element, string> = {
  normal: '노말', fire: '불', water: '물', electric: '전기', grass: '풀', ice: '얼음',
  fighting: '격투', poison: '독', ground: '땅', flying: '비행', psychic: '에스퍼',
  bug: '벌레', rock: '바위', ghost: '고스트', dragon: '드래곤',
}
