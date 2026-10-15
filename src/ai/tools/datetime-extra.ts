import type { Tool } from '../tool-types'
import { dateOf, isoDay, num } from './helpers'

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const DEFAULT_ZONES = ['UTC', 'Asia/Manila', 'Asia/Tokyo', 'Europe/London', 'America/New_York', 'America/Los_Angeles', 'Australia/Sydney']

const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0

export const dateTimeExtraTools: Tool[] = [
  {
    name: 'age_calc',
    category: 'Date & time',
    description: 'Exact age or time elapsed since a date (years, months, days), plus days until the next birthday or anniversary.',
    keywords: 'age birthday birthdate how old years months days since tenure anniversary elapsed born next birthday service length',
    parameters: {
      birth_date: { type: 'string', description: 'Birth or start date YYYY-MM-DD' },
      as_of: { type: 'string', description: 'Compare to this date (default today)', optional: true },
    },
    run: ({ birth_date, as_of }) => {
      const b = dateOf(birth_date)
      const t = dateOf(as_of)
      if (!b || !t || !birth_date?.trim()) return 'Provide a valid date as YYYY-MM-DD.'
      if (b > t) return 'The start date is after the comparison date.'
      let years = t.getUTCFullYear() - b.getUTCFullYear()
      let months = t.getUTCMonth() - b.getUTCMonth()
      let days = t.getUTCDate() - b.getUTCDate()
      if (days < 0) {
        months--
        days += new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), 0)).getUTCDate()
      }
      if (months < 0) {
        years--
        months += 12
      }
      let next = new Date(Date.UTC(t.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate()))
      if (next < t) next = new Date(Date.UTC(t.getUTCFullYear() + 1, b.getUTCMonth(), b.getUTCDate()))
      const total = Math.round((t.getTime() - b.getTime()) / 86400000)
      return `${years} years, ${months} months, ${days} days (${total.toLocaleString('en-US')} days in total). Next anniversary: ${isoDay(next)}, in ${Math.round((next.getTime() - t.getTime()) / 86400000)} days. Born on a ${WEEKDAYS[b.getUTCDay()]}.`
    },
  },
  {
    name: 'day_of_week',
    category: 'Date & time',
    description: 'Day of the week, ISO week number, day of the year and leap-year status for a date.',
    keywords: 'day of week weekday what day monday tuesday week number day of year leap year calendar date falls on',
    parameters: { date: { type: 'string', description: 'Date YYYY-MM-DD (default today)', optional: true } },
    run: ({ date }) => {
      const d = dateOf(date)
      if (!d) return 'Provide a valid date as YYYY-MM-DD.'
      const startOfYear = Date.UTC(d.getUTCFullYear(), 0, 1)
      const doy = Math.floor((d.getTime() - startOfYear) / 86400000) + 1
      const thursday = new Date(d.getTime() + (3 - ((d.getUTCDay() + 6) % 7)) * 86400000)
      const week = Math.ceil(((thursday.getTime() - Date.UTC(thursday.getUTCFullYear(), 0, 1)) / 86400000 + 1) / 7)
      return `${isoDay(d)} is a ${WEEKDAYS[d.getUTCDay()]}; ISO week ${week}, day ${doy} of ${isLeap(d.getUTCFullYear()) ? 366 : 365}; ${d.getUTCFullYear()} is ${isLeap(d.getUTCFullYear()) ? '' : 'not '}a leap year.`
    },
  },
  {
    name: 'unix_time',
    category: 'Date & time',
    description: 'Convert a Unix timestamp (seconds or milliseconds) to a date, or a date to a Unix timestamp.',
    keywords: 'unix timestamp epoch convert seconds milliseconds date time posix utc iso 8601 programming log time',
    parameters: { value: { type: 'string', description: 'A timestamp like 1700000000, or a date/time like 2026-10-14T08:30:00Z' } },
    run: ({ value = '' }) => {
      const v = value.trim()
      if (/^-?\d{9,13}$/.test(v)) {
        const n = Number(v)
        const ms = Math.abs(n) >= 1e11 ? n : n * 1000
        const d = new Date(ms)
        return `${v} = ${d.toISOString()} (UTC); local ${d.toLocaleString()}.`
      }
      const d = new Date(v)
      if (Number.isNaN(d.getTime())) return 'Give a timestamp (9-13 digits) or a date like 2026-10-14T08:30:00Z.'
      return `${d.toISOString()} = ${Math.floor(d.getTime() / 1000)} seconds (${d.getTime()} ms) since 1970-01-01 UTC.`
    },
  },
  {
    name: 'calendar_month',
    category: 'Date & time',
    description: 'Show a text calendar for a month.',
    keywords: 'calendar month show calendar dates weekdays grid october planner days of the month print',
    parameters: {
      year: { type: 'string', description: 'Year (default this year)', optional: true },
      month: { type: 'string', description: 'Month 1-12 (default this month)', optional: true },
    },
    run: ({ year, month }) => {
      const now = new Date()
      const y = Number.isFinite(num(year)) ? Math.round(num(year)) : now.getFullYear()
      const m = Number.isFinite(num(month)) ? Math.round(num(month)) : now.getMonth() + 1
      if (m < 1 || m > 12 || y < 1 || y > 9999) return 'Provide a month from 1 to 12 and a valid year.'
      const first = new Date(Date.UTC(y, m - 1, 1)).getUTCDay()
      const days = new Date(Date.UTC(y, m, 0)).getUTCDate()
      const title = new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })
      const cells = [...Array<string>(first).fill('  '), ...Array.from({ length: days }, (_, i) => String(i + 1).padStart(2, ' '))]
      const lines = []
      for (let i = 0; i < cells.length; i += 7) lines.push(cells.slice(i, i + 7).join(' '))
      return `${title}\nSu Mo Tu We Th Fr Sa\n${lines.join('\n')}`
    },
  },
  {
    name: 'world_clock',
    category: 'Date & time',
    description: 'Current time in several cities / time zones at once.',
    keywords: 'world clock time zones now cities current time everywhere meeting planner london tokyo new york sydney manila utc',
    parameters: { zones: { type: 'string', description: 'IANA zones separated by commas, e.g. "Asia/Manila, Europe/Paris" (default: a standard set)', optional: true } },
    run: ({ zones }) => {
      const list = zones?.trim() ? zones.split(/[,;]+/).map((z) => z.trim()).filter(Boolean) : DEFAULT_ZONES
      const out = list.map((z) => {
        try {
          return `${z}: ${new Date().toLocaleString('en-US', { timeZone: z, weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false, month: 'short', day: 'numeric' })}`
        } catch {
          return `${z}: unknown time zone`
        }
      })
      return out.join('\n')
    },
  },
]
