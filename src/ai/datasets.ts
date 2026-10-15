import { readTable } from './csv'
import type { Table } from './csv'
import { datasetStore, employeeStore, employees, inventory, inventoryStore, sales, salesStore } from './data'
import type { Dataset } from './data'

export type CoreKind = 'employees' | 'inventory' | 'sales'

interface Field {
  key: string
  /** Accepted column names (compared ignoring case, spaces and punctuation). */
  aliases: string[]
  number?: boolean
  required?: boolean
}

const SCHEMAS: Record<CoreKind, { label: string; fields: Field[] }> = {
  employees: {
    label: 'Employees',
    fields: [
      { key: 'name', aliases: ['name', 'full name', 'employee', 'employee name'], required: true },
      { key: 'role', aliases: ['role', 'title', 'position', 'job title'] },
      { key: 'department', aliases: ['department', 'dept', 'team'] },
      { key: 'email', aliases: ['email', 'e-mail', 'email address'] },
      { key: 'leaveDays', aliases: ['leave days', 'leave', 'leave balance', 'vacation days'], number: true },
    ],
  },
  inventory: {
    label: 'Inventory',
    fields: [
      { key: 'sku', aliases: ['sku', 'item code', 'code', 'id'] },
      { key: 'name', aliases: ['name', 'item', 'product', 'description'], required: true },
      { key: 'qty', aliases: ['qty', 'quantity', 'stock', 'on hand'], number: true, required: true },
      { key: 'reorderLevel', aliases: ['reorder level', 'reorder', 'min stock', 'minimum'], number: true },
      { key: 'location', aliases: ['location', 'warehouse', 'bin'] },
    ],
  },
  sales: {
    label: 'Sales',
    fields: [
      { key: 'month', aliases: ['month', 'period', 'date'] },
      { key: 'region', aliases: ['region', 'area', 'territory'], required: true },
      { key: 'revenue', aliases: ['revenue', 'sales', 'amount', 'total'], number: true, required: true },
      { key: 'orders', aliases: ['orders', 'order count', 'count'], number: true },
    ],
  },
}

export const CORE_KINDS = Object.keys(SCHEMAS) as CoreKind[]
export const coreLabel = (k: CoreKind) => SCHEMAS[k].label
export const coreColumns = (k: CoreKind) => SCHEMAS[k].fields.map((f) => f.aliases[0])

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')

/** Map a table onto a core schema; throws a readable Error if required columns are missing or values are bad. */
function toRecords(kind: CoreKind, table: Table): Record<string, string | number>[] {
  const { fields } = SCHEMAS[kind]
  const col = new Map<string, number>()
  for (const f of fields) {
    const idx = table.headers.findIndex((h) => f.aliases.some((a) => norm(a) === norm(h)))
    if (idx >= 0) col.set(f.key, idx)
  }
  const missing = fields.filter((f) => f.required && !col.has(f.key)).map((f) => f.aliases[0])
  if (missing.length) {
    throw new Error(`Missing column(s): ${missing.join(', ')}. Found: ${table.headers.join(', ')}.`)
  }

  return table.rows.map((row, i) => {
    const rec: Record<string, string | number> = {}
    for (const f of fields) {
      const raw = col.has(f.key) ? row[col.get(f.key)!] : ''
      if (f.number) {
        const n = raw === '' ? 0 : Number(raw.replace(/[,₱$\s]/g, ''))
        if (!Number.isFinite(n)) throw new Error(`Row ${i + 2}: "${raw}" is not a number in column ${f.aliases[0]}.`)
        rec[f.key] = n
      } else {
        rec[f.key] = raw
      }
    }
    return rec
  })
}

/** Import a CSV/JSON file as one of the core datasets, replacing the current rows. Returns the row count. */
export function importCore(kind: CoreKind, filename: string, text: string): { count: number; saved: boolean } {
  return importCoreTable(kind, readTable(filename, text))
}

/**
 * Guess whether a table holds employees, inventory or sales records, by its column names.
 * Strict on purpose: the required columns plus at least one more known column must be present.
 */
export function detectCore(table: Table): CoreKind | null {
  const has = (aliases: string[]) => table.headers.some((h) => aliases.some((a) => norm(a) === norm(h)))
  for (const kind of CORE_KINDS) {
    const fields = SCHEMAS[kind].fields
    const required = fields.filter((f) => f.required)
    if (!required.every((f) => has(f.aliases))) continue
    const extra = fields.filter((f) => !f.required && has(f.aliases)).length
    if (extra >= (kind === 'employees' ? 2 : 1)) return kind
  }
  return null
}

/** Replace one of the core records (employees, inventory or sales) with the rows of a table. */
export function importCoreTable(kind: CoreKind, table: Table): { count: number; saved: boolean } {
  const recs = toRecords(kind, table)
  let saved: boolean
  // The cast is safe: toRecords produced exactly the fields each store expects.
  if (kind === 'employees') saved = employeeStore.set(recs as never)
  else if (kind === 'inventory') saved = inventoryStore.set(recs as never)
  else saved = salesStore.set(recs as never)
  return { count: recs.length, saved }
}

export function resetCore(kind: CoreKind) {
  if (kind === 'employees') employeeStore.set(employees)
  else if (kind === 'inventory') inventoryStore.set(inventory)
  else salesStore.set(sales)
}

/** Import any CSV/JSON file as a generic dataset named after the file. */
export function importDataset(filename: string, text: string): { dataset: Dataset; saved: boolean } {
  const name = filename.replace(/\.[^.]+$/, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'data'
  return addDataset(name, readTable(filename, text))
}

/** Store a table as a dataset (replacing one with the same name). */
export function addDataset(name: string, table: Table): { dataset: Dataset; saved: boolean } {
  const dataset: Dataset = { name, ...table }
  const saved = datasetStore.set([...datasetStore.get().filter((d) => d.name !== name), dataset])
  return { dataset, saved }
}

export function removeDataset(name: string) {
  datasetStore.set(datasetStore.get().filter((d) => d.name !== name))
}

/** A CSV template with the expected column names, for download. */
export function templateCsv(kind: CoreKind): string {
  return `${coreColumns(kind).join(',')}\n`
}
