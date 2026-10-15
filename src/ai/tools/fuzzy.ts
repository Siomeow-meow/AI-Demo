import { employeeStore, datasetStore, inventoryStore } from '../data'
import { tokenize } from '../rag'

/** Rank records by how many query words appear in their searchable text. */
export function fuzzyFind<T>(items: T[], query: string, text: (item: T) => string, limit = 3): T[] {
  const words = tokenize(query).filter((w) => w.length > 2)
  return items
    .map((item) => {
      const hay = text(item).toLowerCase()
      return { item, score: words.filter((w) => hay.includes(w)).length }
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.item)
}

/** Look for a query in every data source (employees, inventory, imported tables) and describe what was found. */
export function searchAllData(query: string): string[] {
  const people = fuzzyFind(employeeStore.get(), query, (e) => `${e.name} ${e.role} ${e.department}`).map(
    (e) => `employees: ${e.name} - ${e.role}, ${e.department}. Email: ${e.email}. Leave days left: ${e.leaveDays}.`,
  )
  const stock = fuzzyFind(inventoryStore.get(), query, (i) => `${i.name} ${i.sku}`).map(
    (i) => `inventory: ${i.sku} ${i.name}: ${i.qty} in stock${i.location ? ` at ${i.location}` : ''}.`,
  )
  const tables = datasetStore
    .get()
    .flatMap((d) =>
      fuzzyFind(d.rows, query, (r) => r.join(' ')).map((r) => `${d.name}: ${d.headers.map((h, i) => `${h}: ${r[i]}`).join(', ')}`),
    )
  return [...people, ...stock, ...tables]
}
