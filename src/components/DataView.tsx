import { useState, useSyncExternalStore } from 'react'
import type { ChangeEvent } from 'react'
import { datasetStore, employeeStore, inventoryStore, salesStore } from '../ai/data'
import { CORE_KINDS, coreColumns, coreLabel, importCore, importDataset, removeDataset, resetCore, templateCsv } from '../ai/datasets'
import type { CoreKind } from '../ai/datasets'
import { downloadText } from '../ai/ingest'

export function DataView() {
  const employees = useSyncExternalStore(employeeStore.subscribe, employeeStore.get)
  const inventory = useSyncExternalStore(inventoryStore.subscribe, inventoryStore.get)
  const sales = useSyncExternalStore(salesStore.subscribe, salesStore.get)
  const datasets = useSyncExternalStore(datasetStore.subscribe, datasetStore.get)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const rows: Record<CoreKind, number> = { employees: employees.length, inventory: inventory.length, sales: sales.length }

  async function onImport(e: ChangeEvent<HTMLInputElement>, kind: CoreKind | null) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const tooBig = (saved: boolean) => (saved ? '' : ' (too large to save in this browser; kept for this session only)')
    try {
      const text = await file.text()
      if (kind) {
        const r = importCore(kind, file.name, text)
        setMessage({ ok: true, text: `Imported ${r.count} ${coreLabel(kind).toLowerCase()} rows${tooBig(r.saved)}.` })
      } else {
        const r = importDataset(file.name, text)
        setMessage({ ok: true, text: `Imported "${r.dataset.name}" with ${r.dataset.rows.length} rows${tooBig(r.saved)}.` })
      }
    } catch (err) {
      setMessage({ ok: false, text: `Import failed: ${(err as Error).message}` })
    }
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Data</h1>
          <p>
            The assistant answers company questions from this data. It starts with made-up samples; import your own CSV or JSON files to
            replace them. Everything stays in this browser.
          </p>
        </div>
      </div>

      {message && <p className={`banner ${message.ok ? 'ok' : 'bad'}`}>{message.text}</p>}

      <section className="group">
        <h2>Business records</h2>
        <div className="card-grid">
          {CORE_KINDS.map((kind) => (
            <article key={kind} className="card">
              <header>
                <strong>{coreLabel(kind)}</strong>
                <span className="tag">{rows[kind]} rows</span>
              </header>
              <p className="small">Columns: {coreColumns(kind).join(', ')}</p>
              <div className="card-actions">
                <label className="btn small primary">
                  Import file
                  <input type="file" accept=".csv,.json" hidden onChange={(e) => onImport(e, kind)} />
                </label>
                <button type="button" className="btn small" onClick={() => downloadText(`${kind}-template.csv`, templateCsv(kind), 'text/csv')}>
                  Template
                </button>
                <button type="button" className="btn small" onClick={() => resetCore(kind)}>
                  Reset to sample
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="group">
        <h2>
          Other tables <span className="count">{datasets.length}</span>
        </h2>
        <p className="muted">Import any CSV or JSON file. The assistant can then search it and calculate totals, averages and counts.</p>
        <label className="btn primary inline">
          + Import a table
          <input type="file" accept=".csv,.json" hidden onChange={(e) => onImport(e, null)} />
        </label>
        <div className="card-grid">
          {datasets.map((d) => (
            <article key={d.name} className="card">
              <header>
                <strong>{d.name}</strong>
                <span className="tag">{d.rows.length} rows</span>
              </header>
              <p className="small">{d.headers.join(', ')}</p>
              <div className="card-actions">
                <button type="button" className="btn small danger" onClick={() => removeDataset(d.name)}>
                  Remove
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}
