import { datasetStore } from '../data'
import type { Dataset } from '../data'
import type { Tool } from '../tool-types'

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')

function findDataset(name: string | undefined): Dataset | string {
  const all = datasetStore.get()
  if (!all.length) return 'No datasets imported yet. Import a CSV or JSON file in the Data tab.'
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

/** Routing words for the dataset tools: table names, column headers and the cell values (capped for speed). */
function datasetWords(): string {
  return datasetStore
    .get()
    .map((d) => `${d.name.replace(/_/g, ' ')} ${d.headers.join(' ')} ${d.rows.slice(0, 2000).map((r) => r.join(' ')).join(' ')}`)
    .join(' ')
    .slice(0, 100000)
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
        : 'No datasets imported yet. Import a CSV or JSON file in the Data tab.'
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
      return `${matches.length} of ${d.rows.length} rows match${matches.length > n ? ` (showing ${n})` : ''}:\n${matches
        .slice(0, n)
        .map((r) => fmtRow(d, r))
        .join('\n')}`
    },
  },
  {
    name: 'aggregate_dataset',
    category: 'Your data',
    description: 'Calculate sum, average, min, max or count over a column of an imported data table, optionally grouped by another column.',
    keywords: 'total sum average mean minimum maximum count how many per by group dataset column statistics analyze csv spreadsheet',
    dynamicKeywords: datasetWords,
    parameters: {
      dataset: { type: 'string', description: 'Name of the dataset' },
      operation: { type: 'string', description: 'sum, avg, min, max or count' },
      column: { type: 'string', description: 'Column to calculate over (not needed for count)', optional: true },
      group_by: { type: 'string', description: 'Column to group results by', optional: true },
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
      const ci = column ? colIndex(d, column) : -1
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
      const label = `${op}${op === 'count' ? '' : ` of ${d.headers[ci]}`} in ${d.name} (${rows.length} rows)`
      if (gi < 0) return `${label}: ${show(calc(rows))}`

      const groups = new Map<string, string[][]>()
      for (const r of rows) groups.set(r[gi], [...(groups.get(r[gi]) ?? []), r])
      const lines = [...groups]
        .map(([k, v]) => [k, calc(v)] as const)
        .sort((a, b) => (Number.isFinite(b[1]) ? b[1] : -Infinity) - (Number.isFinite(a[1]) ? a[1] : -Infinity))
        .slice(0, 20)
        .map(([k, v]) => `${k}: ${show(v)}`)
      return `${label}, by ${d.headers[gi]}:\n${lines.join('\n')}`
    },
  },
]
