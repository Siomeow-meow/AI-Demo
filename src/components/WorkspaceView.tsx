import { useSyncExternalStore } from 'react'
import { noteStore, taskStore, ticketStore } from '../ai/data'

export function WorkspaceView() {
  const tickets = useSyncExternalStore(ticketStore.subscribe, ticketStore.get)
  const tasks = useSyncExternalStore(taskStore.subscribe, taskStore.get)
  const notes = useSyncExternalStore(noteStore.subscribe, noteStore.get)

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Workspace</h1>
          <p>Tickets, tasks and notes the assistant created for you. Ask it to "create a ticket", "add a task" or "save a note". Saved in this browser only.</p>
        </div>
      </div>

      <div className="columns">
        <section className="group">
          <h2>
            Tickets <span className="count">{tickets.length}</span>
          </h2>
          {tickets.length === 0 && <p className="empty">None yet.</p>}
          {tickets.map((t) => (
            <article key={t.id} className="card">
              <header>
                <strong>{t.id}</strong>
                <span className={`tag prio-${t.priority}`}>{t.priority}</span>
              </header>
              <p>{t.title}</p>
              <small>{t.createdAt}</small>
            </article>
          ))}
        </section>

        <section className="group">
          <h2>
            Tasks <span className="count">{tasks.length}</span>
          </h2>
          {tasks.length === 0 && <p className="empty">None yet.</p>}
          {tasks.map((t) => (
            <article key={t.id} className={`card${t.done ? ' dim' : ''}`}>
              <header>
                <strong>
                  {t.done ? '✓' : '○'} {t.title}
                </strong>
              </header>
              {t.due && <small>due {t.due}</small>}
            </article>
          ))}
        </section>

        <section className="group">
          <h2>
            Notes <span className="count">{notes.length}</span>
          </h2>
          {notes.length === 0 && <p className="empty">None yet.</p>}
          {notes.map((n) => (
            <article key={n.id} className="card">
              <p>{n.text}</p>
              <small>{n.createdAt}</small>
            </article>
          ))}
        </section>
      </div>
    </div>
  )
}
