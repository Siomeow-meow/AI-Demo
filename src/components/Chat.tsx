import { useEffect, useMemo, useRef, useState } from 'react'
import type { AgentReply } from '../ai/agent'
import type { SourceDoc } from '../ai/documents'
import { TOOL_EXAMPLES } from '../ai/tool-examples'
import type { Tool, ToolCall } from '../ai/tools'

export interface Turn {
  question: string
  reply: AgentReply
}

/** Prompts about the written lessons and company documents (the tools supply the rest). */
const LESSON_PROMPTS = [
  'How many vacation days do I get?',
  'Explain the OSI model',
  'What is a three-way match in ERP?',
  'How does the 3-2-1 backup rule work?',
  'How do I read a balance sheet?',
  'How should I write a good work email?',
]

const CATEGORY_ORDER = [
  'Company data',
  'ERP',
  'POS',
  'Business',
  'Finance',
  'IT',
  'Networking',
  'Math & utility',
  'Text & data',
  'Your data',
  'Personal workspace',
  'Internet',
]

interface Props {
  turns: Turn[]
  pending: { question: string; text: string } | null
  tools: Tool[]
  internet: boolean
  onInternet: (on: boolean) => void
  onSend: (question: string) => void
  learnables: (calls: ToolCall[]) => SourceDoc[]
  savedIds: Set<string>
  onSave: (doc: SourceDoc) => void
  modelLabel: string
}

export function Chat({ turns, pending, tools, internet, onInternet, onSend, learnables, savedIds, onSave, modelLabel }: Props) {
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [turns, pending])

  const empty = turns.length === 0 && !pending

  return (
    <div className="chat-view">
      <div className="chat-scroll">
        <div className="chat-col">
          {empty && <Welcome tools={tools} internet={internet} onSend={onSend} />}
          {turns.map((t, i) => (
            <Message key={i} turn={t} learnable={learnables(t.reply.calls)} savedIds={savedIds} onSave={onSave} />
          ))}
          {pending && (
            <Message
              turn={{ question: pending.question, reply: { text: pending.text, calls: [], sources: [] } }}
              learnable={[]}
              savedIds={savedIds}
              onSave={onSave}
              streaming
            />
          )}
          <div ref={endRef} />
        </div>
      </div>
      <Composer busy={pending !== null} internet={internet} onInternet={onInternet} onSend={onSend} modelLabel={modelLabel} />
    </div>
  )
}

function Welcome({ tools, internet, onSend }: { tools: Tool[]; internet: boolean; onSend: (q: string) => void }) {
  const groups = useMemo(() => {
    const byCat = new Map<string, string[]>()
    for (const t of tools) {
      const example = TOOL_EXAMPLES[t.name]
      if (!example || example.includes('\n')) continue
      byCat.set(t.category, [...(byCat.get(t.category) ?? []), example])
    }
    const ordered = CATEGORY_ORDER.filter((c) => byCat.has(c)).map((c) => [c, byCat.get(c)!.slice(0, 6)] as const)
    return [['Lessons & policies', LESSON_PROMPTS] as const, ...ordered]
  }, [tools])

  const [active, setActive] = useState('Lessons & policies')
  const visible = groups.filter(([name]) => name !== 'Internet' || internet)
  const current = visible.find(([name]) => name === active) ?? visible[0]

  return (
    <div className="welcome">
      <div className="hero-mark">✦</div>
      <h1>How can I help today?</h1>
      <p>Ask a question, run a calculation, look up company data, or learn something new.</p>
      <div className="tabs">
        {visible.map(([name]) => (
          <button key={name} type="button" className={name === current[0] ? 'on' : ''} onClick={() => setActive(name)}>
            {name}
          </button>
        ))}
      </div>
      <div className="prompt-grid">
        {current[1].map((p) => (
          <button key={p} type="button" className="prompt-card" onClick={() => onSend(p)}>
            {p}
          </button>
        ))}
      </div>
    </div>
  )
}

function Message({
  turn,
  learnable,
  savedIds,
  onSave,
  streaming = false,
}: {
  turn: Turn
  learnable: SourceDoc[]
  savedIds: Set<string>
  onSave: (doc: SourceDoc) => void
  streaming?: boolean
}) {
  const { question, reply } = turn
  const [copied, setCopied] = useState(false)

  function copy() {
    navigator.clipboard?.writeText(reply.text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  return (
    <div className="turn">
      <div className="user-msg">{question}</div>
      <div className="assistant-msg">
        <div className="avatar">✦</div>
        <div className="assistant-body">
          {reply.calls.map((c, j) => (
            <details key={j} className="step">
              <summary>
                <span className="step-icon">⚙</span> Used <code>{c.tool}</code>
              </summary>
              <pre>
                {JSON.stringify(c.args)}
                {'\n→ '}
                {c.result}
              </pre>
            </details>
          ))}
          {reply.text ? (
            <div className={`answer${streaming ? ' streaming' : ''}`}>{reply.text}</div>
          ) : (
            <div className="thinking">
              <span />
              <span />
              <span />
            </div>
          )}
          {reply.sources.length > 0 && (
            <div className="sources">
              {reply.sources.map((s) => (
                <span key={s.id} title={`relevance ${s.score.toFixed(2)}`}>
                  {s.title}
                </span>
              ))}
            </div>
          )}
          {learnable.map((d) => (
            <button key={d.id} type="button" className="save" disabled={savedIds.has(d.id)} onClick={() => onSave(d)}>
              {savedIds.has(d.id) ? `✓ Saved "${d.title}"` : `Save "${d.title}" to knowledge`}
            </button>
          ))}
          {!streaming && (
            <div className="meta">
              {reply.model && <span>{reply.model}</span>}
              {reply.offered && reply.offered.length > 0 && <span>tools offered: {reply.offered.join(', ')}</span>}
              <button type="button" className="ghost" onClick={copy}>
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Composer({
  busy,
  internet,
  onInternet,
  onSend,
  modelLabel,
}: {
  busy: boolean
  internet: boolean
  onInternet: (on: boolean) => void
  onSend: (q: string) => void
  modelLabel: string
}) {
  const [text, setText] = useState('')
  const ref = useRef<HTMLTextAreaElement>(null)

  function resize() {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`
  }

  function submit() {
    const q = text.trim()
    if (!q || busy) return
    onSend(q)
    setText('')
    requestAnimationFrame(resize)
  }

  return (
    <div className="composer-wrap">
      <form
        className="composer"
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <textarea
          ref={ref}
          rows={1}
          value={text}
          placeholder="Message Acme Assistant…"
          onChange={(e) => {
            setText(e.target.value)
            resize()
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault()
              submit()
            }
          }}
        />
        <div className="composer-row">
          <button type="button" className={`chip${internet ? ' on' : ''}`} onClick={() => onInternet(!internet)} title="Lets tools like weather, Wikipedia and exchange rates send your question text to public services">
            🌐 Internet tools {internet ? 'on' : 'off'}
          </button>
          <span className="spacer" />
          <span className="model-note">{modelLabel}</span>
          <button type="submit" className="send" disabled={busy || !text.trim()} aria-label="Send message">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 19V5M5 12l7-7 7 7" />
            </svg>
          </button>
        </div>
      </form>
      <p className="fineprint">AI can make mistakes. Check important facts, numbers and policies.</p>
    </div>
  )
}
