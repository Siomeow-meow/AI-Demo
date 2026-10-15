import { useEffect, useMemo, useState } from 'react'
import { createAgent } from './ai/agent'
import { sampleDocs } from './ai/documents'
import type { SourceDoc } from './ai/documents'
import { learnedDoc, parseUpload } from './ai/ingest'
import { createLlmAgent, DEFAULT_MODEL, OFFLINE, unloadModel } from './ai/llm'
import { buildSemantic, checkEmbedModel, EMBED_MODEL, listChatModels } from './ai/ollama'
import type { InstalledModel } from './ai/ollama'
import { buildIndex } from './ai/rag'
import type { Index, Semantic } from './ai/rag'
import type { ToolCall } from './ai/tools'
import { Chat } from './components/Chat'
import type { Turn } from './components/Chat'
import { DataView } from './components/DataView'
import { KnowledgeView } from './components/KnowledgeView'
import { ModelsView } from './components/ModelsView'
import { Toolkit } from './components/Toolkit'
import { WorkspaceView } from './components/WorkspaceView'
import { useLocalStorage } from './useLocalStorage'
import './App.css'

type View = 'chat' | 'toolkit' | 'knowledge' | 'data' | 'models' | 'workspace'

const VIEW_TITLES: Record<View, string> = {
  chat: 'Chat',
  toolkit: 'Toolkit',
  knowledge: 'Knowledge',
  data: 'Data',
  models: 'Models',
  workspace: 'Workspace',
}

function App() {
  const [view, setView] = useState<View>(() => {
    const hash = window.location.hash.slice(1)
    return hash in VIEW_TITLES ? (hash as View) : 'chat'
  })
  const [uploaded, setUploaded] = useLocalStorage<SourceDoc[]>('acme-assistant-uploads', [])
  const [turns, setTurns] = useLocalStorage<Turn[]>('acme-assistant-chat', [])
  const [internet, setInternet] = useLocalStorage<boolean>('acme-assistant-internet', false)
  const [semanticOn, setSemanticOn] = useLocalStorage<boolean>('acme-assistant-semantic', false)
  const [modelId, setModelId] = useLocalStorage<string>('acme-assistant-model', DEFAULT_MODEL)
  const [embedReady, setEmbedReady] = useState(false)
  const [built, setBuilt] = useState<{ index: Index; semantic: Semantic } | null>(null)
  const [semanticError, setSemanticError] = useState<string | null>(null)
  const [pending, setPending] = useState<{ question: string; text: string } | null>(null)
  const [installed, setInstalled] = useState<InstalledModel[] | null | 'checking'>('checking')

  const docs = useMemo(() => [...sampleDocs, ...uploaded], [uploaded])
  const index = useMemo(() => buildIndex(docs), [docs])
  const semantic = semanticOn && built?.index === index ? built.semantic : null
  const ctx = useMemo(() => ({ index, docs, semantic }), [index, docs, semantic])
  const offline = useMemo(() => createAgent(ctx), [ctx])
  const llm = useMemo(() => createLlmAgent(ctx), [ctx])
  const allTools = llm.tools

  // Keep the address bar in step with the page, so views can be bookmarked (e.g. #toolkit).
  useEffect(() => {
    window.history.replaceState(null, '', `#${view}`)
  }, [view])

  useEffect(() => {
    listChatModels().then(setInstalled)
    checkEmbedModel().then(setEmbedReady)

    // Models pulled or deleted in a terminal show up when you come back to this tab.
    const recheck = () => {
      if (document.visibilityState === 'visible') {
        listChatModels().then(setInstalled)
        checkEmbedModel().then(setEmbedReady)
      }
    }
    document.addEventListener('visibilitychange', recheck)
    window.addEventListener('focus', recheck)
    return () => {
      document.removeEventListener('visibilitychange', recheck)
      window.removeEventListener('focus', recheck)
    }
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

  const found = Array.isArray(installed) ? installed.find((m) => m.name === modelId) : undefined
  const model = found && { id: found.name, thinking: found.thinking, tools: found.tools }
  const usingLlm = model !== undefined
  const busy = pending !== null

  // Why the AI model is not being used (shown under the top bar), or null when it is.
  const llmStatus: string | null =
    installed === 'checking' || modelId === OFFLINE
      ? null
      : installed === null
        ? 'Ollama is not running at http://127.0.0.1:11434'
        : usingLlm
          ? null
          : `Model not found. Run: ollama pull ${modelId}`

  function chooseModel(next: string) {
    if (model && next !== model.id) unloadModel(model.id) // free its RAM straight away
    setModelId(next)
  }

  async function ask(question: string) {
    const q = question.trim()
    if (!q || busy) return
    setView('chat')
    setPending({ question: q, text: '' })
    try {
      const history = turns.flatMap((t) => [
        { role: 'user' as const, content: t.question },
        { role: 'assistant' as const, content: t.reply.text },
      ])
      const reply = usingLlm
        ? await llm.respond(history, q, (text) => setPending({ question: q, text }), internet, model)
        : await offline.respond(q)
      setTurns((t) => [...t, { question: q, reply }])
    } catch (e) {
      const text = `Error: ${(e as Error).message}`
      setTurns((t) => [...t, { question: q, reply: { text, calls: [], sources: [] } }])
    } finally {
      setPending(null)
    }
  }

  async function onUpload(files: File[]) {
    const added = await Promise.all(files.map(async (f) => parseUpload(f.name, await f.text())))
    setUploaded((u) => [...u.filter((d) => !added.some((a) => a.id === d.id)), ...added])
  }

  function learnables(calls: ToolCall[]) {
    return calls.flatMap((c) => {
      const learn = allTools.find((t) => t.name === c.tool)?.learn?.(c.args, c.result)
      return learn ? [learnedDoc(learn)] : []
    })
  }

  const savedIds = useMemo(() => new Set(uploaded.map((d) => d.id)), [uploaded])
  const chunkCount = (id: string) => index.chunks.filter((c) => c.docId === id).length

  const nav: { id: View; label: string; icon: string; count?: number }[] = [
    { id: 'chat', label: 'Chat', icon: '💬' },
    { id: 'toolkit', label: 'Toolkit', icon: '🧰', count: allTools.length },
    { id: 'knowledge', label: 'Knowledge', icon: '📚', count: docs.length },
    { id: 'data', label: 'Data', icon: '🗂️' },
    { id: 'models', label: 'Models', icon: '🧠' },
    { id: 'workspace', label: 'Workspace', icon: '✅' },
  ]

  const dot = usingLlm ? 'ok' : installed === 'checking' || modelId === OFFLINE ? 'idle' : 'warn'

  return (
    <div className="shell">
      <aside className="rail">
        <div className="brand">
          <span className="logo">✦</span>
          <span className="brand-name">Acme Assistant</span>
        </div>
        <button
          type="button"
          className="new-chat"
          disabled={busy}
          onClick={() => {
            setTurns([])
            setView('chat')
          }}
        >
          <span>＋</span> New chat
        </button>
        <nav>
          {nav.map((n) => (
            <button key={n.id} type="button" className={view === n.id ? 'active' : ''} onClick={() => setView(n.id)}>
              <span className="icon">{n.icon}</span>
              <span className="label">{n.label}</span>
              {n.count !== undefined && <span className="badge-count">{n.count}</span>}
            </button>
          ))}
        </nav>
        <div className="rail-foot">
          <span className={`dot ${dot}`} />
          <span>{usingLlm ? model.id : modelId === OFFLINE ? 'Basic mode' : installed === 'checking' ? 'Checking…' : 'No model'}</span>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <h2>{VIEW_TITLES[view]}</h2>
          <label className="model-pick" title="Choose which AI model answers">
            <span className={`dot ${dot}`} />
            <select value={modelId} disabled={busy} onChange={(e) => chooseModel(e.target.value)}>
              {Array.isArray(installed) &&
                installed.map((m) => (
                  <option key={m.name} value={m.name}>
                    {m.name} ({m.sizeGB.toFixed(1)} GB{m.tools ? '' : ', no tools'})
                  </option>
                ))}
              {modelId !== OFFLINE && !found && <option value={modelId}>{modelId} (not installed)</option>}
              <option value={OFFLINE}>Basic (no AI model)</option>
            </select>
          </label>
        </header>
        {llmStatus && <p className="banner warn">{llmStatus} - using the basic rule-based agent.</p>}

        {view === 'chat' && (
          <Chat
            turns={turns}
            pending={pending}
            tools={allTools}
            internet={internet}
            onInternet={setInternet}
            onSend={ask}
            learnables={learnables}
            savedIds={savedIds}
            onSave={(doc) => setUploaded((u) => [...u.filter((d) => d.id !== doc.id), doc])}
            modelLabel={usingLlm ? model.id : 'Basic mode'}
          />
        )}
        {view === 'toolkit' && <Toolkit tools={allTools} internet={internet} onInternet={setInternet} onTry={ask} />}
        {view === 'knowledge' && (
          <KnowledgeView
            docs={docs}
            uploadedIds={savedIds}
            chunkCount={chunkCount}
            onUpload={onUpload}
            onRemove={(id) => setUploaded((u) => u.filter((d) => d.id !== id))}
            onAsk={ask}
            semantic={{
              on: semanticOn,
              ready: embedReady,
              indexing: semanticOn && embedReady && !semantic && !semanticError,
              error: semanticError,
              embedModel: EMBED_MODEL,
              onToggle: setSemanticOn,
            }}
          />
        )}
        {view === 'data' && <DataView />}
        {view === 'models' && (
          <ModelsView installed={installed} modelId={modelId} onChoose={chooseModel} onRefresh={() => listChatModels().then(setInstalled)} />
        )}
        {view === 'workspace' && <WorkspaceView />}
      </main>
    </div>
  )
}

export default App
