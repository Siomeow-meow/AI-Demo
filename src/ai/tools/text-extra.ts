import type { Tool } from '../tool-types'

const STOP = new Set(
  'the a an and or of to in on for with is are was were be it this that as at by from not but they you we he she his her our their its have has had will would can could'.split(
    ' ',
  ),
)

export const textExtraTools: Tool[] = [
  {
    name: 'extract_entities',
    category: 'Text & data',
    description: 'Pull email addresses, URLs, phone numbers and dates out of a block of text.',
    keywords: 'extract find emails urls links phone numbers dates parse contact details from text',
    parameters: { text: { type: 'string', description: 'The text to scan' } },
    run: ({ text }) => {
      const uniq = (a: string[] | null) => [...new Set(a ?? [])]
      const found = {
        emails: uniq(text.match(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g)),
        urls: uniq(text.match(/https?:\/\/[^\s)>"]+/g)),
        phones: uniq(text.match(/\+?\d[\d\s().-]{7,}\d/g)).filter(
          (p) => !/^\d{4}-\d{2}-\d{2}$/.test(p) && p.replace(/\D/g, '').length >= 9,
        ),
        dates: uniq(text.match(/\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g)),
      }
      const lines = Object.entries(found)
        .filter(([, v]) => v.length)
        .map(([k, v]) => `${k}: ${v.join(', ')}`)
      return lines.length ? lines.join('\n') : 'Nothing found.'
    },
  },
  {
    name: 'word_frequency',
    category: 'Text & data',
    description: 'Find the most common words (keywords) in a text, ignoring filler words.',
    keywords: 'word frequency keywords common words top terms most used analyze text topics',
    parameters: { text: { type: 'string', description: 'The text to analyse' } },
    run: ({ text }) => {
      const counts = new Map<string, number>()
      for (const w of text.toLowerCase().match(/[a-z']{3,}/g) ?? []) {
        if (!STOP.has(w)) counts.set(w, (counts.get(w) ?? 0) + 1)
      }
      const top = [...counts].sort((a, b) => b[1] - a[1]).slice(0, 10)
      return top.length ? top.map(([w, n]) => `${w} (${n})`).join(', ') : 'No keywords found.'
    },
  },
  {
    name: 'regex_test',
    category: 'Text & data',
    description: 'Test a regular expression against some text and list the matches.',
    keywords: 'regex regular expression pattern match test find all',
    parameters: {
      pattern: { type: 'string', description: 'Regex pattern without slashes, e.g. \\d+' },
      text: { type: 'string', description: 'Text to search' },
      flags: { type: 'string', description: 'Flags such as i (g is always added)', optional: true },
    },
    run: ({ pattern, text, flags = '' }) => {
      try {
        const re = new RegExp(pattern, flags.includes('g') ? flags : `${flags}g`)
        const all = [...text.matchAll(re)].slice(0, 20).map((m) => m[0])
        return all.length ? `${all.length} match(es): ${all.map((m) => JSON.stringify(m)).join(', ')}` : 'No matches.'
      } catch (e) {
        return `Invalid regex: ${(e as Error).message}`
      }
    },
  },
  {
    name: 'list_tool',
    category: 'Text & data',
    description: 'Sort, de-duplicate, reverse or count items in a list separated by commas or new lines.',
    keywords: 'list sort alphabetical dedupe duplicates unique reverse count items order remove duplicates',
    parameters: {
      items: { type: 'string', description: 'Items separated by commas or new lines' },
      action: { type: 'string', description: 'sort, dedupe, reverse or count' },
    },
    run: ({ items, action = 'sort' }) => {
      const list = items
        .split(/[\n,]+/)
        .map((s) => s.trim())
        .filter(Boolean)
      if (/count/i.test(action)) return `${list.length} items (${new Set(list).size} unique).`
      if (/dedup|uniq/i.test(action)) return [...new Set(list)].join(', ')
      if (/rev/i.test(action)) return [...list].reverse().join(', ')
      return [...list].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).join(', ')
    },
  },
]
