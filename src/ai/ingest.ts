import type { SourceDoc } from './documents'
import type { Learnable } from './tool-types'

export const ACCEPTED_FILES = '.md,.txt,.csv,.json,.html,.htm,.log'

function csvToText(raw: string): string {
  const [head, ...rows] = raw.split(/\r?\n/).filter((l) => l.trim())
  if (!head) return ''
  const cols = head.split(',').map((c) => c.trim())
  // One paragraph per row, so each row can be retrieved on its own.
  return rows
    .map((r) => {
      const cells = r.split(',')
      return cols.map((c, i) => `${c}: ${(cells[i] ?? '').trim()}`).join(', ')
    })
    .join('\n\n')
}

function htmlToText(raw: string): string {
  const doc = new DOMParser().parseFromString(raw, 'text/html')
  doc.querySelectorAll('script,style,noscript').forEach((n) => n.remove())
  return (doc.body.textContent ?? '').replace(/\n{3,}/g, '\n\n').replace(/[ \t]+/g, ' ').trim()
}

/** Turn an uploaded file into a plain-text document the index can chunk. */
export function parseUpload(name: string, raw: string): SourceDoc {
  const id = name.replace(/\.[^.]+$/, '')
  const ext = name.split('.').pop()?.toLowerCase()
  let text = raw
  let title = id

  if (ext === 'csv') {
    text = csvToText(raw)
  } else if (ext === 'json') {
    try {
      text = JSON.stringify(JSON.parse(raw), null, 2)
    } catch {
      text = raw
    }
  } else if (ext === 'html' || ext === 'htm') {
    text = htmlToText(raw)
  } else {
    const heading = /^#\s+(.+)$/m.exec(raw)
    if (heading) {
      title = heading[1].trim()
      text = raw.replace(/^#\s+.+\r?\n/, '')
    }
  }
  return { id, title, text: text.trim() }
}

/** Turn something the assistant looked up into a saved knowledge document. */
export function learnedDoc(l: Learnable): SourceDoc {
  const savedAt = new Date().toISOString().slice(0, 10)
  const slug = l.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return {
    id: `learned-${slug}`,
    title: l.title,
    text: `${l.text}\n\nSource: ${l.source} (saved ${savedAt})`,
    source: l.source,
    savedAt,
  }
}

/** Download a document as a .md file, e.g. to commit it into src/docs. */
export function downloadMarkdown(d: SourceDoc) {
  const blob = new Blob([`# ${d.title}\n\n${d.text}\n`], { type: 'text/markdown' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `${d.id}.md`
  a.click()
  URL.revokeObjectURL(a.href)
}

/** Download any text as a file. */
export function downloadText(filename: string, text: string, type = 'text/plain') {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([text], { type }))
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}
