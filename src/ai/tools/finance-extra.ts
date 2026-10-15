import type { Tool } from '../tool-types'
import { money, num, ok, round } from './helpers'

function npv(rate: number, flows: number[]) {
  return flows.reduce((a, cf, t) => a + cf / (1 + rate) ** t, 0)
}

/** IRR by bisection; returns NaN when there is no sign change (no real IRR). */
function irr(flows: number[]): number {
  let lo = -0.99
  let hi = 10
  if (npv(lo, flows) * npv(hi, flows) > 0) return NaN
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2
    if (npv(lo, flows) * npv(mid, flows) <= 0) hi = mid
    else lo = mid
  }
  return (lo + hi) / 2
}

const RATIO_KEYS: Record<string, string[]> = {
  current_assets: ['current_assets', 'ca'],
  current_liabilities: ['current_liabilities', 'cl'],
  inventory: ['inventory', 'inv'],
  cash: ['cash'],
  receivables: ['receivables', 'accounts_receivable', 'ar'],
  payables: ['payables', 'accounts_payable', 'ap'],
  total_assets: ['total_assets', 'assets'],
  total_liabilities: ['total_liabilities', 'liabilities'],
  equity: ['equity', 'shareholders_equity'],
  revenue: ['revenue', 'sales'],
  cogs: ['cogs', 'cost_of_goods_sold'],
  operating_income: ['operating_income', 'ebit'],
  net_income: ['net_income', 'profit'],
  interest_expense: ['interest_expense', 'interest'],
}

export const financeExtraTools: Tool[] = [
  {
    name: 'npv_irr',
    category: 'Finance',
    description: 'Net present value, internal rate of return and payback period for a series of cash flows (first one is usually the negative investment).',
    keywords: 'npv irr net present value internal rate of return cash flows capital budgeting project investment appraisal payback discount rate',
    parameters: {
      cashflows: { type: 'string', description: 'Comma-separated cash flows per period starting at period 0, e.g. "-10000, 3000, 4000, 5000"' },
      discount_rate_percent: { type: 'string', description: 'Required return per period in percent, e.g. 10' },
    },
    run: ({ cashflows = '', discount_rate_percent }) => {
      const flows = cashflows.split(/[,;\s]+/).filter(Boolean).map(Number)
      const r = num(discount_rate_percent) / 100
      if (flows.length < 2 || !ok(r, ...flows)) return 'Provide at least two cash flows and a discount rate.'
      const value = npv(r, flows)
      const rate = irr(flows)
      let cum = 0
      let payback = 'not within the period'
      for (let t = 0; t < flows.length; t++) {
        const prev = cum
        cum += flows[t]
        if (cum >= 0 && t > 0) {
          payback = `${round(t - 1 + -prev / flows[t], 2)} periods`
          break
        }
      }
      return `NPV at ${round(r * 100, 2)}%: ${money(value)} (${value >= 0 ? 'accept: adds value' : 'reject: destroys value'}). IRR: ${Number.isNaN(rate) ? 'none (cash flows never change sign)' : `${round(rate * 100, 2)}%`}. Payback: ${payback}.`
    },
  },
  {
    name: 'depreciation',
    category: 'Finance',
    description: 'Depreciation schedule for an asset: straight-line, declining balance (double) or sum-of-years-digits.',
    keywords: 'depreciation asset schedule straight line declining balance sum of years digits book value salvage useful life accounting equipment',
    parameters: {
      cost: { type: 'string', description: 'Purchase cost of the asset' },
      salvage_value: { type: 'string', description: 'Value left at the end of its life' },
      life_years: { type: 'string', description: 'Useful life in years' },
      method: { type: 'string', description: 'straight_line (default), declining_balance or sum_of_years', optional: true },
    },
    run: ({ cost, salvage_value, life_years, method = 'straight_line' }) => {
      const c = num(cost)
      const s = num(salvage_value)
      const n = Math.round(num(life_years))
      if (!ok(c, s, n) || n < 1 || n > 40 || s > c) return 'Provide cost, salvage value (not above cost) and a life of 1-40 years.'
      const m = /declin|double|db/i.test(method) ? 'db' : /sum|syd/i.test(method) ? 'syd' : 'sl'
      let book = c
      const rowsOut: string[] = []
      for (let t = 1; t <= n; t++) {
        let dep = m === 'sl' ? (c - s) / n : m === 'syd' ? ((n - t + 1) / ((n * (n + 1)) / 2)) * (c - s) : book * (2 / n)
        if (m === 'db') dep = Math.min(dep, book - s)
        book -= dep
        rowsOut.push(`Year ${t}: depreciation ${money(dep)}, book value ${money(book)}`)
      }
      const label = m === 'sl' ? 'Straight-line' : m === 'db' ? 'Double declining balance' : 'Sum-of-years-digits'
      return `${label}:\n${rowsOut.join('\n')}`
    },
  },
  {
    name: 'financial_ratios',
    category: 'Finance',
    description: 'Calculate liquidity, leverage, profitability and efficiency ratios from figures like revenue=1000, net_income=120, current_assets=500.',
    keywords: 'financial ratios current ratio quick ratio debt to equity roe roa profit margin interest coverage liquidity leverage analysis statements dso dpo',
    parameters: {
      values: {
        type: 'string',
        description: `name=value pairs separated by commas. Names: ${Object.keys(RATIO_KEYS).join(', ')}`,
      },
    },
    run: ({ values = '' }) => {
      const v: Record<string, number> = {}
      for (const part of values.split(/[,;\n]+/)) {
        const m = /^\s*([a-z_ ]+?)\s*[=:]\s*([-\d.,]+)\s*$/i.exec(part)
        if (!m) continue
        const key = m[1].toLowerCase().replace(/\s+/g, '_')
        const canonical = Object.keys(RATIO_KEYS).find((k) => RATIO_KEYS[k].includes(key))
        if (canonical) v[canonical] = Number(m[2].replace(/,/g, ''))
      }
      const has = (...k: string[]) => k.every((x) => Number.isFinite(v[x]))
      const out: string[] = []
      const add = (label: string, val: number, suffix = '', hint = '') => out.push(`${label}: ${round(val, 2)}${suffix}${hint ? ` (${hint})` : ''}`)
      if (has('current_assets', 'current_liabilities')) add('Current ratio', v.current_assets / v.current_liabilities, '', 'above 1 means short-term bills are covered')
      if (has('current_assets', 'inventory', 'current_liabilities')) add('Quick ratio', (v.current_assets - v.inventory) / v.current_liabilities, '', 'liquidity without selling stock')
      if (has('cash', 'current_liabilities')) add('Cash ratio', v.cash / v.current_liabilities)
      if (has('total_liabilities', 'equity')) add('Debt-to-equity', v.total_liabilities / v.equity, '', 'lower means less leverage')
      if (has('total_liabilities', 'total_assets')) add('Debt ratio', (v.total_liabilities / v.total_assets) * 100, '%')
      if (has('revenue', 'cogs')) add('Gross margin', ((v.revenue - v.cogs) / v.revenue) * 100, '%')
      if (has('revenue', 'operating_income')) add('Operating margin', (v.operating_income / v.revenue) * 100, '%')
      if (has('revenue', 'net_income')) add('Net margin', (v.net_income / v.revenue) * 100, '%')
      if (has('net_income', 'total_assets')) add('ROA', (v.net_income / v.total_assets) * 100, '%')
      if (has('net_income', 'equity')) add('ROE', (v.net_income / v.equity) * 100, '%')
      if (has('operating_income', 'interest_expense')) add('Interest coverage', v.operating_income / v.interest_expense, 'x', 'above 3 is comfortable')
      if (has('receivables', 'revenue')) add('Days sales outstanding', (v.receivables / v.revenue) * 365, ' days')
      if (has('payables', 'cogs')) add('Days payable outstanding', (v.payables / v.cogs) * 365, ' days')
      if (has('inventory', 'cogs')) add('Days inventory', (v.inventory / v.cogs) * 365, ' days')
      return out.length ? out.join('\n') : `No ratios could be computed. Give values like revenue=1000, net_income=120. Names: ${Object.keys(RATIO_KEYS).join(', ')}`
    },
  },
  {
    name: 'savings_goal',
    category: 'Finance',
    description: 'Monthly amount to save to reach a goal by a deadline, with optional interest and existing savings.',
    keywords: 'savings goal save monthly deposit target how much to save emergency fund down payment plan retirement budget future',
    parameters: {
      goal: { type: 'string', description: 'Target amount' },
      years: { type: 'string', description: 'Years to reach it' },
      annual_rate_percent: { type: 'string', description: 'Yearly interest rate in percent (default 0)', optional: true },
      current_savings: { type: 'string', description: 'Amount already saved', optional: true },
    },
    run: ({ goal, years, annual_rate_percent, current_savings }) => {
      const g = num(goal)
      const y = num(years)
      const r = (Number.isFinite(num(annual_rate_percent)) ? num(annual_rate_percent) : 0) / 100 / 12
      const start = Number.isFinite(num(current_savings)) ? num(current_savings) : 0
      const n = Math.round(y * 12)
      if (!ok(g, y) || g <= 0 || n < 1) return 'Provide a goal and a number of years.'
      const need = g - start * (1 + r) ** n
      if (need <= 0) return 'Your current savings will already reach the goal.'
      const pay = r === 0 ? need / n : (need * r) / ((1 + r) ** n - 1)
      return `Save ${money(pay)} per month for ${n} months to reach ${money(g)}${r ? ` at ${round(r * 1200, 2)}% a year` : ''}. You would deposit ${money(pay * n)} in total.`
    },
  },
  {
    name: 'amortization_schedule',
    category: 'Finance',
    description: 'Loan amortization table: interest, principal and balance for the first months, plus total interest.',
    keywords: 'amortization schedule loan repayment table principal interest balance mortgage installment breakdown payoff',
    parameters: {
      principal: { type: 'string', description: 'Amount borrowed' },
      annual_rate_percent: { type: 'string', description: 'Yearly interest rate in percent' },
      years: { type: 'string', description: 'Loan term in years' },
      show_months: { type: 'string', description: 'How many months to list (default 6, max 24)', optional: true },
    },
    run: ({ principal, annual_rate_percent, years, show_months }) => {
      const p = num(principal)
      const r = num(annual_rate_percent) / 100 / 12
      const n = Math.round(num(years) * 12)
      if (!ok(p, r, n) || p <= 0 || n < 1 || r < 0) return 'Provide a positive principal, rate and term.'
      const pay = r === 0 ? p / n : (p * r) / (1 - (1 + r) ** -n)
      const show = Math.min(Math.max(Math.round(num(show_months)) || 6, 1), 24, n)
      let bal = p
      const table: string[] = []
      for (let m = 1; m <= show; m++) {
        const interest = bal * r
        const princ = pay - interest
        bal -= princ
        table.push(`Month ${m}: pay ${money(pay)} = interest ${money(interest)} + principal ${money(princ)}, balance ${money(Math.max(bal, 0))}`)
      }
      return `${table.join('\n')}\nTotal interest over ${n} months: ${money(pay * n - p)}.`
    },
  },
  {
    name: 'budget_503020',
    category: 'Finance',
    description: 'Split income using the 50/30/20 budgeting rule: needs, wants and savings.',
    keywords: 'budget 50 30 20 rule needs wants savings personal finance income split monthly budgeting allocation',
    parameters: { income: { type: 'string', description: 'Monthly take-home income' } },
    run: ({ income }) => {
      const i = num(income)
      if (!ok(i) || i <= 0) return 'Provide a positive monthly income.'
      return `Income ${money(i)}: needs (rent, food, bills) 50% = ${money(i * 0.5)}; wants (fun, dining, subscriptions) 30% = ${money(i * 0.3)}; savings and debt repayment 20% = ${money(i * 0.2)}.`
    },
  },
]
