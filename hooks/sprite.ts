import type { Arch, Species } from './data'

// 오른쪽을 보는 모습. E = 눈 자리. [머리, 얼굴, 다리 1, 다리 2]
const BODY: Record<Arch, [string, string, string, string]> = {
  blob: ['  .--.  ', ' ( E E )', '  d  b  ', '   db   '],
  beast: [' /\\__/\\ ', '( E  E )~', ' /|  |\\ ', ' |\\  /| '],
  bird: ['   __  ', ' \\(E )>', '   /\\  ', '   ||  '],
  fish: ['   __   ', '><(((E>', '  o     ', '    o   '],
  bug: ['  \\ /  ', ' (E:E) ', ' /\\/\\/\\', ' \\/\\/\\/'],
  lizard: ['    __  ', ' ~~(E E)>', '   /\\/\\ ', '  \\/ \\/ '],
  plant: ['  \\|/  ', ' (E E) ', '  /|\\  ', '  \\|/  '],
  rock: ['  ____  ', ' [E  E] ', ' /|  |\\ ', ' |\\  /| '],
  ghost: ['  .-.  ', ' (E E) ', ' /vVv\\ ', ' \\VvV/ '],
  serpent: ['     _  ', '  ~~(E)>', ' /\\/\\/  ', ' \\/\\/\\  '],
  shell: ['  ___  ', '<[E E]>', ' /   \\ ', '  \\ /  '],
  fluff: [' {~~~} ', '{ E E }', '  \' \'  ', '   \' \' '],
}

const EGG: [string, string, string, string] = ['       ', '  .-.  ', ' (   ) ', "  `-'  "]
const EGG_WOBBLE: [string, string, string, string] = ['       ', '  .-.  ', ' ( . ) ', "  `-'  "]

const MIRROR: Record<string, string> = {
  '(': ')', ')': '(', '[': ']', ']': '[', '{': '}', '}': '{', '<': '>', '>': '<',
  '/': '\\', '\\': '/', d: 'b', b: 'd', p: 'q', q: 'p',
}

const mirror = (row: string): string =>
  [...row].reverse().map(ch => MIRROR[ch] ?? ch).join('')

const crown = (species: Species): string => {
  const a = species.accent
  if (species.isLegendary) return ` *${a}*${a}* `
  if (species.stage === 3) return ` ${a}${a}${a}${a}${a} `
  if (species.stage === 2) return `  ${a} ${a}  `
  return ''
}

const center = (text: string, width: number): string => {
  const left = Math.max(0, Math.floor((width - text.length) / 2))
  return ' '.repeat(left) + text
}

/** 몸 4줄. species 가 없으면 알. */
export const sprite = (
  species: Species | undefined,
  frame: number,
  facingLeft: boolean,
): string[] => {
  let rows: string[]
  if (species === undefined) {
    rows = [...(frame % 4 === 0 ? EGG_WOBBLE : EGG)]
  } else {
    const [head, face, legsA, legsB] = BODY[species.arch]
    const width = Math.max(head.length, face.length, legsA.length)
    const top = crown(species)
    rows = [
      top === '' ? '' : center(top, width),
      head,
      face.replaceAll('E', species.eye),
      frame % 2 === 0 ? legsA : legsB,
    ]
  }
  const width = Math.max(...rows.map(r => r.length))
  const padded = rows.map(r => r.padEnd(width, ' '))
  return facingLeft ? padded.map(mirror) : padded
}

export const spriteWidth = (species: Species | undefined): number =>
  Math.max(...sprite(species, 0, false).map(r => r.length))
