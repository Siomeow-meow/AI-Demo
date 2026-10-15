import type { Tool } from '../tool-types'
import { num, nums, ok, round, rows } from './helpers'

const GRADE_POINTS: Record<string, number> = {
  'A+': 4, A: 4, 'A-': 3.7, 'B+': 3.3, B: 3, 'B-': 2.7, 'C+': 2.3, C: 2, 'C-': 1.7, 'D+': 1.3, D: 1, F: 0,
}

/** Fair shuffle using the browser's crypto random numbers. */
function shuffle<T>(list: T[]): T[] {
  const a = [...list]
  const r = crypto.getRandomValues(new Uint32Array(a.length))
  for (let i = a.length - 1; i > 0; i--) {
    const j = r[i] % (i + 1)
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

const splitList = (s: string | undefined) =>
  (s ?? '')
    .split(/[,;\n]+/)
    .map((x) => x.trim())
    .filter(Boolean)

const rad = (d: number) => (d * Math.PI) / 180

export const educationTools: Tool[] = [
  {
    name: 'grade_calc',
    category: 'Education & decisions',
    description: 'Weighted grade from scores and their weights, and the score needed on the remaining work to reach a target.',
    keywords: 'grade weighted average score final exam target needed what do i need class course marks percentage assignments homework weights',
    parameters: {
      scores: { type: 'string', description: 'Pairs of score:weight like "85:30; 90:20; 78:10" (weights in percent)' },
      target: { type: 'string', description: 'Final grade you want', optional: true },
      remaining_weight: { type: 'string', description: 'Weight in percent of the work still to come', optional: true },
    },
    run: ({ scores, target, remaining_weight }) => {
      const pairs = rows(scores).map((l) => l.split(':').map(num))
      if (!pairs.length || pairs.some((p) => p.length !== 2 || !ok(...p))) return 'Write scores as score:weight pairs separated by ;.'
      const wDone = pairs.reduce((a, [, w]) => a + w, 0)
      const points = pairs.reduce((a, [s, w]) => a + s * w, 0)
      let out = `Weighted average of completed work: ${round(points / wDone, 2)} (using ${wDone}% of the grade).`
      const t = num(target)
      const rem = num(remaining_weight)
      if (ok(t, rem) && rem > 0) {
        const need = (t * (wDone + rem) - points) / rem
        out += ` To finish with ${t}, you need an average of ${round(need, 2)} on the remaining ${rem}%${need > 100 ? ' (above 100: very hard or impossible)' : need < 0 ? ' (already secured)' : ''}.`
      }
      return out
    },
  },
  {
    name: 'gpa_calc',
    category: 'Education & decisions',
    description: 'GPA on a 4.0 scale from letter grades and credit units.',
    keywords: 'gpa grade point average letter grades credits units semester college university transcript cumulative academic',
    parameters: { courses: { type: 'string', description: 'Pairs of grade:credits like "A:3; B+:4; C:2"' } },
    run: ({ courses }) => {
      const list = rows(courses).map((l) => {
        const [g, c] = l.split(':')
        return { g: (g ?? '').trim().toUpperCase(), c: num(c) }
      })
      if (!list.length || list.some((x) => !(x.g in GRADE_POINTS) || !ok(x.c) || x.c <= 0)) {
        return `Write grade:credits pairs using ${Object.keys(GRADE_POINTS).join(', ')}.`
      }
      const credits = list.reduce((a, x) => a + x.c, 0)
      const points = list.reduce((a, x) => a + GRADE_POINTS[x.g] * x.c, 0)
      return `GPA ${round(points / credits, 2)} over ${credits} credits (4.0 scale: A=4.0, B=3.0, C=2.0, D=1.0, F=0).`
    },
  },
  {
    name: 'random_pick',
    category: 'Education & decisions',
    description: 'Pick one or more random items from a list (raffle, who goes first, what to eat).',
    keywords: 'random pick choose draw raffle winner select one from list decide lottery who goes first choice shuffle',
    parameters: {
      options: { type: 'string', description: 'Options separated by commas or new lines' },
      count: { type: 'string', description: 'How many to pick (default 1)', optional: true },
    },
    run: ({ options, count }) => {
      const list = splitList(options)
      if (!list.length) return 'Provide a list of options.'
      const n = Math.min(Math.max(Math.round(num(count)) || 1, 1), list.length)
      return `Picked: ${shuffle(list).slice(0, n).join(', ')}`
    },
  },
  {
    name: 'team_splitter',
    category: 'Education & decisions',
    description: 'Randomly split a list of people into a number of balanced teams.',
    keywords: 'team split groups divide people random teams classmates groupmates assign balanced members pairs',
    parameters: {
      names: { type: 'string', description: 'Names separated by commas' },
      teams: { type: 'string', description: 'Number of teams' },
    },
    run: ({ names, teams }) => {
      const list = splitList(names)
      const n = Math.round(num(teams))
      if (list.length < 2 || !Number.isFinite(n) || n < 2 || n > list.length) return 'Provide at least 2 names and a team count between 2 and the number of names.'
      const groups: string[][] = Array.from({ length: n }, () => [])
      shuffle(list).forEach((p, i) => groups[i % n].push(p))
      return groups.map((g, i) => `Team ${i + 1}: ${g.join(', ')}`).join('\n')
    },
  },
  {
    name: 'weighted_score',
    category: 'Education & decisions',
    description: 'Decision matrix: rank options by weighted scores against your criteria.',
    keywords: 'decision matrix weighted scoring compare options choose best vendor supplier laptop criteria weights rank evaluate pros cons selection',
    parameters: {
      criteria: { type: 'string', description: 'Criteria with weights, e.g. "cost:5, quality:3, speed:2"' },
      options: { type: 'string', description: 'One option per line: "Name: score, score, score" in the same order as the criteria, e.g. "Vendor A: 7, 9, 6; Vendor B: 8, 6, 9"' },
    },
    run: ({ criteria = '', options }) => {
      const crit = splitList(criteria).map((c) => {
        const [name, w] = c.split(':')
        return { name: name.trim(), w: num(w) }
      })
      if (!crit.length || crit.some((c) => !ok(c.w))) return 'Write criteria as name:weight, e.g. cost:5, quality:3.'
      const opts = rows(options).map((l) => {
        const i = l.indexOf(':')
        return { name: l.slice(0, i).trim(), s: nums(l.slice(i + 1)) }
      })
      if (opts.length < 2 || opts.some((o) => o.s.length !== crit.length || !ok(...o.s))) return `Give at least two options, each with ${crit.length} scores.`
      const wsum = crit.reduce((a, c) => a + c.w, 0)
      const ranked = opts
        .map((o) => ({ name: o.name, score: o.s.reduce((a, s, i) => a + s * crit[i].w, 0) / wsum }))
        .sort((a, b) => b.score - a.score)
      return `${ranked.map((r, i) => `${i + 1}. ${r.name}: ${round(r.score, 2)}`).join('\n')}\nWinner: ${ranked[0].name} (criteria weighted ${crit.map((c) => `${c.name} ${c.w}`).join(', ')}).`
    },
  },
  {
    name: 'distance_between',
    category: 'Education & decisions',
    description: 'Straight-line (great-circle) distance and initial bearing between two latitude/longitude points.',
    keywords: 'distance between two places coordinates latitude longitude haversine how far km miles bearing map gps cities flight',
    parameters: {
      lat1: { type: 'string', description: 'Latitude of point 1' },
      lon1: { type: 'string', description: 'Longitude of point 1' },
      lat2: { type: 'string', description: 'Latitude of point 2' },
      lon2: { type: 'string', description: 'Longitude of point 2' },
    },
    run: ({ lat1, lon1, lat2, lon2 }) => {
      const [a, b, c, d] = [lat1, lon1, lat2, lon2].map(num)
      if (!ok(a, b, c, d) || Math.abs(a) > 90 || Math.abs(c) > 90 || Math.abs(b) > 180 || Math.abs(d) > 180) return 'Provide valid latitudes (-90..90) and longitudes (-180..180).'
      const dLat = rad(c - a)
      const dLon = rad(d - b)
      const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a)) * Math.cos(rad(c)) * Math.sin(dLon / 2) ** 2
      const km = 2 * 6371 * Math.asin(Math.sqrt(h))
      const y = Math.sin(dLon) * Math.cos(rad(c))
      const x = Math.cos(rad(a)) * Math.sin(rad(c)) - Math.sin(rad(a)) * Math.cos(rad(c)) * Math.cos(dLon)
      const bearing = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360
      return `${round(km, 1)} km (${round(km * 0.621371, 1)} miles) in a straight line; initial bearing ${round(bearing, 0)}°. Road distance is usually longer.`
    },
  },
]
