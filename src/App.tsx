import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import type { ChangeEvent } from 'react'
import { createAgent } from './ai/agent'
import type { AgentReply } from './ai/agent'
import {
  datasetStore,
  employeeStore,
  inventoryStore,
  noteStore,
  salesStore,
  taskStore,
  ticketStore,
} from './ai/data'
import { CORE_KINDS, coreColumns, coreLabel, importCore, importDataset, removeDataset, resetCore, templateCsv } from './ai/datasets'
import type { CoreKind } from './ai/datasets'
import { sampleDocs } from './ai/documents'
import type { SourceDoc } from './ai/documents'
import { ACCEPTED_FILES, downloadMarkdown, downloadText, learnedDoc, parseUpload } from './ai/ingest'
import type { ToolCall } from './ai/tools'
import { checkModel, createLlmAgent, MODEL } from './ai/llm'
import { buildSemantic, checkEmbedModel, EMBED_MODEL } from './ai/ollama'
import { buildIndex } from './ai/rag'
import type { Index, Semantic } from './ai/rag'
import { useLocalStorage } from './useLocalStorage'
import './App.css'

interface Turn {
  question: string
  reply: AgentReply
}

type Tab = 'knowledge' | 'tools' | 'data' | 'workspace'

const SUGGESTIONS: Record<string, string[]> = {
  Policies: ['How many vacation days do I get?', 'What is the meal allowance when travelling?', 'How do I reset my password?'],
  'Company data': ['Who is Maria Santos?', 'Which items are low on stock?', 'Show sales for the North region'],
  Actions: ['Create a high priority ticket: laptop screen is cracked', 'Add a task: send report, due 2026-10-20', 'Save a note: call the supplier on Monday'],
  Utilities: ['What is 15% of 48000?', 'Convert 5 miles to km', 'How many days until 2026-12-25?', 'Generate a 20 character password'],
  Internet: ['What is the weather in Manila?', 'Convert 100 USD to PHP', 'Wikipedia: enterprise resource planning'],
}

function App() {
  const [uploaded, setUploaded] = useLocalStorage<SourceDoc[]>('acme-assistant-uploads', [])
  const [turns, setTurns] = useLocalStorage<Turn[]>('acme-assistant-chat', [])
  const [internet, setInternet] = useLocalStorage<boolean>('acme-assistant-internet', false)
  const [semanticOn, setSemanticOn] = useLocalStorage<boolean>('acme-assistant-semantic', false)
  const [embedReady, setEmbedReady] = useState(false)
  const [built, setBuilt] = useState<{ index: Index; semantic: Semantic } | null>(null)
  const [semanticError, setSemanticError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('knowledge')
  const [input, setInput] = useState('')
  const [pending, setPending] = useState<{ question: string; text: string } | null>(null)
  const [llmStatus, setLlmStatus] = useState<string | null>('checking')
  const [useLlm, setUseLlm] = useState(true)
  const endRef = useRef<HTMLDivElement>(null)

  const tickets = useSyncExternalStore(ticketStore.subscribe, ticketStore.get)
  const notes = useSyncExternalStore(noteStore.subscribe, noteStore.get)
  const tasks = useSyncExternalStore(taskStore.subscribe, taskStore.get)
  const employees = useSyncExternalStore(employeeStore.subscribe, employeeStore.get)
  const inventory = useSyncExternalStore(inventoryStore.subscribe, inventoryStore.get)
  const sales = useSyncExternalStore(salesStore.subscribe, salesStore.get)
  const datasets = useSyncExternalStore(datasetStore.subscribe, datasetStore.get)
  const [dataMsg, setDataMsg] = useState<string | null>(null)
  const coreRows: Record<CoreKind, number> = { employees: employees.length, inventory: inventory.length, sales: sales.length }

  const docs = useMemo(() => [...sampleDocs, ...uploaded], [uploaded])
  const index = useMemo(() => buildIndex(docs), [docs])
  const semantic = semanticOn && built?.index === index ? built.semantic : null
  const ctx = useMemo(() => ({ index, docs, semantic }), [index, docs, semantic])
  const offline = useMemo(() => createAgent(ctx), [ctx])
  const llm = useMemo(() => createLlmAgent(ctx), [ctx])
  const allTools = llm.tools

  useEffect(() => {
    checkModel().then(setLlmStatus)
    checkEmbedModel().then(setEmbedReady)
  }, [])

  // Build the embedding index (only when switched on) for the current set of documents.
  useEffect(() => {
    if (!semanticOn || !embedReady) return
    let stale = false
    buildSemantic(index.chunks)
      .then((s) => {
        if (stale) return
        setBuilt({ index, semantic: s })
        setSemanticError(null)
      })
      .catch((e: Error) => {
        if (!stale) setSemanticError(e.message)
      })
    return () => {
      stale = true
    }
  }, [semanticOn, embedReady, index])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [turns, pending])

  const usingLlm = useLlm && llmStatus === null
  const busy = pending !== null

  async function ask(question: string) {
    const q = question.trim()
    if (!q || busy) return
    setInput('')
    setPending({ question: q, text: '' })
    try {
      const history = turns.flatMap((t) => [
        { role: 'user' as const, content: t.question },
        { role: 'assistant' as const, content: t.reply.text },
      ])
      const reply = usingLlm
        ? await llm.respond(history, q, (text) => setPending({ question: q, text }), internet)
        : await offline.respond(q)
      setTurns((t) => [...t, { question: q, reply }])
    } catch (e) {
      const text = `Error: ${(e as Error).message}`
      setTurns((t) => [...t, { question: q, reply: { text, calls: [], sources: [] } }])
    } finally {
      setPending(null)
    }
  }

  async function onUpload(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    const added = await Promise.all(files.map(async (f) => parseUpload(f.name, await f.text())))
    setUploaded((u) => [...u.filter((d) => !added.some((a) => a.id === d.id)), ...added])
  }

  function learnables(calls: ToolCall[]) {
    return calls.flatMap((c) => {
      const found = allTools.find((t) => t.name === c.tool)?.learn?.(c.args, c.result)
      return found ? [learnedDoc(found)] : []
    })
  }

  function saveDoc(doc: SourceDoc) {
    setUploaded((u) => [...u.filter((d) => d.id !== doc.id), doc])
    setTab('knowledge')
  }

  async function onImport(e: ChangeEvent<HTMLInputElement>, kind: CoreKind | null) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const note = (saved: boolean) => (saved ? '' : ' (too large to save in this browser; kept for this session only)')
    try {
      const text = await file.text()
      if (kind) {
        const r = importCore(kind, file.name, text)
        setDataMsg(`Imported ${r.count} ${coreLabel(kind).toLowerCase()} rows${note(r.saved)}.`)
      } else {
        const r = importDataset(file.name, text)
        setDataMsg(`Imported dataset "${r.dataset.name}" (${r.dataset.rows.length} rows)${note(r.saved)}.`)
      }
    } catch (err) {
      setDataMsg(`Import failed: ${(err as Error).message}`)
    }
  }

  const savedIds = useMemo(() => new Set(uploaded.map((d) => d.id)), [uploaded])
  const chunkCount = (id: string) => index.chunks.filter((c) => c.docId === id).length

  const toolGroups = useMemo(() => {
    const groups = new Map<string, typeof allTools>()
    for (const t of allTools) groups.set(t.category, [...(groups.get(t.category) ?? []), t])
    return [...groups]
  }, [allTools])

  return (
    <div className="app">
      <header>
        <div>
          <h1>Acme Assistant</h1>
          <p>Corporate AI with tools and RAG, running locally.</p>
        </div>
        <div className="header-right">
          {llmStatus === 'checking' ? (
            <span className="badge">Checking model…</span>
          ) : llmStatus === null ? (
            <label className="badge ok">
              <input type="checkbox" checked={useLlm} onChange={(e) => setUseLlm(e.target.checked)} />
              {MODEL}
            </label>
          ) : (
            <span className="badge warn" title={llmStatus}>
              Offline mode
            </span>
          )}
          <button type="button" onClick={() => setTurns([])} disabled={busy || !turns.length}>
            Clear chat
          </button>
        </div>
      </header>
      {llmStatus && llmStatus !== 'checking' && <p className="notice">{llmStatus} - using the basic rule-based agent.</p>}

      <div className="layout">
        <aside>
          <nav>
            {(['knowledge', 'tools', 'data', 'workspace'] as Tab[]).map((t) => (
              <button key={t} type="button" className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>
                {t === 'knowledge' ? 'Docs' : t === 'tools' ? `Tools (${llm.tools.length})` : t === 'data' ? 'Data' : 'Mine'}
              </button>
            ))}
          </nav>

          {tab === 'knowledge' && (
            <>
              <p className="hint">
                {docs.length} documents, {index.chunks.length} chunks. Upload .md, .txt, .csv, .json or .html files to extend
                the AI&apos;s knowledge.
              </p>
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={semanticOn && embedReady}
                  disabled={!embedReady}
                  onChange={(e) => setSemanticOn(e.target.checked)}
                />
                <span>
                  Semantic search (finds meaning, not just keywords)
                  {!embedReady && (
                    <>
                      {' '}
                      - run <code>ollama pull {EMBED_MODEL}</code> (~270 MB) to enable
                    </>
                  )}
                  {embedReady && semanticOn && !semantic && !semanticError && ' - indexing…'}
                  {semanticError && ` - failed: ${semanticError}`}
                </span>
              </label>
              <label className="upload">
                + Upload documents
                <input type="file" accept={ACCEPTED_FILES} multiple hidden onChange={onUpload} />
              </label>
              <ul>
                {docs.map((d) => (
                  <li key={d.id}>
                    <strong>{d.title}</strong>
                    <span>
                      {d.source ? `learned ${d.savedAt} · ` : ''}
                      {d.id} · {chunkCount(d.id)} chunk(s)
                    </span>
                    {uploaded.some((u) => u.id === d.id) && (
                      <span className="actions">
                        <button type="button" className="link" onClick={() => downloadMarkdown(d)}>
                          download .md
                        </button>
                        <button type="button" className="link" onClick={() => setUploaded((u) => u.filter((x) => x.id !== d.id))}>
                          remove
                        </button>
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}

          {tab === 'tools' && (
            <>
              <p className="hint">
                For each question, a router offers the model only the few most relevant tools, which keeps memory use low.
              </p>
              <label className="toggle">
                <input type="checkbox" checked={internet} onChange={(e) => setInternet(e.target.checked)} />
                Allow internet tools (sends your question text to Wikipedia, Open-Meteo and Frankfurter)
              </label>
              {toolGroups.map(([category, list]) => (
                <div key={category}>
                  <h3>{category}</h3>
                  <ul>
                    {list.map((t) => (
                      <li key={t.name} className={t.network && !internet ? 'off' : ''}>
                        <strong>{t.name}</strong>
                        <span>{t.description}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </>
          )}

          {tab === 'data' && (
            <>
              <p className="hint">
                The assistant answers company questions from this data. It starts with made-up samples; import your own CSV or
                JSON files to replace them. Data stays in this browser.
              </p>
              {dataMsg && <p className="notice">{dataMsg}</p>}
              {CORE_KINDS.map((kind) => (
                <div key={kind} className="dataset">
                  <strong>
                    {coreLabel(kind)} ({coreRows[kind]} rows)
                  </strong>
                  <span>Columns: {coreColumns(kind).join(', ')}</span>
                  <span className="actions">
                    <label className="link">
                      import file
                      <input type="file" accept=".csv,.json" hidden onChange={(e) => onImport(e, kind)} />
                    </label>
                    <button type="button" className="link" onClick={() => downloadText(`${kind}-template.csv`, templateCsv(kind), 'text/csv')}>
                      template
                    </button>
                    <button type="button" className="link" onClick={() => resetCore(kind)}>
                      reset to sample
                    </button>
                  </span>
                </div>
              ))}
              <h3>Other tables</h3>
              <p className="hint">Import any CSV or JSON file. The assistant can then search and total it.</p>
              <label className="upload">
                + Import a table
                <input type="file" accept=".csv,.json" hidden onChange={(e) => onImport(e, null)} />
              </label>
              <ul>
                {datasets.length === 0 && <li>None yet.</li>}
                {datasets.map((d) => (
                  <li key={d.name}>
                    <strong>{d.name}</strong>
                    <span>
                      {d.rows.length} rows · {d.headers.join(', ')}
                    </span>
                    <button type="button" className="link" onClick={() => removeDataset(d.name)}>
                      remove
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}

          {tab === 'workspace' && (
            <>
              <p className="hint">Things the assistant created for you. Saved in this browser only.</p>
              <h3>Tickets ({tickets.length})</h3>
              <ul>
                {tickets.length === 0 && <li>None yet.</li>}
                {tickets.map((t) => (
                  <li key={t.id}>
                    <strong>
                      {t.id} <span className={`prio ${t.priority}`}>{t.priority}</span>
                    </strong>
                    <span>{t.title}</span>
                  </li>
                ))}
              </ul>
              <h3>Tasks ({tasks.length})</h3>
              <ul>
                {tasks.length === 0 && <li>None yet.</li>}
                {tasks.map((t) => (
                  <li key={t.id} className={t.done ? 'off' : ''}>
                    <strong>
                      {t.done ? '✓' : '○'} {t.title}
                    </strong>
                    {t.due && <span>due {t.due}</span>}
                  </li>
                ))}
              </ul>
              <h3>Notes ({notes.length})</h3>
              <ul>
                {notes.length === 0 && <li>None yet.</li>}
                {notes.map((n) => (
                  <li key={n.id}>
                    <span>{n.text}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </aside>

        <main className="chat">
          <div className="log">
            {turns.length === 0 && !pending && (
              <div className="welcome">
                <h2>How can I help?</h2>
                {Object.entries(SUGGESTIONS)
                  .filter(([group]) => group !== 'Internet' || internet)
                  .map(([group, qs]) => (
                    <div key={group}>
                      <h3>{group}</h3>
                      <div className="chips">
                        {qs.map((q) => (
                          <button key={q} type="button" onClick={() => ask(q)}>
                            {q}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
              </div>
            )}

            {turns.map((t, i) => (
              <Message key={i} question={t.question} reply={t.reply} learnable={learnables(t.reply.calls)} savedIds={savedIds} onSave={saveDoc} />
            ))}
            {pending && (
              <Message
                question={pending.question}
                reply={{ text: pending.text || 'Thinking…', calls: [], sources: [] }}
                learnable={[]}
                savedIds={savedIds}
                onSave={saveDoc}
              />
            )}
            <div ref={endRef} />
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault()
              ask(input)
            }}
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about policies, data, utilities, or tell me to create tickets, tasks and notes…"
            />
            <button type="submit" disabled={busy}>
              {busy ? 'Working…' : 'Send'}
            </button>
          </form>
        </main>
      </div>
    </div>
  )
}

interface MessageProps extends Turn {
  learnable: SourceDoc[]
  savedIds: Set<string>
  onSave: (doc: SourceDoc) => void
}

function Message({ question, reply, learnable, savedIds, onSave }: MessageProps) {
  return (
    <div className="turn">
      <p className="q">{question}</p>
      <div className="a">
        {reply.calls.map((c, j) => (
          <details key={j} className="call">
            <summary>
              Used tool <code>{c.tool}</code>
            </summary>
            <pre>
              {JSON.stringify(c.args)}
              {'\n→ '}
              {c.result}
            </pre>
          </details>
        ))}
        <p>{reply.text}</p>
        {reply.sources.length > 0 && (
          <div className="sources">
            {reply.sources.map((s) => (
              <span key={s.id} title={`score ${s.score.toFixed(2)}`}>
                {s.id} · {s.title}
              </span>
            ))}
          </div>
        )}
        {learnable.map((d) => (
          <button key={d.id} type="button" className="save" disabled={savedIds.has(d.id)} onClick={() => onSave(d)}>
            {savedIds.has(d.id) ? `Saved: ${d.title}` : `Save "${d.title}" to knowledge`}
          </button>
        ))}
        {reply.offered && <small className="offered">Tools offered: {reply.offered.join(', ')}</small>}
      </div>
    </div>
  )
}

export default App
