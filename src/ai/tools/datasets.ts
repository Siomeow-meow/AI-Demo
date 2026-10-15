import { datasetStore } from '../data'
import type { Dataset } from '../data'
import type { Tool } from '../tool-types'

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')

function findDataset(name: string | undefined): Dataset | string {
  const all = datasetStore.get()
  if (!all.length) return 'No tables attached yet. Attach a CSV, Excel or JSON file in the chat (the paperclip button).'
  const q = norm(name ?? '')
  const hit = all.find((d) => norm(d.name) === q) ?? all.find((d) => q && (norm(d.name).includes(q) || q.includes(norm(d.name))))
  if (hit) return hit
  if (all.length === 1) return all[0] // a single table: no need to get the name exactly right
  return `Unknown dataset "${name}". Available: ${all.map((d) => d.name).join(', ')}`
}

function colIndex(d: Dataset, name: string): number {
  const q = norm(name)
  const exact = d.headers.findIndex((h) => norm(h) === q)
  return exact >= 0 ? exact : d.headers.findIndex((h) => q && norm(h).includes(q))
}

const toNum = (s: string) => Number(s.replace(/[,₱$%\s]/g, ''))

type Test = (row: string[]) => boolean

/** Parse conditions like "region=North; revenue>400000" (separate with ; or "and"). Plain words match any cell. */
function parseWhere(d: Dataset, where: string | undefined): Test | string {
  const parts = (where ?? '').split(/;|\band\b/i).map((p) => p.trim()).filter(Boolean)
  const tests: Test[] = []
  for (const part of parts) {
    const inList = /^(.+?)\s+(not\s+)?in\s*\(([^)]*)\)\s*$/i.exec(part)
    if (inList) {
      const i = colIndex(d, inList[1])
      if (i < 0) return `Unknown column "${inList[1]}". Columns: ${d.headers.join(', ')}`
      const wanted = new Set(inList[3].split(',').map((v) => v.trim().replace(/^["']|["']$/g, '').toLowerCase()).filter(Boolean))
      const negate = !!inList[2]
      tests.push((row) => wanted.has((row[i] ?? '').toLowerCase()) !== negate)
      continue
    }
    const m = /^(.+?)\s*(>=|<=|!=|=|>|<|~)\s*(.+)$/.exec(part)
    if (!m) {
      const needle = part.toLowerCase()
      tests.push((row) => row.some((c) => c.toLowerCase().includes(needle)))
      continue
    }
    const [, col, op, rawValue] = m
    const i = colIndex(d, col)
    if (i < 0) return `Unknown column "${col}". Columns: ${d.headers.join(', ')}`
    const value = rawValue.trim().replace(/^["']|["']$/g, '')
    tests.push((row) => {
      const cell = row[i] ?? ''
      if (op === '~') return cell.toLowerCase().includes(value.toLowerCase())
      const numeric = cell !== '' && value !== '' && Number.isFinite(toNum(cell)) && Number.isFinite(toNum(value))
      const a = numeric ? toNum(cell) : cell.toLowerCase()
      const b = numeric ? toNum(value) : value.toLowerCase()
      return op === '=' ? a === b : op === '!=' ? a !== b : op === '>' ? a > b : op === '<' ? a < b : op === '>=' ? a >= b : a <= b
    })
  }
  return (row) => tests.every((t) => t(row))
}

/** The first column that is mostly numbers and does not look like an id. */
function defaultNumericColumn(d: Dataset): number {
  return d.headers.findIndex((h, i) => {
    if (/(^|_|\s)(id|no|number|code|zip)$/i.test(h)) return false
    const values = d.rows.map((r) => r[i] ?? '').filter((v) => v !== '')
    return values.length > 0 && values.filter((v) => Number.isFinite(toNum(v))).length >= values.length * 0.8
  })
}

/** Routing words for the dataset tools: table names, column headers and the cell values (capped for speed). */
function datasetWords(): string {
  return datasetStore
    .get()
    .map((d) => `${d.name.replace(/_/g, ' ')} ${d.headers.join(' ')} ${d.rows.slice(0, 2000).map((r) => r.join(' ')).join(' ')}`)
    .join(' ')
    .slice(0, 100000)
}

/** Sum and average of the numeric columns over the given rows (skips id-like columns). */
function numericTotals(d: Dataset, rows: string[][]): string {
  const parts: string[] = []
  d.headers.forEach((h, i) => {
    if (/(^|_|\s)(id|no|number|code|zip)$/i.test(h) || parts.length >= 4) return
    const values = rows.map((r) => r[i] ?? '').filter((v) => v !== '')
    const nums = values.map(toNum).filter(Number.isFinite)
    if (!values.length || nums.length < values.length * 0.8) return
    const sum = nums.reduce((a, b) => a + b, 0)
    parts.push(`${h} sum ${+sum.toFixed(2)}, average ${+(sum / nums.length).toFixed(2)}`)
  })
  return parts.join('; ')
}

const fmtRow =(d: Dataset, row: string[]) => d.headers.map((h, i) => `${h}: ${row[i]}`).join(', ')

export const datasetTools: Tool[] = [
  {
    name: 'list_datasets',
    category: 'Your data',
    description: 'List the data tables (CSV/JSON files) that were imported, with their columns and row counts.',
    keywords: 'datasets tables data files spreadsheet csv imported columns what data do you have available',
    dynamicKeywords: datasetWords,
    parameters: {},
    run: () => {
      const all = datasetStore.get()
      return all.length
        ? all.map((d) => `${d.name}: ${d.rows.length} rows; columns: ${d.headers.join(', ')}`).join('\n')
        : 'No tables attached yet. Attach a CSV, Excel or JSON file in the chat (the paperclip button).'
    },
  },
  {
    name: 'query_dataset',
    category: 'Your data',
    description: 'Find rows in an imported data table. Filter with conditions like "region=North; revenue>400000" (operators = != > < >= <= ~ for contains).',
    keywords: 'dataset table rows filter find lookup records query csv spreadsheet show me where search data entries',
    dynamicKeywords: datasetWords,
    parameters: {
      dataset: { type: 'string', description: 'Name of the dataset (see list_datasets)' },
      where: { type: 'string', description: 'Conditions separated by ";", e.g. status=open; amount>100. Empty for all rows.', optional: true },
      limit: { type: 'string', description: 'Max rows to return (default 10, max 25)', optional: true },
    },
    run: ({ dataset, where, limit }) => {
      const d = findDataset(dataset)
      if (typeof d === 'string') return d
      const test = parseWhere(d, where)
      if (typeof test === 'string') return test
      const matches = d.rows.filter(test)
      const n = Math.min(Math.max(parseInt(limit ?? '10', 10) || 10, 1), 25)
      if (!matches.length) return `No rows match in ${d.name} (${d.rows.length} rows total).`
      const totals = numericTotals(d, matches)
      return `${matches.length} of ${d.rows.length} rows match${matches.length > n ? ` (showing ${n})` : ''}:\n${matches
        .slice(0, n)
        .map((r) => fmtRow(d, r))
        .join('\n')}${totals ? `\nExact totals over all ${matches.length} matching rows: ${totals}` : ''}`
    },
  },
  {
    name: 'profile_dataset',
    category: 'Your data',
    description: 'Describe an imported data table: row count, each column type, missing values, unique counts, numeric min / max / average and the most common values. Use this first on a newly attached file.',
    keywords: 'profile describe summary overview dataset columns types missing values statistics explore understand attached file data quality what is in this file spreadsheet csv excel',
    dynamicKeywords: datasetWords,
    parameters: { dataset: { type: 'string', description: 'Name of the dataset (see list_datasets)', optional: true } },
    run: ({ dataset }) => {
      const d = findDataset(dataset)
      if (typeof d === 'string') return d
      const lines = d.headers.slice(0, 20).map((h, i) => {
        const all = d.rows.map((r) => r[i] ?? '')
        const filled = all.filter((v) => v !== '')
        const missing = all.length - filled.length
        const numbers = filled.map(toNum).filter(Number.isFinite)
        const dates = filled.filter((v) => /^\d{4}-\d{2}-\d{2}/.test(v))
        const unique = new Set(filled).size
        const base = `- ${h}`
        if (filled.length && numbers.length >= filled.length * 0.8) {
          const sum = numbers.reduce((a, b) => a + b, 0)
          return `${base} (number): ${filled.length} filled, ${missing} missing; min ${Math.min(...numbers)}, max ${Math.max(...numbers)}, mean ${+(sum / numbers.length).toFixed(2)}, sum ${+sum.toFixed(2)}${numbers.length < filled.length ? ` (${filled.length - numbers.length} non-numeric value(s) ignored)` : ''}`
        }
        if (filled.length && dates.length >= filled.length * 0.8) {
          const sorted = [...dates].sort()
          return `${base} (date): ${filled.length} filled, ${missing} missing; from ${sorted[0]} to ${sorted[sorted.length - 1]}`
        }
        const freq = new Map<string, number>()
        for (const v of filled) freq.set(v, (freq.get(v) ?? 0) + 1)
        const top = [...freq].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([v, n]) => `${v.slice(0, 30)} (${n})`)
        return `${base} (text): ${filled.length} filled, ${missing} missing, ${unique} unique; top: ${top.join(', ') || 'none'}`
      })
      return `${d.name}: ${d.rows.length} rows, ${d.headers.length} columns.\n${lines.join('\n')}${d.headers.length > 20 ? `\n(${d.headers.length - 20} more columns not shown)` : ''}`
    },
  },
  {
    name: 'aggregate_dataset',
    category: 'Your data',
    description: 'Calculate sum, average, min, max or count over a column of an imported data table. To compare groups (which region or product is highest, totals per category) set group_by to the grouping column; do NOT filter with where for that.',
    keywords: 'total sum average mean minimum maximum count how many per by group dataset column statistics analyze csv spreadsheet',
    dynamicKeywords: datasetWords,
    parameters: {
      dataset: { type: 'string', description: 'Name of the dataset' },
      operation: { type: 'string', description: 'sum, avg, min, max or count' },
      column: { type: 'string', description: 'Column to calculate over (not needed for count)', optional: true },
      group_by: { type: 'string', description: 'Column to group results by, e.g. region. Use it for "which is highest" and "per category" questions', optional: true },
      where: { type: 'string', description: 'Optional filter conditions, same format as query_dataset', optional: true },
    },
    run: ({ dataset, operation = 'count', column, group_by, where }) => {
      const d = findDataset(dataset)
      if (typeof d === 'string') return d
      const test = parseWhere(d, where)
      if (typeof test === 'string') return test
      const rows = d.rows.filter(test)
      const op = operation.toLowerCase().replace(/^(average|mean)$/, 'avg')
      if (!['sum', 'avg', 'min', 'max', 'count'].includes(op)) return 'Operation must be sum, avg, min, max or count.'
      let ci = column ? colIndex(d, column) : -1
      if (op !== 'count' && ci < 0 && !column) ci = defaultNumericColumn(d) // models sometimes forget the column
      if (op !== 'count' && ci < 0) return `Unknown column "${column ?? ''}". Columns: ${d.headers.join(', ')}`
      const gi = group_by ? colIndex(d, group_by) : -1
      if (group_by && gi < 0) return `Unknown group column "${group_by}". Columns: ${d.headers.join(', ')}`

      const calc = (subset: string[][]) => {
        if (op === 'count') return subset.length
        const nums = subset.map((r) => toNum(r[ci])).filter(Number.isFinite)
        if (!nums.length) return NaN
        if (op === 'sum') return nums.reduce((a, b) => a + b, 0)
        if (op === 'avg') return nums.reduce((a, b) => a + b, 0) / nums.length
        return op === 'min' ? Math.min(...nums) : Math.max(...nums)
      }
      const show = (n: number) => (Number.isFinite(n) ? +n.toFixed(2) : 'n/a').toLocaleString()
      if (!rows.length) return `No rows match the condition "${where ?? ''}" in ${d.name} (${d.rows.length} rows). Check the spelling, or leave where empty.`
      const label = `${op}${op === 'count' ? '' : ` of ${d.headers[ci]}`} in ${d.name} (${rows.length} rows)`
      if (gi < 0) return `${label}: ${show(calc(rows))}`

      const groups = new Map<string, string[][]>()
      for (const r of rows) groups.set(r[gi], [...(groups.get(r[gi]) ?? []), r])
      const sorted = [...groups]
        .map(([k, v]) => [k, calc(v)] as const)
        .sort((a, b) => (Number.isFinite(b[1]) ? b[1] : -Infinity) - (Number.isFinite(a[1]) ? a[1] : -Infinity))
        .slice(0, 20)
      const top = Math.max(0, ...sorted.map(([, v]) => (Number.isFinite(v) ? v : 0)))
      const bar = (v: number) => (top > 0 && Number.isFinite(v) && v > 0 ? '█'.repeat(Math.max(1, Math.round((v / top) * 16))) : '')
      const lines = sorted.map(([k, v]) => `${k}: ${show(v)} ${bar(v)}`)
      return `${label}, by ${d.headers[gi]}:\n${lines.join('\n')}`
    },
  },
]
