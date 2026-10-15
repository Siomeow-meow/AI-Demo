import { useMemo, useState, useSyncExternalStore } from 'react'
import type { ChangeEvent } from 'react'
import type { SourceDoc } from '../ai/documents'
import { datasetStore } from '../ai/data'
import { removeDataset } from '../ai/datasets'
import { ATTACH_ACCEPT } from '../ai/files'
import { downloadMarkdown } from '../ai/ingest'

const AREAS: Record<string, string> = {
  erp: 'ERP lessons',
  pos: 'POS lessons',
  biz: 'Business lessons',
  fin: 'Finance lessons',
  it: 'IT lessons',
  net: 'Networking lessons',
  gen: 'General skills',
}
const ORDER = ['Yours', 'Company & AI notes', ...Object.values(AREAS)]

export interface SemanticState {
  on: boolean
  ready: boolean
  indexing: boolean
  error: string | null
  embedModel: string
  onToggle: (on: boolean) => void
}

interface Props {
  docs: SourceDoc[]
  uploadedIds: Set<string>
  chunkCount: (id: string) => number
  onUpload: (files: File[]) => void
  onRemove: (id: string) => void
  onAsk: (prompt: string) => void
  semantic: SemanticState
}

export function KnowledgeView({ docs, uploadedIds, chunkCount, onUpload, onRemove, onAsk, semantic }: Props) {
  const [query, setQuery] = useState('')
  const tables = useSyncExternalStore(datasetStore.subscribe, datasetStore.get)

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase()
    const byGroup = new Map<string, SourceDoc[]>()
    for (const d of docs) {
      if (q && !`${d.title} ${d.text}`.toLowerCase().includes(q)) continue
      const prefix = d.id.split('-')[0]
      const group = uploadedIds.has(d.id) ? 'Yours' : d.id.includes('-') && AREAS[prefix] ? AREAS[prefix] : 'Company & AI notes'
      byGroup.set(group, [...(byGroup.get(group) ?? []), d])
    }
    return ORDER.filter((g) => byGroup.has(g)).map((g) => [g, byGroup.get(g)!] as const)
  }, [docs, query, uploadedIds])

  function pick(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (files.length) onUpload(files)
  }

  const total = docs.reduce((a, d) => a + chunkCount(d.id), 0)

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Knowledge</h1>
          <p>
            {docs.length} documents ({total} searchable passages): company policies, notes and lessons on ERP, POS, business, finance, IT,
            networking and general skills, plus anything you attach in the chat. The assistant searches these to answer, and cites what it used.
          </p>
        </div>
        <label className="btn primary">
          + Upload files
          <input type="file" accept={ATTACH_ACCEPT} multiple hidden onChange={pick} />
        </label>
      </div>

      <div className="toolbar">
        <input className="search" type="search" placeholder="Search lessons and documents…" value={query} onChange={(e) => setQuery(e.target.value)} />
        <label className="switch" title="Finds passages by meaning, not only by matching words">
          <input type="checkbox" checked={semantic.on && semantic.ready} disabled={!semantic.ready} onChange={(e) => semantic.onToggle(e.target.checked)} />
          <span>
            Semantic search
            {!semantic.ready && (
              <>
                {' '}
                (run <code>ollama pull {semantic.embedModel}</code> to enable)
              </>
            )}
            {semantic.ready && semantic.on && semantic.indexing && ' - indexing…'}
            {semantic.error && ` - failed: ${semantic.error}`}
          </span>
        </label>
      </div>

      {tables.length > 0 && !query.trim() && (
        <section className="group">
          <h2>
            Your tables <span className="count">{tables.length}</span>
          </h2>
          <p className="muted">Tables you attached in the chat. The assistant can filter and total them, and their rows are searchable below.</p>
          <div className="card-grid">
            {tables.map((t) => (
              <article key={t.name} className="card">
                <header>
                  <strong>{t.name}</strong>
                  <span className="tag">{t.rows.length} rows</span>
                </header>
                <p className="small">{t.headers.join(', ')}</p>
                <div className="card-actions">
                  <button type="button" className="btn small" onClick={() => onAsk(`Describe the table ${t.name}`)}>
                    Ask the assistant
                  </button>
                  <button
                    type="button"
                    className="btn small danger"
                    onClick={() => {
                      removeDataset(t.name)
                      onRemove(`table-${t.name}`)
                    }}
                  >
                    Remove
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {groups.length === 0 && <p className="empty">Nothing matches "{query}".</p>}

      {groups.map(([name, list]) => (
        <section key={name} className="group">
          <h2>
            {name} <span className="count">{list.length}</span>
          </h2>
          <div className="doc-list">
            {list.map((d) => (
              <details key={d.id} className="doc">
                <summary>
                  <span className="doc-title">{d.title}</span>
                  <span className="doc-meta">
                    {d.source ? `learned ${d.savedAt} · ` : ''}
                    {chunkCount(d.id)} passage{chunkCount(d.id) === 1 ? '' : 's'}
                  </span>
                </summary>
                <div className="doc-body">
                  {d.text}
                  <div className="doc-actions">
                    <button type="button" className="btn small" onClick={() => onAsk(`Summarize the document "${d.title}"`)}>
                      Ask the assistant
                    </button>
                    {uploadedIds.has(d.id) && (
                      <>
                        <button type="button" className="btn small" onClick={() => downloadMarkdown(d)}>
                          Download .md
                        </button>
                        <button type="button" className="btn small danger" onClick={() => onRemove(d.id)}>
                          Remove
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </details>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
