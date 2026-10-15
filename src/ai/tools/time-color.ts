import type { Tool } from '../tool-types'

export const timeColorTools: Tool[] = [
  {
    name: 'timezone_convert',
    category: 'Math & utility',
    description: 'Convert a clock time from one time zone to another (for scheduling meetings across countries).',
    keywords: 'timezone time zone convert meeting schedule world clock manila new york london tokyo utc gmt pst est',
    parameters: {
      time: { type: 'string', description: 'Local time in 24h HH:MM, e.g. 14:30' },
      from_zone: { type: 'string', description: 'IANA zone, e.g. Asia/Manila' },
      to_zone: { type: 'string', description: 'IANA zone, e.g. America/New_York' },
      date: { type: 'string', description: 'Date YYYY-MM-DD (default today)', optional: true },
    },
    run: ({ time, from_zone, to_zone, date }) => {
      const m = /^(\d{1,2}):(\d{2})$/.exec((time ?? '').trim())
      if (!m) return 'Give the time as HH:MM (24-hour).'
      const day = date?.trim() || new Date().toISOString().slice(0, 10)
      try {
        // Find the UTC instant whose wall-clock time in from_zone equals the requested time.
        const wanted = Date.UTC(+day.slice(0, 4), +day.slice(5, 7) - 1, +day.slice(8, 10), +m[1], +m[2])
        const wallClock = (zone: string, t: number) => {
          const parts = new Intl.DateTimeFormat('en-US', {
            timeZone: zone,
            hourCycle: 'h23',
            year: 'numeric',
            month: 'numeric',
            day: 'numeric',
            hour: 'numeric',
            minute: 'numeric',
          }).formatToParts(new Date(t))
          const p = Object.fromEntries(parts.map((x) => [x.type, +x.value]))
          return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute)
        }
        const offset = wallClock(from_zone, wanted) - wanted
        const out = new Date(wanted - offset).toLocaleString('en-US', {
          timeZone: to_zone,
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        })
        return `${day} ${time} in ${from_zone} = ${out} in ${to_zone}`
      } catch {
        return 'Unknown time zone. Use IANA names like Asia/Manila or Europe/London.'
      }
    },
  },
  {
    name: 'color_convert',
    category: 'Math & utility',
    description: 'Convert a colour between hex (#RRGGBB), RGB and HSL.',
    keywords: 'color colour hex rgb hsl convert code palette css',
    parameters: { color: { type: 'string', description: 'A hex code like #2f5bea, or rgb like 47,91,234' } },
    run: ({ color = '' }) => {
      const c = color.trim()
      const hex = /^#?([0-9a-f]{6})$/i.exec(c)
      const rgbMatch = /^(?:rgb\()?\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)?$/i.exec(c)
      const rgb = hex
        ? [0, 2, 4].map((i) => parseInt(hex[1].slice(i, i + 2), 16))
        : rgbMatch
          ? rgbMatch.slice(1, 4).map(Number)
          : null
      if (!rgb || rgb.some((v) => v > 255)) return 'Give a hex code (#RRGGBB) or three RGB numbers.'
      const [r, g, b] = rgb.map((v) => v / 255)
      const max = Math.max(r, g, b)
      const min = Math.min(r, g, b)
      const l = (max + min) / 2
      const d = max - min
      const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1))
      const h = d === 0 ? 0 : max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
      const hexOut = '#' + rgb.map((v) => v.toString(16).padStart(2, '0')).join('')
      return `${hexOut} = rgb(${rgb.join(', ')}) = hsl(${Math.round(h * 60)}, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%)`
    },
  },
]
