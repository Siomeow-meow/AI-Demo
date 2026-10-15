import { useState } from 'react'
import { OFFLINE, SUGGESTED_MODELS, unloadModel } from '../ai/llm'
import { deleteModel, pullModel } from '../ai/ollama'
import type { InstalledModel } from '../ai/ollama'

interface Props {
  installed: InstalledModel[] | null | 'checking'
  modelId: string
  onChoose: (id: string) => void
  onRefresh: () => Promise<unknown>
}

export function ModelsView({ installed, modelId, onChoose, onRefresh }: Props) {
  const [name, setName] = useState('')
  const [pulling, setPulling] = useState<string | null>(null)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const list = Array.isArray(installed) ? installed : []

  async function download(raw: string) {
    const tag = raw.trim()
    if (!tag || pulling) return
    setMessage(null)
    setPulling(`${tag}: starting…`)
    try {
      await pullModel(tag, (status, pct) => setPulling(`${tag}: ${status}${pct === null ? '' : ` ${pct}%`}`))
      setMessage({ ok: true, text: `Downloaded ${tag}.` })
      setName('')
      await onRefresh()
    } catch (e) {
      setMessage({ ok: false, text: `Download failed: ${(e as Error).message}` })
    } finally {
      setPulling(null)
    }
  }

  async function remove(tag: string) {
    if (!window.confirm(`Delete ${tag} from this computer? You can download it again later.`)) return
    try {
      if (tag === modelId) {
        await unloadModel(tag)
        onChoose(OFFLINE)
      }
      await deleteModel(tag)
      setMessage({ ok: true, text: `Deleted ${tag}.` })
      await onRefresh()
    } catch (e) {
      setMessage({ ok: false, text: `Delete failed: ${(e as Error).message}` })
    }
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Models</h1>
          <p>
            Add or remove AI models any time. They run on your own computer through Ollama, and anything installed appears in the model
            picker at the top. Bigger models are smarter but need more memory.
          </p>
        </div>
      </div>

      {installed === null && <p className="banner bad">Ollama is not running, so models cannot be managed. Start it and refresh.</p>}
      {message && <p className={`banner ${message.ok ? 'ok' : 'bad'}`}>{message.text}</p>}

      <section className="group">
        <h2>Download a model</h2>
        <form
          className="inline-form"
          onSubmit={(e) => {
            e.preventDefault()
            download(name)
          }}
        >
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Any tag from the Ollama library, e.g. qwen2.5:7b" />
          <button type="submit" className="btn primary" disabled={!!pulling || installed === null}>
            Download
          </button>
        </form>
        {pulling && <p className="progress">{pulling}</p>}
      </section>

      <section className="group">
        <h2>
          Installed <span className="count">{list.length}</span>
        </h2>
        {list.length === 0 && <p className="empty">No models installed yet.</p>}
        <div className="card-grid">
          {list.map((m) => (
            <article key={m.name} className={`card${m.name === modelId ? ' current' : ''}`}>
              <header>
                <code>{m.name}</code>
                {m.name === modelId && <span className="tag ok">in use</span>}
              </header>
              <p className="small">
                {m.sizeGB.toFixed(1)} GB · {m.tools ? 'supports tools' : 'no tool support'}
                {m.thinking ? ' · thinking model' : ''}
              </p>
              <div className="card-actions">
                {m.name !== modelId && (
                  <button type="button" className="btn small primary" onClick={() => onChoose(m.name)}>
                    Use
                  </button>
                )}
                <button type="button" className="btn small danger" onClick={() => remove(m.name)}>
                  Delete
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="group">
        <h2>Ideas</h2>
        <div className="card-grid">
          {SUGGESTED_MODELS.filter((s) => !list.some((m) => m.name === s.id)).map((s) => (
            <article key={s.id} className="card">
              <header>
                <code>{s.id}</code>
              </header>
              <p className="small">{s.note}</p>
              <div className="card-actions">
                <button type="button" className="btn small" disabled={!!pulling || installed === null} onClick={() => download(s.id)}>
                  Download
                </button>
              </div>
            </article>
          ))}
        </div>
        <p className="muted">With 8 GB of RAM, stay with 3B-size models unless everything else is closed.</p>
      </section>
    </div>
  )
}
