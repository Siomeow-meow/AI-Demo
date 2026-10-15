import { parseCsv } from '../csv'
import type { Tool } from '../tool-types'
import { num, round } from './helpers'

const MORSE: Record<string, string> = {
  a: '.-', b: '-...', c: '-.-.', d: '-..', e: '.', f: '..-.', g: '--.', h: '....', i: '..', j: '.---', k: '-.-', l: '.-..', m: '--',
  n: '-.', o: '---', p: '.--.', q: '--.-', r: '.-.', s: '...', t: '-', u: '..-', v: '...-', w: '.--', x: '-..-', y: '-.--', z: '--..',
  '0': '-----', '1': '.----', '2': '..---', '3': '...--', '4': '....-', '5': '.....', '6': '-....', '7': '--...', '8': '---..', '9': '----.',
}
const FROM_MORSE = Object.fromEntries(Object.entries(MORSE).map(([k, v]) => [v, k]))

const LOREM =
  'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.'

function syllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, '')
  if (!w) return 0
  const groups = w.replace(/e$/, '').match(/[aeiouy]+/g)
  return Math.max(1, groups?.length ?? 1)
}

/** Line diff via longest common subsequence (inputs are kept small). */
function diffLines(a: string[], b: string[]): string[] {
  const dp = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0))
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1])
  }
  const out: string[] = []
  let i = 0
  let j = 0
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++
      j++
    } else if (dp[i + 1][j] >= dp[i][j + 1]) out.push(`- ${a[i++]}`)
    else out.push(`+ ${b[j++]}`)
  }
  while (i < a.length) out.push(`- ${a[i++]}`)
  while (j < b.length) out.push(`+ ${b[j++]}`)
  return out
}

export const textMoreTools: Tool[] = [
  {
    name: 'text_diff',
    category: 'Text & data',
    description: 'Compare two texts and show what was removed (-) and added (+), with a similarity score.',
    keywords: 'diff compare two texts differences changes added removed versions revision track changes similarity contract draft',
    parameters: {
      text_a: { type: 'string', description: 'Original text' },
      text_b: { type: 'string', description: 'New text' },
    },
    run: ({ text_a = '', text_b = '' }) => {
      const multi = text_a.includes('\n') || text_b.includes('\n')
      const a = multi ? text_a.split('\n') : text_a.split(/\s+/).filter(Boolean)
      const b = multi ? text_b.split('\n') : text_b.split(/\s+/).filter(Boolean)
      if (a.length > 400 || b.length > 400) return 'Texts are too long to compare here (limit about 400 lines or words).'
      const d = diffLines(a, b)
      const changes = d.length
      const same = a.length + b.length - changes
      const sim = a.length + b.length ? (same / (a.length + b.length)) * 100 : 100
      return `${changes ? d.join('\n') : 'The texts are identical.'}\nSimilarity ${round(sim, 0)}% (${multi ? 'by line' : 'by word'}).`
    },
  },
  {
    name: 'readability',
    category: 'Text & data',
    description: 'Readability scores for a text: Flesch reading ease and approximate school grade level.',
    keywords: 'readability flesch reading ease grade level easy to read complexity plain language writing score kincaid text difficulty',
    parameters: { text: { type: 'string', description: 'The text to score' } },
    run: ({ text = '' }) => {
      const words = text.match(/[A-Za-z']+/g) ?? []
      const sentences = Math.max(1, (text.match(/[.!?]+(\s|$)/g) ?? []).length)
      if (words.length < 5) return 'Provide at least a sentence or two.'
      const syl = words.reduce((a, w) => a + syllables(w), 0)
      const wps = words.length / sentences
      const spw = syl / words.length
      const ease = 206.835 - 1.015 * wps - 84.6 * spw
      const grade = 0.39 * wps + 11.8 * spw - 15.59
      const level = ease >= 80 ? 'easy' : ease >= 60 ? 'plain English' : ease >= 40 ? 'fairly difficult' : 'difficult'
      return `Flesch reading ease ${round(ease, 1)} (${level}); about grade ${round(grade, 1)}. ${words.length} words, ${sentences} sentences, ${round(wps, 1)} words per sentence. Shorter sentences and simpler words raise the score.`
    },
  },
  {
    name: 'markdown_table',
    category: 'Text & data',
    description: 'Turn CSV text (with a header row) into a Markdown table.',
    keywords: 'markdown table csv format convert to table pretty print spreadsheet rows columns documentation readme',
    parameters: { csv: { type: 'string', description: 'CSV text with a header row' } },
    run: ({ csv = '' }) => {
      const t = parseCsv(csv)
      if (t.length < 2) return 'Provide CSV with a header row and at least one data row.'
      const [head, ...body] = t
      const line = (r: string[]) => `| ${head.map((_, i) => (r[i] ?? '').replace(/\|/g, '\\|')).join(' | ')} |`
      return [line(head), `| ${head.map(() => '---').join(' | ')} |`, ...body.slice(0, 40).map(line)].join('\n') + (body.length > 40 ? `\n(${body.length - 40} more rows not shown)` : '')
    },
  },
  {
    name: 'csv_json_convert',
    category: 'Text & data',
    description: 'Convert CSV text to JSON, or a JSON array of objects to CSV (direction is detected automatically).',
    keywords: 'csv json convert transform format data conversion export import array objects rows spreadsheet api payload',
    parameters: { text: { type: 'string', description: 'CSV text (with header) or a JSON array' } },
    run: ({ text = '' }) => {
      const t = text.trim()
      if (t.startsWith('[') || t.startsWith('{')) {
        try {
          const data: unknown = JSON.parse(t)
          const arr = (Array.isArray(data) ? data : [data]) as Record<string, unknown>[]
          const cols = [...new Set(arr.flatMap((o) => Object.keys(o)))]
          const cell = (v: unknown) => {
            const s = v === null || v === undefined ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v)
            return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
          }
          return [cols.join(','), ...arr.map((o) => cols.map((c) => cell(o[c])).join(','))].join('\n')
        } catch {
          return 'That looks like JSON but is not valid.'
        }
      }
      const rowsParsed = parseCsv(t)
      if (rowsParsed.length < 2) return 'Provide CSV with a header row and at least one data row.'
      const [head, ...body] = rowsParsed
      return JSON.stringify(body.map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? '']))), null, 2)
    },
  },
  {
    name: 'morse_code',
    category: 'Text & data',
    description: 'Encode text to Morse code or decode Morse code to text.',
    keywords: 'morse code encode decode dots dashes telegraph sos signal cipher',
    parameters: { text: { type: 'string', description: 'Plain text, or Morse using . - with spaces between letters and / between words' } },
    run: ({ text = '' }) => {
      if (/^[.\-/\s]+$/.test(text) && /[.-]/.test(text)) {
        return text.trim().split(/\s*\/\s*/).map((w) => w.split(/\s+/).map((c) => FROM_MORSE[c] ?? '?').join('')).join(' ').toUpperCase()
      }
      return text.toLowerCase().split(/\s+/).map((w) => [...w].map((c) => MORSE[c] ?? '').filter(Boolean).join(' ')).join(' / ')
    },
  },
  {
    name: 'caesar_cipher',
    category: 'Text & data',
    description: 'Encrypt or decrypt text with a Caesar (shift) cipher. For puzzles and learning, not real security.',
    keywords: 'caesar cipher shift encrypt decrypt rot13 secret code puzzle encode letters substitution',
    parameters: {
      text: { type: 'string', description: 'The text' },
      shift: { type: 'string', description: 'Shift amount (default 3; use 13 for ROT13)', optional: true },
      mode: { type: 'string', description: 'encrypt (default) or decrypt', optional: true },
    },
    run: ({ text = '', shift, mode = 'encrypt' }) => {
      const s0 = Number.isFinite(num(shift)) ? Math.round(num(shift)) : 3
      const s = (((/^d/i.test(mode) ? -s0 : s0) % 26) + 26) % 26
      return text.replace(/[a-z]/gi, (c) => {
        const base = c <= 'Z' ? 65 : 97
        return String.fromCharCode(((c.charCodeAt(0) - base + s) % 26) + base)
      })
    },
  },
  {
    name: 'lorem_ipsum',
    category: 'Text & data',
    description: 'Generate placeholder (lorem ipsum) text for mock-ups and templates.',
    keywords: 'lorem ipsum placeholder dummy filler text mockup sample paragraphs design template',
    parameters: { paragraphs: { type: 'string', description: 'Number of paragraphs (default 1, max 5)', optional: true } },
    run: ({ paragraphs }) => {
      const n = Math.min(Math.max(Math.round(num(paragraphs)) || 1, 1), 5)
      return Array.from({ length: n }, () => LOREM).join('\n\n')
    },
  },
  {
    name: 'url_parse',
    category: 'Text & data',
    description: 'Break a URL into protocol, host, port, path, query parameters and fragment.',
    keywords: 'url parse link address query parameters host path domain protocol utm fragment split web address',
    parameters: { url: { type: 'string', description: 'The URL' } },
    run: ({ url = '' }) => {
      try {
        const u = new URL(url.trim())
        const params = [...u.searchParams].map(([k, v]) => `  ${k} = ${v}`)
        return `Protocol ${u.protocol.replace(':', '')}\nHost ${u.hostname}${u.port ? `\nPort ${u.port}` : ''}\nPath ${u.pathname}\nQuery parameters${params.length ? `:\n${params.join('\n')}` : ': none'}${u.hash ? `\nFragment ${u.hash}` : ''}`
      } catch {
        return 'That is not a valid absolute URL (include https://).'
      }
    },
  },
]
