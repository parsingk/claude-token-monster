// 그림 미리보기 도구. hooks/art/*.ts 의 그림을 PNG 한 장에 모아 그린다.
// 사용: node tools/sheet.mjs <out.png> [--only <파일 이름>] [--scale <점 하나의 px, 기본 10>]
// Node 24 가 타입을 지우고 .ts 를 바로 읽는다. 외부 패키지는 쓰지 않는다.
import { readdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { crc32, deflateSync } from 'node:zlib'

const PER_LINE = 10
const BAND = 16 // 띠 높이(점)
const GAP = 3 // 그림 사이 간격(점)
const DARK = [0x0c, 0x0c, 0x0c]
const LIGHT = [0xf5, 0xf5, 0xf5]
// 그림 묶음이 아닌 파일
const SKIP = new Set(['types.ts', 'index.ts'])

const fail = message => {
  console.error(message)
  process.exit(1)
}

const args = process.argv.slice(2)
let out
let only
let scale = 10
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--only') only = args[++i]
  else if (args[i] === '--scale') scale = Number(args[++i])
  else out = args[i]
}
if (out === undefined || !(scale >= 1)) fail('사용: node tools/sheet.mjs <out.png> [--only <파일 이름>] [--scale <px>]')

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'hooks', 'art')
const files = readdirSync(dir)
  .filter(f => f.endsWith('.ts') && !SKIP.has(f))
  .filter(f => only === undefined || f === only || f === `${only}.ts`)
  .sort()
if (files.length === 0) fail(`그림 파일이 없습니다: ${only ?? '(전체)'}`)

const arts = []
for (const file of files) {
  const { ART } = await import(pathToFileURL(join(dir, file)).href)
  for (const [name, art] of Object.entries(ART)) arts.push({ name, art })
}

const hex = c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16))
for (const { name, art } of arts) {
  const width = art.rows[0]?.length ?? 0
  if (!art.rows.every(r => r.length === width)) fail(`${name}: 줄 길이가 다릅니다`)
  for (const ch of art.rows.join('')) {
    if (ch !== '.' && art.palette[ch] === undefined) fail(`${name}: 색 이름표에 없는 글자 '${ch}'`)
  }
}

// 줄마다 PER_LINE 장씩 나눈다
const lines = []
for (let i = 0; i < arts.length; i += PER_LINE) lines.push(arts.slice(i, i + PER_LINE))
const lineWidth = line => GAP + line.reduce((sum, { art }) => sum + (art.rows[0]?.length ?? 0) + GAP, 0)
const dotsW = Math.max(...lines.map(lineWidth))
const dotsH = lines.length * BAND * 2
const W = dotsW * scale
const H = dotsH * scale
const pixels = Buffer.alloc(W * H * 3)

const fillDot = (x, y, [r, g, b]) => {
  for (let py = y * scale; py < (y + 1) * scale; py++) {
    for (let px = x * scale; px < (x + 1) * scale; px++) {
      const at = (py * W + px) * 3
      pixels[at] = r
      pixels[at + 1] = g
      pixels[at + 2] = b
    }
  }
}

lines.forEach((line, row) => {
  for (let y = 0; y < BAND * 2; y++) for (let x = 0; x < dotsW; x++) fillDot(x, row * BAND * 2 + y, y < BAND ? DARK : LIGHT)
  for (const bandIndex of [0, 1]) {
    let left = GAP
    for (const { art } of line) {
      const width = art.rows[0]?.length ?? 0
      const top = row * BAND * 2 + bandIndex * BAND + (BAND - art.rows.length)
      art.rows.forEach((r, dy) => {
        for (let dx = 0; dx < width; dx++) if (r[dx] !== '.') fillDot(left + dx, top + dy, hex(art.palette[r[dx]]))
      })
      left += width + GAP
    }
  }
  console.log(line.map(({ name }) => name).join(' '))
})

const chunk = (type, data) => {
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const head = Buffer.alloc(4)
  head.writeUInt32BE(data.length)
  const tail = Buffer.alloc(4)
  tail.writeUInt32BE(crc32(body) >>> 0)
  return Buffer.concat([head, body, tail])
}
const ihdr = Buffer.alloc(13)
ihdr.writeUInt32BE(W, 0)
ihdr.writeUInt32BE(H, 4)
ihdr[8] = 8 // 비트 깊이
ihdr[9] = 2 // RGB
const raw = Buffer.alloc((W * 3 + 1) * H)
for (let y = 0; y < H; y++) pixels.copy(raw, y * (W * 3 + 1) + 1, y * W * 3, (y + 1) * W * 3)
writeFileSync(
  out,
  Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]),
)
