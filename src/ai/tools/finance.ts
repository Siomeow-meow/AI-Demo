import type { Tool } from '../tool-types'

const num = (s: string | undefined) => Number((s ?? '').replace(/[,₱$%\s]/g, ''))
const money = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export const financeTools: Tool[] = [
  {
    name: 'loan_payment',
    category: 'Finance',
    description: 'Monthly payment, total paid and total interest for a loan (fixed rate, equal monthly instalments).',
    keywords: 'loan mortgage payment monthly instalment amortization interest financing car loan borrow repay',
    parameters: {
      principal: { type: 'string', description: 'Amount borrowed' },
      annual_rate: { type: 'string', description: 'Yearly interest rate in percent, e.g. 8' },
      years: { type: 'string', description: 'Loan term in years' },
    },
    run: ({ principal, annual_rate, years }) => {
      const p = num(principal)
      const r = num(annual_rate) / 100 / 12
      const n = Math.round(num(years) * 12)
      if (![p, r, n].every(Number.isFinite) || p <= 0 || n <= 0 || r < 0) return 'Provide a positive principal, rate and term.'
      const pay = r === 0 ? p / n : (p * r) / (1 - (1 + r) ** -n)
      return `Monthly payment ${money(pay)} over ${n} months. Total paid ${money(pay * n)}, total interest ${money(pay * n - p)}.`
    },
  },
  {
    name: 'compound_interest',
    category: 'Finance',
    description: 'Future value of savings or an investment with compound interest, optionally with monthly deposits.',
    keywords: 'compound interest savings investment grow future value return deposit retirement yield',
    parameters: {
      principal: { type: 'string', description: 'Starting amount' },
      annual_rate: { type: 'string', description: 'Yearly rate in percent' },
      years: { type: 'string', description: 'Number of years' },
      monthly_deposit: { type: 'string', description: 'Amount added every month', optional: true },
    },
    run: ({ principal, annual_rate, years, monthly_deposit }) => {
      const p = num(principal)
      const r = num(annual_rate) / 100 / 12
      const n = Math.round(num(years) * 12)
      const d = monthly_deposit ? num(monthly_deposit) : 0
      if (![p, r, n, d].every(Number.isFinite) || n <= 0) return 'Provide a valid principal, rate and number of years.'
      const growth = (1 + r) ** n
      const fv = p * growth + (r === 0 ? d * n : d * ((growth - 1) / r))
      const invested = p + d * n
      return `After ${n / 12} years: ${money(fv)} (you put in ${money(invested)}, earned ${money(fv - invested)}).`
    },
  },
  {
    name: 'percent_change',
    category: 'Finance',
    description: 'Percentage increase or decrease from an old value to a new value.',
    keywords: 'percent change increase decrease growth difference markup margin drop rise compared',
    parameters: {
      from: { type: 'string', description: 'Old value' },
      to: { type: 'string', description: 'New value' },
    },
    run: ({ from, to }) => {
      const a = num(from)
      const b = num(to)
      if (!Number.isFinite(a) || !Number.isFinite(b) || a === 0) return 'Provide two numbers; the old value cannot be zero.'
      const c = ((b - a) / Math.abs(a)) * 100
      return `${c >= 0 ? 'Increase' : 'Decrease'} of ${Math.abs(c).toFixed(2)}% (${a} to ${b}).`
    },
  },
  {
    name: 'tax_calc',
    category: 'Finance',
    description: 'Add or remove tax (VAT/GST) from an amount at a given rate.',
    keywords: 'tax vat gst sales tax price inclusive exclusive net gross invoice',
    parameters: {
      amount: { type: 'string', description: 'The amount' },
      rate: { type: 'string', description: 'Tax rate in percent, e.g. 12' },
      mode: { type: 'string', description: '"add" to add tax (default) or "remove" to strip tax from a tax-inclusive amount', optional: true },
    },
    run: ({ amount, rate, mode = 'add' }) => {
      const a = num(amount)
      const r = num(rate) / 100
      if (!Number.isFinite(a) || !Number.isFinite(r)) return 'Provide a numeric amount and rate.'
      if (/rem|ex|net/i.test(mode)) {
        const net = a / (1 + r)
        return `Net ${money(net)} + tax ${money(a - net)} = ${money(a)}.`
      }
      return `Net ${money(a)} + tax ${money(a * r)} = total ${money(a * (1 + r))}.`
    },
  },
]
