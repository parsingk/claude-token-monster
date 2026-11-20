# 몬스터 점 그림(픽셀아트) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 151마리와 알을 문자 그림에서, 한 마리마다 따로 그린 점 그림으로 바꾼다.

**Architecture:** 그림은 `hooks/art/` 의 순수한 자료(색 이름표 + 점 줄)다. `hooks/pixels.ts` 가 그 자료를
터미널용 반칸 블록(`▀▄` + 글자색·바탕색)이나 그 밖의 surface 용 `Svg` 로 바꾼다.
`hooks/register.tsx` 의 입력칸 위·가방은 이 변환 결과만 그린다.

**Tech Stack:** Claude Code mod (`claude-code` hooks module, JSX `Box`/`Text`/`Button`/`Svg`), TypeScript,
테스트는 `claude-code/testing`, 미리보기 도구는 Node 24(외부 패키지 없음).

**Spec:** `docs/superpowers/specs/2026-11-19-pixel-monsters-design.md` — 그리는 규칙과 본보기 그림(부록)이 여기 있다.
그림을 그리는 task 는 반드시 이 문서를 먼저 읽는다.

## Global Constraints

- 그림 크기: 가로 20점 이하, 세로 15점 이하. 빈 테두리 줄·칸 없음. 한 장에 3~8색. 색은 소문자 `#rrggbb`.
- 터미널 높이: 그림은 8줄 이하. 걷는 그림의 줄 수 = `ceil((세로 점 + 1) / 2)`, 서 있는 그림 = `ceil(세로 점 / 2)`.
- 그림은 옆모습으로 오른쪽을 본다. 외곽선은 검정이 아니라 몸 색의 어두운 톤. 눈은 세로 2점.
- 어두운 배경(`#0c0c0c`)과 밝은 배경(`#f5f5f5`) 둘 다에서 모양이 읽혀야 한다.
- 기존 게임 캐릭터가 떠오르는 그림은 다시 그린다. 이름과 모습은 전부 새로 짓는다.
- 진화한 모습은 진화 전보다 칠한 점이 많다.
- `hooks/art/` 의 그림 파일은 `import type` 말고는 아무것도 불러오지 않는다(미리보기 도구가 Node 로 바로 읽는다).
- 외부 패키지를 들이지 않는다. 이 저장소에는 package.json 이 없다.
- 저장 형식(`game-1`)과 놀이 규칙은 건드리지 않는다.
- 작업 브랜치 `pixel-monsters` 에서 task 마다 커밋한다(사용자가 허락함). 커밋 제목은 `픽셀아트 (N/13): <한 일>`.
  **push·merge 는 하지 않는다.** `main` 은 건드리지 않는다.
- 모든 task 의 끝: `claude plugin test .` 가 전부 통과하고 `claude plugin validate .` 가 통과한다
  (아이콘 없음 경고는 원래 있던 것이다). 시작 시점 기준은 19 pass.
- 주석과 테스트 이름은 한국어로, 지금 코드의 말투를 따른다.

## Review Focus

- 터미널 폭이 그림보다 좁다(입력칸 위 `bodyColumns` 5): 그림 줄이 잘릴 뿐 오류가 나지 않고 상태 줄이 나온다. → Task 4
- 입력칸 위 `maxRows` 가 "그림 줄 + 1"과 같으면 그림이 나오고, 1 적으면 상태 줄만 나온다. → Task 4
- 크기가 다른 두 몬스터 사이의 진화: 연출 내내 그림 줄 수가 같다(화면이 위아래로 흔들리지 않는다). → Task 4
- 알이 함께 다니거나 가방에서 골라졌을 때: 터미널·데스크톱 모두 알 그림이 나오고, 알은 뜨지 않는다. → Task 4, Task 5
- 가방 폭이 그림보다 좁다(`bodyColumns` 12): 오류 없이 쌓는 배치로 그려진다. → Task 5

---

## 파일 구조

| 파일 | 하는 일 |
|---|---|
| `hooks/art/types.ts` (새로) | `Art` 타입 하나 |
| `hooks/art/egg.ts` (새로) | 알, 기운 알 |
| `hooks/art/starters.ts` (새로) | 시작 몬스터 4계열 12마리 (번호 1~12) |
| `hooks/art/three-a.ts`, `three-b.ts` (새로) | 3단 진화 14계열 42마리 (번호 13~33, 34~54) |
| `hooks/art/two-a.ts`, `two-b.ts`, `two-c.ts` (새로) | 2단 진화 37계열 74마리 (번호 55~80, 81~104, 105~128) |
| `hooks/art/rest.ts` (새로) | 갈래 4 · 진화 없음 14 · 전설 5 (번호 129~151) |
| `hooks/art/index.ts` (새로) | 그림 파일을 모아 `ARTS`, `artOf` 를 낸다 |
| `hooks/pixels.ts` (새로) | 그림 자료 → 반칸 블록 / Svg |
| `hooks/sprite.ts` (삭제) | 문자 그림. Task 5 에서 지운다 |
| `hooks/evolution.ts` (수정) | `sparkle` → `sparkleSides` |
| `hooks/layout.ts` (수정) | `pickedLayout` 추가 |
| `hooks/register.tsx` (수정) | 입력칸 위·가방이 점 그림을 그린다 |
| `hooks/data.ts` (수정) | `arch`·`accent`·`eye`·`ELEMENT_COLOR` 삭제 (Task 13) |
| `tools/sheet.mjs` (새로) | 그림 자료를 PNG 한 장으로 뽑는 미리보기 도구 |
| `tests/art.test.ts` (새로) | 그림 자료 검사 |
| `tests/pixels.test.ts` (새로) | 변환 검사 |
| `tests/monster.test.tsx` (수정) | 화면 검사 |

번호는 `hooks/data.ts` 의 `SPECIES` 순서(`id`)다. 각 번호의 이름·속성·단계·`arch` 는 그 파일에서 읽는다.

---

### Task 1: 그림 자료 형식 · 자료 검사 · 미리보기 도구

**Files:**
- Create: `hooks/art/types.ts`, `hooks/art/egg.ts`, `hooks/art/starters.ts`, `hooks/art/index.ts`, `tools/sheet.mjs`
- Test: `tests/art.test.ts`

**Interfaces:**
- Produces:
  - `hooks/art/types.ts`: `export type Art = { palette: Record<string, string>; rows: string[] }` — 글자 하나가 점 하나, `.` 은 빈 칸.
  - 모든 그림 파일: `export const ART: Record<string, Art>` — 열쇠는 몬스터 이름.
  - `hooks/art/egg.ts`: `export const EGG_NAME = '알'`, `export const EGG_TILT_NAME = '알-기움'`, `export const ART` 에 그 두 장.
  - `hooks/art/index.ts`: `export const ARTS: Record<string, Art>` (모든 `ART` 를 합친 것),
    `export const artOf = (name: string | undefined, frame?: number): Art`
    — `undefined` 면 알(`frame % 4 === 0` 이면 기운 알), 그림이 아직 없는 이름이면 알.
    그림이 없는 이름에 알을 돌려주는 것은 **임시**다. Task 13 에서 없앤다.
  - `tools/sheet.mjs`: `node tools/sheet.mjs <out.png> [--only <파일 이름>] [--scale <점 하나의 px, 기본 10>]`

- [ ] **Step 1: 실패하는 테스트를 쓴다** — `tests/art.test.ts`

```ts
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

test('그림이 있는 몬스터: 시험으로 그린 다섯 마리', () => {
  expect(['새싹뿔', '불씨룡', '물방울게', '찌릿여우', '폭염룡'].filter(name => ARTS[name] === undefined)).toEqual([])
})
```

- [ ] **Step 2: 실패를 확인한다**

Run: `claude plugin test .`
Expected: `tests/art.test.ts` 가 `../hooks/art` 를 찾지 못해 FAIL. 기존 19개는 그대로 pass.
출력의 "across N file" 이 2 가 아니면(새 파일을 못 찾으면) 멈추고 보고한다.

- [ ] **Step 3: 그림 자료를 만든다**

- `hooks/art/types.ts`, `hooks/art/index.ts` 를 위 Interfaces 대로 쓴다.
- `hooks/art/starters.ts`: spec 부록의 다섯 마리를 그대로 옮긴다(고치지 않는다).
- `hooks/art/egg.ts`: 알과 기운 알을 새로 그린다. 세로 9~11점, 크림색 몸에 무늬 점 몇 개.
  기운 알은 같은 색 이름표로, 위쪽 절반을 한 점 옆으로 민 모습이다(두 그림의 점 줄은 달라야 한다).

- [ ] **Step 4: 미리보기 도구 `tools/sheet.mjs` 를 쓴다**

- `hooks/art/*.ts` 중 `types.ts`·`index.ts` 를 뺀 파일을 `import(pathToFileURL(path))` 로 읽어 `ART` 를 모은다
  (Node 24 가 타입을 지우고 읽는다). `--only starters` 면 그 파일만.
- 그림을 한 줄에 10장씩, 16점 높이 띠에 바닥을 맞춰, 3점 간격으로 놓는다.
  줄마다 어두운 띠(`#0c0c0c`)와 밝은 띠(`#f5f5f5`)를 위아래로 붙인다. 점 하나 = `--scale` px 정사각형.
- PNG 는 `node:zlib` 의 `deflateSync`·`crc32` 로 직접 쓴다.
- 표준 출력에 줄마다 놓인 이름을 순서대로 찍는다(이미지에는 글자를 넣지 않는다).
- 줄 길이가 다르거나 색 이름표에 없는 글자가 있으면 이름과 함께 오류로 끝낸다.

- [ ] **Step 5: 통과와 그림을 확인한다**

Run: `claude plugin test .`  → Expected: 25 pass, 0 fail
Run: `node tools/sheet.mjs <scratchpad>/sheet-1.png`  → 표준 출력에 7개 이름, PNG 생성.
PNG 를 Read 로 열어 본다: 다섯 마리가 spec 의 시험 그림과 같고, 알 두 장이 양쪽 배경에서 알로 보인다.

---

### Task 2: 그림 자료를 반칸 블록과 Svg 로 바꾸기

**Files:**
- Create: `hooks/pixels.ts`
- Test: `tests/pixels.test.ts`

**Interfaces:**
- Consumes: `Art` (`hooks/art/types.ts`)
- Produces — `hooks/pixels.ts`:

```ts
export type Run = { text: string; color?: string; backgroundColor?: string }
export type Pose = {
  /** 왼쪽을 보게 좌우로 뒤집는다 */
  isMirrored?: boolean
  /** 바닥에서 띄우는 점 수. 걷기는 0 과 1 을 번갈아 쓴다. */
  lift?: number
  /** 그릴 터미널 줄 수. 없으면 standRows(art). 그림은 바닥에 맞추고 위를 비운다. */
  rows?: number
  /** 칠한 점을 전부 이 색으로 그린다 (진화 연출의 실루엣) */
  tint?: string
}
/** 서 있는 그림의 터미널 줄 수: ceil(세로 점 / 2) */
export const standRows = (art: Art): number
/** 걷는 그림의 터미널 줄 수: ceil((세로 점 + 1) / 2) */
export const walkRows = (art: Art): number
/** 터미널 줄마다, 글자·색이 같은 칸을 묶은 조각들 */
export const halfBlocks = (art: Art, pose?: Pose): Run[][]
/** Svg 의 점 하나 크기 (CSS px) */
export const SVG_DOT = 4
/** 점 하나 = 사각형 하나. width = 가로 점 × SVG_DOT, height = 줄 수 × 2 × SVG_DOT */
export const svgOf = (art: Art, pose?: Pose): { source: string; width: number; height: number }
```

칸 하나의 규칙 (위 점 / 아래 점):

| 위 | 아래 | 조각 |
|---|---|---|
| 있음 | 있음 | `▀`, `color` = 위, `backgroundColor` = 아래 (두 색이 같아도) |
| 있음 | 없음 | `▀`, `color` = 위 |
| 없음 | 있음 | `▄`, `color` = 아래 |
| 없음 | 없음 | 빈 칸 한 글자, 색 없음 |

쓰지 않는 열쇠(`color`, `backgroundColor`)는 `undefined` 로 두지 않고 아예 넣지 않는다.
줄 끝의 빈 칸도 지우지 않는다(줄마다 칸 수가 그림 폭과 같다).

- [ ] **Step 1: 실패하는 테스트를 쓴다** — `tests/pixels.test.ts`

```ts
import { expect, test } from 'claude-code/testing'

import { halfBlocks, standRows, svgOf, walkRows } from '../hooks/pixels'

// 세로 3점(홀수), 가로 2점
const A = { palette: { a: '#111111', b: '#222222' }, rows: ['a.', 'ab', '.b'] }
// 세로 2점(짝수), 가로 3점, 한 색
const B = { palette: { a: '#111111' }, rows: ['aaa', 'aaa'] }

test('줄 수: 서 있을 때는 점의 절반, 걸을 때는 1점 뜰 자리를 더한다', () => {
  expect([standRows(A), walkRows(A)]).toEqual([2, 2])
  expect([standRows(B), walkRows(B)]).toEqual([1, 2])
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
```

- [ ] **Step 2: 실패를 확인한다** — Run: `claude plugin test .` → `../hooks/pixels` 를 찾지 못해 FAIL
- [ ] **Step 3: `hooks/pixels.ts` 를 위 Interfaces 대로 구현한다**

`halfBlocks` 와 `svgOf` 는 같은 "점 격자"(줄 수 × 2 줄, 뒤집기·띄우기·칠하기를 적용한 것)에서 출발한다. 그 격자를 만드는 부분을 하나로 둔다.

- [ ] **Step 4: 통과를 확인한다** — Run: `claude plugin test .` → Expected: 30 pass, 0 fail

---

### Task 3: 시작 몬스터 4계열 12마리

**Files:**
- Modify: `hooks/art/starters.ts`
- Test: `tests/art.test.ts`

**Interfaces:**
- Consumes: Task 1 의 `Art`, `tools/sheet.mjs`
- Produces: `hooks/art/starters.ts` 의 `ART` 에 번호 1~12 전부. 이 12마리가 뒤 task 들의 그림체 본보기다.

- [ ] **Step 1: 실패하는 테스트를 더한다** — "시험으로 그린 다섯 마리" 테스트를 아래로 바꾼다

```ts
const missing = (from: number, to: number) =>
  SPECIES.slice(from - 1, to).map(s => s.name).filter(name => ARTS[name] === undefined)

test('그림이 있는 몬스터: 시작 몬스터 4계열 (1~12)', () => {
  expect(missing(1, 12)).toEqual([])
})
```

- [ ] **Step 2: 실패를 확인한다** — Expected: 덩굴뿔·고목뿔·화염룡·파도게·해일게·번개여우·천둥여우 일곱 이름이 남아 FAIL
- [ ] **Step 3: 일곱 마리를 그린다**

spec 의 "그리는 규칙"을 지킨다. 이미 있는 다섯 마리는 고치지 않는다.

- 덩굴뿔·고목뿔: 새싹뿔의 잎 뿔과 둥근 몸을 잇는다. 덩굴이 감기고, 마지막은 나무줄기 몸에 큰 가지 뿔.
- 화염룡: 불씨룡(네 발 도마뱀 + 등불꽃)과 폭염룡(뿔 + 큰 등불꽃) 사이. 점 수가 둘 사이에 와야 한다.
- 파도게·해일게: 물방울게의 집게와 둥근 등딱지를 잇는다. 집게가 커지고 등에 물결·파도 무늬.
- 번개여우·천둥여우: 찌릿여우의 뾰족 귀와 청록 꼬리 끝을 잇는다. 꼬리가 늘고 커진다.
  노란 쥐처럼 보이면 안 된다(붉은 볼, 검은 귀 끝, 번개 모양 꼬리를 쓰지 않는다).

- [ ] **Step 4: 눈으로 확인하고 고친다**

Run: `node tools/sheet.mjs <scratchpad>/sheet-starters.png --only starters` 후 PNG 를 Read 로 연다.
아래가 전부 맞을 때까지 고치고 다시 뽑는다.
- 이름을 가리고 봐도 무슨 생물인지 짐작된다.
- 같은 계열 세 마리가 한 줄기로 보이고, 뒤로 갈수록 크다.
- 12마리의 윤곽이 서로 다르다.
- 어두운 띠·밝은 띠 양쪽에서 눈과 윤곽이 보인다.
- 기존 게임 캐릭터가 떠오르지 않는다.

- [ ] **Step 5: 통과를 확인한다** — Run: `claude plugin test .` → Expected: 30 pass, 0 fail

---

### Task 4: 입력칸 위를 점 그림으로

**Files:**
- Modify: `hooks/register.tsx` (입력칸 위 `ui.render` hook, 지금의 158~229줄), `hooks/evolution.ts`
- Test: `tests/monster.test.tsx`

**Interfaces:**
- Consumes: `artOf` (`hooks/art`), `halfBlocks`·`svgOf`·`walkRows`·`Run`·`Pose` (`hooks/pixels`)
- Produces:
  - `hooks/evolution.ts`: `sparkle` 를 지우고
    `export const sparkleSides = (row: number, k: number): [string, string]`
    — `(row + k) % 2 === 0` 이면 `['* ', ' .']`, 아니면 `['. ', ' *']`.
  - `hooks/register.tsx` 안의 그리기 도우미(가방도 쓴다, Task 5):
    `picture(els, art, pose, options?: { indent?: number; sides?: (row: number) => [string, string]; sideColor?: string })`
    — `els` 는 `$.ui.resolve(e)` 가 준 표. 표에 `Svg` 가 없으면(터미널) 줄마다
    `<Text wrap="truncate">` 하나에 `indent` 만큼의 빈 칸, (`sides` 가 있으면) 왼쪽 글자 `<Text color={sideColor}>`,
    조각마다의 `<Text color backgroundColor>`, 오른쪽 글자 `<Text color={sideColor}>` 를 차례로 넣는다.
    `Svg` 가 있으면 `<Box flexDirection="row">` 에 `indent` 빈 칸 `Text` 와 `<Svg source width height alt>` 를 넣는다
    (`sides` 가 있으면 Svg 양옆에 0번 줄의 글자를 `sideColor` 로 하나씩).
    돌려주는 것은 `<Box key=… flexDirection="column">` 하나다. 열쇠는 호출하는 쪽이 준다.
    터미널에서는 이 상자의 바로 아래 자식이 그림 줄(`Text`)들이고, 다른 것은 넣지 않는다(테스트가 자식 수로 줄 수를 센다).
  - 입력칸 위 그림 상자의 열쇠: `walker`.

동작 (spec "입력칸 위", "움직임"):
- 그림 = `artOf(species?.name, t)`. 줄 수 = `walkRows(그림)`. `lift` = 몬스터는 `t % 2`, 알은 0.
- 걷는 범위는 `bodyColumns − 그림 폭 − 1`. 방향·위치 계산은 지금과 같다.
- `e.props.maxRows < 줄 수 + 1` 이면 그림을 그리지 않고 상태 줄만 그린다.
- 진화 연출: 줄 수 = `max(walkRows(진화 전), walkRows(진화 후))`, `lift` 0, 가운데 정렬.
  깜빡이는 동안 `tint` = 터미널 `'text'`, Svg `'#ffffff'`. 축하 동안 `sides` = `k` 를 묶은 `sparkleSides`, `sideColor` = `GOLD`.
- 이 task 가 끝나도 가방은 아직 `hooks/sprite.ts` 의 문자 그림을 쓴다.

- [ ] **Step 1: 실패하는 테스트를 쓴다** — `tests/monster.test.tsx`

`bandOf(surface, props?)` 도우미를 만든다: 지금 세 군데에 되풀이된 입력칸 위 mount 인자
(`maxRows: 20, bodyColumns: 60, …`)를 내고, `props` 로 `maxRows`·`bodyColumns` 를 덮어쓴다.

```ts
const HALF = /[▀▄]/

/** 그림 줄들의 모양. 걷는 위치(앞쪽 빈 칸)는 뺀다. */
const shapeOf = async (ui: { findAll: (q: { type: string; text: RegExp }) => Promise<{ text?: unknown }[]> }) =>
  (await ui.findAll({ type: 'Text', text: HALF })).map(t => String(t.text).trimStart()).join('\n')

test('입력칸 위: 터미널은 반칸 블록, 데스크톱은 Svg 로 그리고, 알은 뜨지 않는다', async ($, on) => {
  // 새 게임(알 하나)으로 session.start — 기존 테스트의 준비 코드와 같다. const clock = mock.clock(on)
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

test('입력칸 위: 몬스터는 한 tick 걸러 1점 뜨고, 자리가 모자라면 상태 줄만, 폭이 좁아도 그려진다', async ($, on) => {
  // gameWith(1) 로 session.start: 새싹뿔 Lv.5 (세로 11점 → 걷는 그림 6줄). const clock = mock.clock(on)
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
```

"진화하면 … 다시 걷는다" 테스트에 더한다(새싹뿔 → 덩굴뿔, 두 그림의 줄 수가 다르다):

```ts
  // 그림 상자(walker)의 바로 아래 자식 하나가 그림 한 줄이다
  const artRows = async () => (await band.find({ key: 'walker' }))?.children.length
  // "어라?" 직후
  const rows = await artRows()
  // 깜빡이는 동안 (clock.advance(400 * 5) 뒤)
  expect(await artRows()).toBe(rows)
  expect((await band.findAll({ type: 'Text', text: HALF })).some(t => t.props.color === 'text')).toBe(true)
  // 축하하는 동안 (clock.advance(400 * 11) 뒤)
  expect(await artRows()).toBe(rows)
  expect((await band.find({ type: 'Text', text: /^[*.] $/ }))?.props.color).toBe('#ffc400')
```

- [ ] **Step 2: 실패를 확인한다** — Run: `claude plugin test .` → 새 테스트 2개와 진화 테스트가 FAIL
- [ ] **Step 3: `sparkleSides`, `picture`, 입력칸 위 hook 을 위 동작대로 구현한다**
- [ ] **Step 4: 통과를 확인한다** — Run: `claude plugin test .` → Expected: 32 pass, 0 fail

---

### Task 5: 가방을 점 그림으로 · 나란히 놓기

**Files:**
- Modify: `hooks/layout.ts`, `hooks/register.tsx` (가방 `ui.render` hook, 지금의 233~467줄)
- Delete: `hooks/sprite.ts`
- Test: `tests/monster.test.tsx`

**Interfaces:**
- Consumes: `picture` (Task 4), `artOf`, `standRows`
- Produces — `hooks/layout.ts`:

```ts
/** 그림과 설명 사이 칸 수 */
export const PICTURE_GAP = 2
/** 설명 칸이 이보다 좁으면 그림 아래에 쌓는다 */
export const MIN_INFO_COLUMNS = 24
/**
 * 가방에서 고른 몬스터 부분(그림 + 이름·진화 안내·버튼)의 배치.
 * 나란히: rows = max(그림 줄, 설명 줄), infoColumns = columns − pictureColumns − PICTURE_GAP
 * 쌓기:   rows = 그림 줄 + 설명 줄,     infoColumns = columns
 * 설명 줄 = 이름 1 + 진화 안내(없으면 0) + 버튼 줄
 */
export const pickedLayout = (o: {
  columns: number
  pictureColumns: number
  pictureRows: number
  evoText: string
  actionWidths: number[]
}): { isSideBySide: boolean; infoColumns: number; rows: number }
```

- 가방의 열쇠: 고른 몬스터 부분 상자 `picked`(나란히면 `flexDirection="row"`, 쌓기면 `"column"`), 그림 상자 `picture`.

동작 (spec "가방"):
- 그림 = `artOf(pickedSpecies?.name, 1)` (알은 기울지 않은 그림), 줄 수 = `standRows(그림)`, `lift` 0.
- `rowsOf` 의 `below` 에서 `(isTight ? 0 : body.length) + 1 + 진화 안내 줄 + 버튼 줄` 자리를,
  촘촘하지 않을 때는 `pickedLayout(...).rows` 로, 촘촘할 때는 지금 그대로(그림 없이 전체 폭)로 바꾼다.
- 나란히 놓을 때 그림 상자는 줄어들지 않게(`flexShrink={0}`) 하고, 설명 상자가 남은 폭을 쓴다.
- 촘촘한 배치로 넘어가는 조건(`MIN_SHOWN` 마리를 못 보여 줄 때)과 목록 스크롤은 그대로다.

- [ ] **Step 1: 실패하는 테스트를 쓴다** — `tests/monster.test.tsx`

```ts
test('고른 몬스터 부분: 넓으면 그림 옆에, 좁으면 그림 아래에 설명을 둔다', () => {
  const evoText = '진화: Lv.16 → 덩굴뿔' // 20칸
  const at = (columns: number, pictureRows: number, actionWidths: number[] = []) =>
    pickedLayout({ columns, pictureColumns: 9, pictureRows, evoText, actionWidths })
  expect(at(80, 6)).toEqual({ isSideBySide: true, infoColumns: 69, rows: 6 })
  expect(at(35, 6)).toEqual({ isSideBySide: true, infoColumns: 24, rows: 6 })
  expect(at(34, 6)).toEqual({ isSideBySide: false, infoColumns: 34, rows: 8 })
  // 설명이 그림보다 길면 설명 줄 수를 따른다: 이름 1 + 진화 1 + 버튼 3
  expect(at(35, 4, [15, 12, 12])).toEqual({ isSideBySide: true, infoColumns: 24, rows: 5 })
  expect(pickedLayout({ columns: 80, pictureColumns: 9, pictureRows: 5, evoText: '', actionWidths: [] }).rows).toBe(5)
})
```

`paneOf(bodyRows)` 를 `paneOf(bodyRows, bodyColumns = 80, surface = 'terminal')` 로 넓힌다.

기존 테스트를 고친다:
- "상점은 목록보다 위에 있고 …"(30줄): `'(o o)'` 를 찾는 줄을 아래로 바꾼다. 목록 17마리·`1–17번째` 는 그대로다
  (위 6 + 목록 17 + 빈 줄 1 + 고른 몬스터 6: 새싹뿔 그림 6줄 옆에 설명 2줄).

```ts
  expect((await ui.find({ key: 'picture' })) !== undefined).toBe(true)
  expect((await ui.find({ key: 'picked' }))?.props.flexDirection).toBe('row')
```

- "가방이 낮으면 …"(11줄): `'(o o)'` 가 없다는 줄을 `expect(await ui.find({ key: 'picture' })).toBe(undefined)` 로 바꾼다.
  나머지 숫자는 그대로다.

새 테스트:

```ts
test('가방: 좁으면 그림 아래에 쌓고, 그림보다 좁아도 그려지고, 데스크톱은 Svg 로 그린다', async ($, on) => {
  // gameWith(3) 으로 session.start
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

test('가방: 알을 고르면 알 그림이 나온다', async ($, on) => {
  // 새 게임(알 하나)으로 session.start
  const ui = await $.ui.mount(paneOf(40))
  expect((await ui.find({ key: 'picture' })) !== undefined).toBe(true)
  expect((await ui.findAll({ type: 'Text', text: /[▀▄]/ })).length > 0).toBe(true)
  await ui.unmount()

  const desk = await $.ui.mount(paneOf(40, 80, 'desktop'))
  expect((await desk.find({ type: 'Svg' })) !== undefined).toBe(true)
  await desk.unmount()
})
```

- [ ] **Step 2: 실패를 확인한다** — Run: `claude plugin test .` → `pickedLayout` 이 없어 FAIL
- [ ] **Step 3: `pickedLayout` 과 가방 hook 을 위 동작대로 구현하고, `hooks/sprite.ts` 를 지운다**

`hooks/sprite.ts` 를 지운 뒤 `hooks/register.tsx` 에 `sprite`·`spriteWidth`·`ELEMENT_COLOR` 를 쓰는 곳이 남지 않아야 한다
(`ELEMENT_COLOR` 정의는 Task 13 에서 지운다).

- [ ] **Step 4: 통과를 확인한다** — Run: `claude plugin test .` → Expected: 35 pass, 0 fail

---

### Task 6: 실제 터미널에서 확인 · 가방이 입력칸 위에 뜰 때 재기 · 사용자 확인

**Files:**
- Modify (조건부): `hooks/register.tsx`, `types/index.d.ts`, `tests/monster.test.tsx`
- 확인용 스크립트와 이미지는 scratchpad 에 둔다(저장소에 넣지 않는다).

**Interfaces:**
- Consumes: Task 1~5 전부
- Produces (조건부): `types/index.d.ts` 의 `'token-monster'` 에 `bagPlacement: 'dock' | 'inline' | 'widget' | null`

- [ ] **Step 1: 실제 터미널 화면을 뜬다**

Python 3.13 의 `winpty`(pywinpty)로 `claude --plugin-dir F:\parsingk\token-monster` 를 pty 에 띄우고,
출력을 `pyte` 화면에 먹인다(`pyte` 는 scratchpad 에 `pip install --target` 으로 받는다).
`--plugin-dir` 로 뜬 mod 의 저장 파일은 `<config dir>/plugins/store/token-monster_inline-*.json` 이다.
시험 전에 그 파일의 원래 내용을 보관하고, 폭염룡(번호 6)이 함께 다니고 시작 몬스터 12마리가 가방에 있는 게임으로 바꾼다.
끝나면 원래 내용으로 되돌린다. 진짜 저장 파일(`token-monster_claude-token-monster-*.json`)은 건드리지 않는다.

- [ ] **Step 2: 입력칸 위 그림이 자료와 같은지 본다**

120칸 × 50줄 터미널. `pyte` 화면의 칸마다 글자·글자색·바탕색을 읽어 점 격자로 되돌리고 PNG 로 뽑아 Read 로 연다.
Expected: 폭염룡이 `tools/sheet.mjs` 로 뽑은 폭염룡과 점 단위로 같다. 줄 사이 틈이나 어긋난 칸이 없다.
몇 초 간격으로 두 번 떠서, 위치가 옮겨 가고 한 번은 1점 떠 있고 방향이 바뀌면 좌우가 뒤집히는 것을 본다.

- [ ] **Step 3: 가방을 본다**

`/monster` + Enter. 120칸에서는 가방이 옆에 붙는다: 그림이 나오고, 폭이 되면 설명이 그림 옆에 있다.
목록에서 다른 몬스터를 누르면(SGR 마우스: `ESC[<0;col;rowM` 뒤 `…m`) 그 몬스터 그림으로 바뀐다.

- [ ] **Step 4: 가방이 입력칸 위에 뜰 때 높이를 잰다**

100칸 × 40줄로 다시 띄운다(110칸보다 좁으면 가방이 입력칸 위에 뜬다).
(가) 폭염룡이 걷는 채로, (나) `숨기기` 를 눌러 입력칸 위를 숨긴 채로 가방을 열어, 목록에 보이는 마릿수를 각각 센다.

- (가)와 (나)가 같다 → 입력칸 위 그림이 가방 높이를 깎지 않는다. Step 5 를 건너뛴다.
- (가)가 적다 → Step 5 를 한다.

- [ ] **Step 5 (조건부): 가방이 입력칸 위에 떠 있는 동안 상태 줄만 그린다**

- `bagPlacement` atom 을 둔다. 가방 hook 이 그릴 때 `e.props.placement` 와 다르면 고쳐 쓰고,
  `ui.close` 가 `id === PANE` 으로 오면 `null` 로 되돌린다.
- 입력칸 위 hook 은 `bagPlacement === 'inline'` 이면 그림을 빼고 상태 줄만 그린다.
- 테스트: `placement: 'inline'` 으로 가방을 mount 한 뒤 입력칸 위에 `walker` 가 없고 상태 줄은 있다.
  가방을 닫으면(`$.ui.close({ id: 'monster' })`) `walker` 가 돌아온다. `placement: 'dock'` 이면 `walker` 가 그대로 있다.
- Step 4 를 다시 해서 (가)와 (나)가 같아졌는지 확인한다.

- [ ] **Step 6: 통과를 확인한다** — Run: `claude plugin test .` → 0 fail
- [ ] **Step 7: 사용자에게 그림체를 확인받는다 (여기서 멈춘다)**

보여 줄 것: `node tools/sheet.mjs` 로 뽑은 12마리 + 알 이미지, Step 2·3 에서 실제 터미널을 되돌려 그린 이미지,
Step 4 에서 잰 결과. 데스크톱 앱 모습은 직접 확인하지 못했다는 것도 말한다.
사용자가 그림체를 고치라고 하면 `hooks/art/starters.ts` 를 고치고 이 task 를 다시 확인한다.
**그림체가 확정되기 전에는 Task 7~12 를 시작하지 않는다.**

---

### Task 7~12: 나머지 139마리

여섯 task 는 같은 틀이다. `hooks/art/index.ts` 와 `tests/art.test.ts` 를 함께 고치므로 하나씩 차례로 한다.

| Task | 파일 | 번호 | 마릿수 | 묶음 |
|---|---|---|---|---|
| 7 | `hooks/art/three-a.ts` | 13~33 | 21 | 3단 진화 앞 7계열 (꼬물실 … 졸음요정) |
| 8 | `hooks/art/three-b.ts` | 34~54 | 21 | 3단 진화 뒤 7계열 (주먹곰 … 솜뭉치) |
| 9 | `hooks/art/two-a.ts` | 55~80 | 26 | 2단 진화 앞 13계열 |
| 10 | `hooks/art/two-b.ts` | 81~104 | 24 | 2단 진화 가운데 12계열 |
| 11 | `hooks/art/two-c.ts` | 105~128 | 24 | 2단 진화 뒤 12계열 |
| 12 | `hooks/art/rest.ts` | 129~151 | 23 | 갈래 4 · 진화 없음 14 · 전설 5 |

묶음의 경계는 번호가 정한다. 시작 전에 `SPECIES.slice(from - 1, to)` 로 이름·속성·단계·`arch` 를 뽑아
계열이 묶음 경계에서 잘리지 않는지 확인하고, 잘리면 멈추고 보고한다.

**Files (task 마다):**
- Create: 표의 파일 하나
- Modify: `hooks/art/index.ts` (새 파일의 `ART` 를 `ARTS` 에 합친다), `tests/art.test.ts`

**Interfaces:**
- Consumes: `Art`, `tools/sheet.mjs`, 본보기 `hooks/art/starters.ts`, spec 의 "그리는 규칙"
- Produces: 표의 번호 범위 전부의 그림

- [ ] **Step 1: 실패하는 테스트를 더한다** — `tests/art.test.ts`

```ts
test('그림이 있는 몬스터: <묶음 이름> (<from>~<to>)', () => {
  expect(missing(<from>, <to>)).toEqual([])
})
```

- [ ] **Step 2: 실패를 확인한다** — Run: `claude plugin test .` → 그 묶음의 이름이 전부 남아 FAIL
- [ ] **Step 3: 생김새를 정한다**

그리기 전에 묶음 전체의 생김새를 한 줄씩 적어 본다(파일에 남기지 않는다): 무슨 생물인지, 몸 색, 그 계열의 특징 하나,
세로 점 수. 이름이 생물을 말하면 그 생물로(곰, 나방, 펭귄, 코끼리, 고래…), 아니면 이름·속성·`arch` 에서 정한다.
이 단계에서 걸러 낸다: 같은 묶음이나 `starters.ts` 에 윤곽이 비슷한 것, 기존 게임 캐릭터가 떠오르는 것,
몸 색이 다른 계열과 겹치는 것(같은 속성이어도 색조·밝기를 달리한다).
세로 크기: 세로 줄 수는 적게 쓸수록 좋지만 **일부러 낮추지는 않는다**(사용자가 정함).
낮게 그려도 괜찮은 생김새(게, 도마뱀, 물고기, 뱀, 납작한 벌레처럼 원래 낮은 것)만 낮게 그리고,
키가 있어야 하는 것(서 있는 새, 나무, 요정)을 눌러서 그리지 않는다. 8줄을 채우려고 일부러 키우지도 않는다.
길잡이: 1단계 8~11점, 2단계 10~13점, 3단계 12~15점, 진화하지 않는 몬스터 10~13점, 전설 13~15점.
짝수 점이면 걸을 때 한 줄을 더 쓴다(10점은 6줄, 9점은 5줄). 한 점을 줄여도 모양이 그대로일 때만 홀수로 맞춘다.
전설 다섯 마리(Task 12)는 가장 화려하게 그린다.

- [ ] **Step 4: 그린다** — 한 계열을 다 그리고 다음 계열로 간다.
- [ ] **Step 5: 눈으로 확인하고 고친다**

Run: `node tools/sheet.mjs <scratchpad>/sheet-<파일 이름>.png --only <파일 이름>` 후 PNG 를 Read 로 연다.
Task 3 Step 4 의 다섯 가지가 전부 맞을 때까지 고치고 다시 뽑는다. 적어도 한 번은 고쳐 그린 뒤의 이미지를 본다.
마지막으로 `--only` 없이 전체를 뽑아, 다른 파일의 몬스터와 윤곽·색이 겹치지 않는지 본다.

- [ ] **Step 6: 통과를 확인한다** — Run: `claude plugin test .` → 0 fail (크기·테두리·색 수·겹침·진화 점 수 검사 포함)

---

### Task 13: 마무리

**Files:**
- Modify: `hooks/art/index.ts`, `hooks/data.ts`, `tests/art.test.ts`, `README.md`, `.claude-plugin/plugin.json`

**Interfaces:**
- Consumes: Task 1~12 전부
- Produces: `artOf(name: string | undefined, frame?: number): Art` — 이름이 있으면 그 그림, `undefined` 면 알. 임시 처리 없음.

- [ ] **Step 1: 실패하는 테스트를 쓴다** — `tests/art.test.ts`

묶음별 "그림이 있는 몬스터" 테스트들을 하나로 합친다.

```ts
test('151마리 모두 그림이 있다', () => {
  expect(drawn.length).toBe(151)
  expect(missing(1, 151)).toEqual([])
})
```

`tests/monster.test.tsx` 에 더한다: `SPECIES` 의 몬스터마다 `'arch' in s`, `'accent' in s`, `'eye' in s` 가 모두 `false`.

- [ ] **Step 2: 실패를 확인한다** — Run: `claude plugin test .` → `arch` 등이 남아 FAIL
- [ ] **Step 3: 임시 처리와 안 쓰는 자료를 지운다**

- `hooks/art/index.ts` 의 `artOf`: 그림이 없는 이름에 알을 돌려주던 부분을 지운다.
- `hooks/data.ts`: `Arch` 타입, `Species`·`Family` 의 `arch`·`accent`·`eye`, `f()` 의 그 세 인자,
  `FAMILIES` 각 줄의 그 세 값, `ELEMENT_COLOR` 를 지운다. `ELEMENT_NAME` 은 가방이 쓰므로 남긴다.
  맨 위 주석의 "이름과 모습은 전부 이 mod 를 위해 새로 지은 것이다" 는 남긴다.

- [ ] **Step 4: README 와 버전**

- `README.md` 놀이 방법: "가방이 낮으면 … 몬스터 그림과 빈 줄을 빼고 촘촘하게 그립니다" 줄 근처에,
  몬스터가 점 그림이고 마리마다 크기·모양·색이 다르며, 터미널이 낮으면 입력칸 위에 상태 줄만 나온다는 것을 쓴다.
  진화 연출의 "흰빛" 은 "밝은 빛" 으로 바꾼다.
- `README.md` 고치기: "모습: `hooks/sprite.ts`" 를
  "모습: `hooks/art/` (그리는 규칙은 `docs/superpowers/specs/2026-11-19-pixel-monsters-design.md`),
  미리보기: `node tools/sheet.mjs out.png`" 로 바꾼다.
- `.claude-plugin/plugin.json`: `"version": "0.7.0"`.

- [ ] **Step 5: 전체를 확인한다**

Run: `claude plugin test .` → 0 fail · Run: `claude plugin validate .` → 통과
Run: `node tools/sheet.mjs <scratchpad>/sheet-all.png` → 표준 출력에 153개 이름(151 + 알 2), PNG 를 Read 로 연다.
Task 6 Step 1~3 을 전설 한 마리(태양사자)와 3단계 한 마리로 다시 해서 실제 터미널 모습을 본다.

- [ ] **Step 6: 사용자에게 151마리 전체를 보여 준다 (여기서 멈춘다)**

`sheet-all.png` 의 전체 경로와, 줄마다 놓인 이름 목록을 준다. 마음에 안 드는 몬스터를 짚으면 그것만 다시 그리고
Task 7~12 의 Step 5·6 을 그 파일에 다시 한다. `main` 에 합치기·push·배포는 사용자가 요청하면 한다(`main` 의 커밋 제목 형식: `[0.7.0] …`).
