/** Minimal CSV parser: quoted fields, escaped quotes, CRLF, and comma/semicolon/tab delimiters. */
export function parseCsv(text: string): string[][] {
  const clean = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text // drop a byte-order mark
  const firstLine = clean.split(/\r?\n/, 1)[0] ?? ''
  const delimiter = [',', ';', '\t'].reduce((best, d) =>
    firstLine.split(d).length > firstLine.split(best).length ? d : best,
  )

  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false

  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i]
    if (quoted) {
      if (ch === '"' && clean[i + 1] === '"') {
        cell += '"'
        i++
      } else if (ch === '"') {
        quoted = false
      } else {
        cell += ch
      }
    } else if (ch === '"') {
      quoted = true
    } else if (ch === delimiter) {
      row.push(cell)
      cell = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && clean[i + 1] === '\n') i++
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else {
      cell += ch
    }
  }
  if (cell !== '' || row.length) {
    row.push(cell)
    rows.push(row)
  }
  return rows.filter((r) => r.some((c) => c.trim() !== '')).map((r) => r.map((c) => c.trim()))
}

export interface Table {
  headers: string[]
  rows: string[][]
}

/** Read CSV or a JSON array of objects into a table. Throws a readable Error on bad input. */
export function readTable(filename: string, text: string): Table {
  if (/\.json$/i.test(filename)) {
    let data: unknown
    try {
      data = JSON.parse(text)
    } catch {
      throw new Error('That file is not valid JSON.')
    }
    if (!Array.isArray(data) || !data.length || typeof data[0] !== 'object' || data[0] === null) {
      throw new Error('JSON must be a non-empty array of objects, e.g. [{"name": "Ana"}].')
    }
    const headers = [...new Set(data.flatMap((o) => Object.keys(o as object)))]
    const rows = data.map((o) => headers.map((h) => String((o as Record<string, unknown>)[h] ?? '')))
    return { headers, rows }
  }
  const [headers, ...rows] = parseCsv(text)
  if (!headers || !rows.length) throw new Error('The file needs a header row and at least one data row.')
  return { headers, rows: rows.map((r) => headers.map((_, i) => r[i] ?? '')) }
}
