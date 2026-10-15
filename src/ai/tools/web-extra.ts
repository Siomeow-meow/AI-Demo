import type { Tool } from '../tool-types'
import { getJson } from './web'

// More free, key-less, browser-friendly APIs (all optional via the "Internet tools" switch).

export const webExtraTools: Tool[] = [
  {
    name: 'public_holidays',
    category: 'Internet',
    network: true,
    description: 'List the public holidays of a country for a year.',
    keywords: 'holiday holidays public holiday day off calendar national long weekend country year',
    parameters: {
      country_code: { type: 'string', description: '2-letter ISO code, e.g. PH, US, GB, JP' },
      year: { type: 'string', description: 'Year, e.g. 2026 (default this year)', optional: true },
    },
    run: async ({ country_code, year }) => {
      const y = year?.trim() || String(new Date().getFullYear())
      try {
        const list = await getJson<{ date: string; name: string }[]>(
          `https://date.nager.at/api/v3/PublicHolidays/${encodeURIComponent(y)}/${encodeURIComponent(country_code.toUpperCase())}`,
        )
        return list.length ? list.map((h) => `${h.date} ${h.name}`).join('\n') : 'No holidays found.'
      } catch (e) {
        return `Holiday lookup failed: ${(e as Error).message} (check the 2-letter country code).`
      }
    },
  },
  {
    name: 'synonyms',
    category: 'Internet',
    network: true,
    description: 'Find synonyms, antonyms or rhymes for a word.',
    keywords: 'synonym synonyms similar word thesaurus another word for rhyme antonym opposite alternative',
    parameters: {
      word: { type: 'string', description: 'The word' },
      kind: { type: 'string', description: 'synonyms (default), antonyms or rhymes', optional: true },
    },
    run: async ({ word, kind = 'synonyms' }) => {
      const rel = /rhym/i.test(kind) ? 'rel_rhy' : /ant/i.test(kind) ? 'rel_ant' : 'rel_syn'
      try {
        const list = await getJson<{ word: string }[]>(`https://api.datamuse.com/words?${rel}=${encodeURIComponent(word)}&max=10`)
        return list.length ? list.map((w) => w.word).join(', ') : `No results for "${word}".`
      } catch (e) {
        return `Word lookup failed: ${(e as Error).message}`
      }
    },
  },
  {
    name: 'book_search',
    category: 'Internet',
    network: true,
    description: 'Search Open Library for books by title, author or topic.',
    keywords: 'book books author novel read library isbn publication title find book',
    parameters: { query: { type: 'string', description: 'Title, author or topic' } },
    run: async ({ query }) => {
      try {
        const r = await getJson<{ docs: { title: string; author_name?: string[]; first_publish_year?: number }[] }>(
          `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=5&fields=title,author_name,first_publish_year`,
        )
        return r.docs.length
          ? r.docs
              .map((b) => `${b.title} by ${b.author_name?.slice(0, 2).join(', ') ?? 'unknown'} (${b.first_publish_year ?? 'n/a'})`)
              .join('\n')
          : 'No books found.'
      } catch (e) {
        return `Book search failed: ${(e as Error).message}`
      }
    },
  },
  {
    name: 'tech_news',
    category: 'Internet',
    network: true,
    description: 'Show the current top stories on Hacker News (technology news).',
    keywords: 'news tech technology headlines latest stories hacker news trending startup software',
    parameters: {},
    run: async () => {
      try {
        const ids = (await getJson<number[]>('https://hacker-news.firebaseio.com/v0/topstories.json')).slice(0, 5)
        const items = await Promise.all(
          ids.map((id) => getJson<{ title: string; url?: string; score: number }>(`https://hacker-news.firebaseio.com/v0/item/${id}.json`)),
        )
        return items.map((s, i) => `${i + 1}. ${s.title} (${s.score} points)${s.url ? ` ${s.url}` : ''}`).join('\n')
      } catch (e) {
        return `News lookup failed: ${(e as Error).message}`
      }
    },
  },
]
