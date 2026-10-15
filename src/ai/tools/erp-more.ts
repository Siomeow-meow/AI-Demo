import type { Tool } from '../tool-types'
import { dateOf, isoDay, money, num, nums, ok, round, rows } from './helpers'

export const erpMoreTools: Tool[] = [
  {
    name: 'abc_analysis',
    category: 'ERP',
    description: 'ABC inventory classification: rank items by yearly value and label them A (top ~80% of value), B (next ~15%) or C.',
    keywords: 'abc analysis classification inventory items value pareto 80 20 prioritise stock control cycle counting ranking',
    parameters: { items: { type: 'string', description: 'Lines of name:annual_value separated by ; or new lines, e.g. "Laptops:500000; Cables:12000"' } },
    run: ({ items }) => {
      const list = rows(items).map((l) => {
        const i = l.lastIndexOf(':')
        return { name: l.slice(0, i).trim(), value: num(l.slice(i + 1)) }
      })
      if (!list.length || list.some((x) => !x.name || !ok(x.value))) return 'Write items as name:value separated by ; or new lines.'
      list.sort((a, b) => b.value - a.value)
      const total = list.reduce((a, x) => a + x.value, 0)
      let cum = 0
      const out = list.map((x) => {
        const before = (cum / total) * 100
        cum += x.value
        const cls = before < 80 ? 'A' : before < 95 ? 'B' : 'C'
        return { ...x, cls, cumPct: (cum / total) * 100 }
      })
      const summary = ['A', 'B', 'C'].map((c) => {
        const g = out.filter((x) => x.cls === c)
        return `${c}: ${g.length} item(s), ${round((g.reduce((a, x) => a + x.value, 0) / total) * 100, 1)}% of value`
      })
      return `${out.map((x) => `${x.cls}  ${x.name}  ${money(x.value)}  (cumulative ${round(x.cumPct, 1)}%)`).join('\n')}\n${summary.join(' | ')}`
    },
  },
  {
    name: 'mrp_netting',
    category: 'ERP',
    description: 'Material requirements planning (MRP) for one item: net requirements and planned orders per period from gross demand, stock on hand and scheduled receipts.',
    keywords: 'mrp material requirements planning net requirements planned order release gross demand on hand scheduled receipts lot size lead time production planning',
    parameters: {
      gross_requirements: { type: 'string', description: 'Demand per period, comma separated, e.g. "100, 80, 120, 90"' },
      on_hand: { type: 'string', description: 'Stock at the start' },
      scheduled_receipts: { type: 'string', description: 'Orders already due per period (same length), e.g. "0, 50, 0, 0"', optional: true },
      lot_size: { type: 'string', description: 'Order in multiples of this (default: exact need)', optional: true },
      lead_time_periods: { type: 'string', description: 'Periods between releasing and receiving an order', optional: true },
      safety_stock: { type: 'string', description: 'Minimum stock to keep', optional: true },
    },
    run: ({ gross_requirements, on_hand, scheduled_receipts, lot_size, lead_time_periods, safety_stock }) => {
      const gross = nums(gross_requirements)
      const start = num(on_hand)
      if (!gross.length || !ok(start, ...gross)) return 'Provide gross requirements per period and the stock on hand.'
      const rec = scheduled_receipts?.trim() ? nums(scheduled_receipts) : gross.map(() => 0)
      if (rec.length !== gross.length || !ok(...rec)) return 'Scheduled receipts must have one number per period.'
      const lot = Number.isFinite(num(lot_size)) && num(lot_size) > 0 ? num(lot_size) : 0
      const lead = Number.isFinite(num(lead_time_periods)) ? Math.max(0, Math.round(num(lead_time_periods))) : 0
      const ss = Number.isFinite(num(safety_stock)) ? num(safety_stock) : 0
      let stock = start
      const lines: string[] = []
      for (let t = 0; t < gross.length; t++) {
        stock += rec[t] - gross[t]
        const net = Math.max(0, ss - stock)
        const planned = net > 0 ? (lot ? Math.ceil(net / lot) * lot : net) : 0
        stock += planned
        const release = t - lead
        lines.push(
          `Period ${t + 1}: demand ${gross[t]}, receipts ${rec[t]}, net need ${round(net, 2)}, planned order ${round(planned, 2)}${planned ? ` (release in period ${release + 1}${release < 0 ? ' - already late, release now' : ''})` : ''}, projected stock ${round(stock, 2)}`,
        )
      }
      return lines.join('\n')
    },
  },
  {
    name: 'aging_report',
    category: 'ERP',
    description: 'Accounts receivable / payable aging: group open invoices into current, 1-30, 31-60, 61-90 and 90+ days past due.',
    keywords: 'aging ageing report accounts receivable payable overdue past due invoices buckets collections outstanding dso unpaid',
    parameters: {
      invoices: { type: 'string', description: 'Lines of due_date:amount (YYYY-MM-DD:amount) separated by ; or new lines' },
      as_of: { type: 'string', description: 'Report date YYYY-MM-DD (default today)', optional: true },
    },
    run: ({ invoices, as_of }) => {
      const asOf = dateOf(as_of)
      if (!asOf) return 'Could not read the as-of date; use YYYY-MM-DD.'
      const items = rows(invoices).map((l) => {
        const [d, a] = l.split(':')
        return { due: dateOf(d), amount: num(a) }
      })
      if (!items.length || items.some((x) => !x.due || !ok(x.amount))) return 'Write invoices as YYYY-MM-DD:amount, separated by ; or new lines.'
      const buckets = [
        ['Current (not yet due)', 0],
        ['1-30 days', 0],
        ['31-60 days', 0],
        ['61-90 days', 0],
        ['Over 90 days', 0],
      ] as [string, number][]
      for (const it of items) {
        const late = Math.round((asOf.getTime() - (it.due as Date).getTime()) / 86400000)
        buckets[late <= 0 ? 0 : late <= 30 ? 1 : late <= 60 ? 2 : late <= 90 ? 3 : 4][1] += it.amount
      }
      const total = buckets.reduce((a, [, v]) => a + v, 0)
      const overdue = total - buckets[0][1]
      return `As of ${isoDay(asOf)}:\n${buckets.map(([n, v]) => `${n}: ${money(v)} (${total ? round((v / total) * 100, 1) : 0}%)`).join('\n')}\nTotal ${money(total)}; overdue ${money(overdue)} (${total ? round((overdue / total) * 100, 1) : 0}%).`
    },
  },
  {
    name: 'demand_forecast',
    category: 'ERP',
    description: 'Forecast next-period demand or sales from past values using a moving average or exponential smoothing, with a back-test error.',
    keywords: 'forecast demand sales prediction moving average exponential smoothing time series trend next month planning projection mad mape',
    parameters: {
      history: { type: 'string', description: 'Past values oldest first, comma separated, e.g. "120, 135, 128, 150"' },
      method: { type: 'string', description: 'moving_average (default) or exp_smoothing', optional: true },
      window: { type: 'string', description: 'Moving-average window (default 3)', optional: true },
      alpha: { type: 'string', description: 'Smoothing factor 0-1 (default 0.3)', optional: true },
    },
    run: ({ history, method = 'moving_average', window, alpha }) => {
      const x = nums(history)
      if (x.length < 3 || !ok(...x)) return 'Provide at least 3 past values.'
      const exp = /exp|smooth/i.test(method)
      const w = Math.min(Math.max(Math.round(num(window)) || 3, 1), x.length - 1)
      const a = Number.isFinite(num(alpha)) ? Math.min(Math.max(num(alpha), 0.01), 1) : 0.3
      const errors: number[] = []
      const pct: number[] = []
      let forecast: number
      if (exp) {
        let s = x[0]
        for (let t = 1; t < x.length; t++) {
          errors.push(x[t] - s)
          if (x[t] !== 0) pct.push(Math.abs((x[t] - s) / x[t]))
          s = a * x[t] + (1 - a) * s
        }
        forecast = s
      } else {
        for (let t = w; t < x.length; t++) {
          const f = x.slice(t - w, t).reduce((p, c) => p + c, 0) / w
          errors.push(x[t] - f)
          if (x[t] !== 0) pct.push(Math.abs((x[t] - f) / x[t]))
        }
        forecast = x.slice(-w).reduce((p, c) => p + c, 0) / w
      }
      const mad = errors.reduce((p, c) => p + Math.abs(c), 0) / errors.length
      const bias = errors.reduce((p, c) => p + c, 0) / errors.length
      return `${exp ? `Exponential smoothing (alpha ${a})` : `${w}-period moving average`} forecast for next period: ${round(forecast, 2)}. Back-test: MAD ${round(mad, 2)}${pct.length ? `, MAPE ${round((pct.reduce((p, c) => p + c, 0) / pct.length) * 100, 1)}%` : ''}, bias ${round(bias, 2)} (${bias > 0 ? 'under-forecasting' : 'over-forecasting'}).`
    },
  },
  {
    name: 'reconcile_lists',
    category: 'ERP',
    description: 'Reconcile two lists of amounts (for example bank statement vs ledger): find matches and the items that appear in only one list.',
    keywords: 'reconcile reconciliation bank statement ledger match unmatched difference compare amounts transactions audit two lists',
    parameters: {
      list_a: { type: 'string', description: 'First list of amounts, comma separated (e.g. the ledger)' },
      list_b: { type: 'string', description: 'Second list of amounts (e.g. the bank)' },
      tolerance: { type: 'string', description: 'Amounts closer than this count as equal (default 0.005)', optional: true },
    },
    run: ({ list_a, list_b, tolerance }) => {
      const a = nums(list_a)
      const b = nums(list_b)
      const tol = Number.isFinite(num(tolerance)) ? num(tolerance) : 0.005
      if (!a.length || !b.length || !ok(...a, ...b)) return 'Provide two lists of numbers.'
      const rest = [...b]
      const onlyA: number[] = []
      let matched = 0
      for (const v of a) {
        const i = rest.findIndex((w) => Math.abs(w - v) <= tol)
        if (i >= 0) {
          rest.splice(i, 1)
          matched++
        } else onlyA.push(v)
      }
      const sum = (l: number[]) => l.reduce((p, c) => p + c, 0)
      return `${matched} item(s) matched.\nOnly in list A (${onlyA.length}): ${onlyA.join(', ') || 'none'}\nOnly in list B (${rest.length}): ${rest.join(', ') || 'none'}\nTotals: A ${money(sum(a))}, B ${money(sum(b))}, difference ${money(sum(a) - sum(b))}.`
    },
  },
  {
    name: 'fiscal_period',
    category: 'ERP',
    description: 'Find the fiscal year, fiscal quarter and period number of a date, for a financial year that starts in any month.',
    keywords: 'fiscal year quarter period accounting calendar financial year start month q1 q2 q3 q4 posting period closing',
    parameters: {
      date: { type: 'string', description: 'Date YYYY-MM-DD (default today)', optional: true },
      fiscal_year_start_month: { type: 'string', description: 'Month number the fiscal year starts (1-12, default 1)', optional: true },
    },
    run: ({ date, fiscal_year_start_month }) => {
      const d = dateOf(date)
      const start = Number.isFinite(num(fiscal_year_start_month)) ? Math.round(num(fiscal_year_start_month)) : 1
      if (!d || start < 1 || start > 12) return 'Provide a valid date and a start month between 1 and 12.'
      const m = d.getUTCMonth() + 1
      const offset = (m - start + 12) % 12
      const fy = start === 1 ? d.getUTCFullYear() : m >= start ? d.getUTCFullYear() + 1 : d.getUTCFullYear()
      return `${isoDay(d)} falls in FY${fy}, Q${Math.floor(offset / 3) + 1}, period ${offset + 1} (fiscal year starts month ${start}; FY is named by the year it ends).`
    },
  },
]
