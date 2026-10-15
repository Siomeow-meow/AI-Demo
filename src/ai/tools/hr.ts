import type { Tool } from '../tool-types'
import { dateOf, isoDay, money, num, ok, round, rows } from './helpers'

const PERIODS = ['hourly', 'daily', 'weekly', 'monthly', 'annual']

export const hrTools: Tool[] = [
  {
    name: 'payroll_calc',
    category: 'HR & payroll',
    description: 'Illustrative pay calculation: gross pay plus allowances minus a percentage of deductions (tax, social contributions) and fixed deductions gives net pay. Not statutory.',
    keywords: 'payroll salary net pay take home gross pay deductions tax contributions allowance wage payslip compensation',
    parameters: {
      gross: { type: 'string', description: 'Gross pay for the period' },
      deduction_percent: { type: 'string', description: 'Total percentage deducted (tax + contributions)', optional: true },
      fixed_deductions: { type: 'string', description: 'Fixed amounts deducted (loans, insurance)', optional: true },
      allowances: { type: 'string', description: 'Non-taxed allowances added after deductions', optional: true },
    },
    run: ({ gross, deduction_percent, fixed_deductions, allowances }) => {
      const g = num(gross)
      const pct = Number.isFinite(num(deduction_percent)) ? num(deduction_percent) : 0
      const fixed = Number.isFinite(num(fixed_deductions)) ? num(fixed_deductions) : 0
      const allow = Number.isFinite(num(allowances)) ? num(allowances) : 0
      if (!ok(g) || g < 0) return 'Provide the gross pay.'
      const pctAmount = (g * pct) / 100
      const net = g - pctAmount - fixed + allow
      return `Gross ${money(g)} - ${pct}% deductions (${money(pctAmount)}) - fixed ${money(fixed)} + allowances ${money(allow)} = net ${money(net)}. Illustrative only: real tax and contribution tables depend on your country and rules.`
    },
  },
  {
    name: 'overtime_pay',
    category: 'HR & payroll',
    description: 'Pay for regular and overtime hours, with an adjustable overtime multiplier.',
    keywords: 'overtime pay ot hours rate multiplier extra hours wage weekly pay holiday premium timesheet',
    parameters: {
      hourly_rate: { type: 'string', description: 'Normal pay per hour' },
      regular_hours: { type: 'string', description: 'Regular hours worked' },
      overtime_hours: { type: 'string', description: 'Overtime hours worked' },
      multiplier: { type: 'string', description: 'Overtime multiplier (default 1.25; check your local labour rules)', optional: true },
    },
    run: ({ hourly_rate, regular_hours, overtime_hours, multiplier }) => {
      const r = num(hourly_rate)
      const h = num(regular_hours)
      const o = num(overtime_hours)
      const m = Number.isFinite(num(multiplier)) ? num(multiplier) : 1.25
      if (!ok(r, h, o)) return 'Provide hourly rate, regular hours and overtime hours.'
      return `Regular ${money(r * h)} + overtime ${money(r * m * o)} (${o} h at ${m}x) = ${money(r * h + r * m * o)}.`
    },
  },
  {
    name: 'leave_accrual',
    category: 'HR & payroll',
    description: 'Leave balance from a yearly entitlement that accrues monthly, minus days already taken.',
    keywords: 'leave accrual vacation days balance entitlement accrue month remaining pto time off earned used',
    parameters: {
      days_per_year: { type: 'string', description: 'Yearly leave entitlement in days' },
      months_worked: { type: 'string', description: 'Months worked so far this year' },
      days_used: { type: 'string', description: 'Days already taken', optional: true },
    },
    run: ({ days_per_year, months_worked, days_used }) => {
      const y = num(days_per_year)
      const m = num(months_worked)
      const used = Number.isFinite(num(days_used)) ? num(days_used) : 0
      if (!ok(y, m) || m < 0 || m > 12) return 'Provide days per year and months worked (0-12).'
      const earned = (y / 12) * m
      return `Earned ${round(earned, 2)} days (${round(y / 12, 2)} per month x ${m}); used ${used}; balance ${round(earned - used, 2)} days.`
    },
  },
  {
    name: 'working_days',
    category: 'HR & payroll',
    description: 'Count business days (Mon-Fri) between two dates, or find the date N business days from a start date. Optional holidays are skipped.',
    keywords: 'working days business days weekdays between dates workdays deadline turnaround sla delivery date excluding weekends holidays',
    parameters: {
      start: { type: 'string', description: 'Start date YYYY-MM-DD' },
      end: { type: 'string', description: 'End date YYYY-MM-DD (to count)', optional: true },
      add_days: { type: 'string', description: 'Business days to add to start (to find a date)', optional: true },
      holidays: { type: 'string', description: 'Holiday dates YYYY-MM-DD separated by commas', optional: true },
    },
    run: ({ start, end, add_days, holidays }) => {
      const a = dateOf(start)
      if (!a) return 'Provide a valid start date (YYYY-MM-DD).'
      const off = new Set((holidays ?? '').split(/[,;\s]+/).filter(Boolean))
      const isWork = (d: Date) => d.getUTCDay() !== 0 && d.getUTCDay() !== 6 && !off.has(isoDay(d))
      if (end?.trim()) {
        const b = dateOf(end)
        if (!b) return 'Could not read the end date.'
        const [lo, hi] = a <= b ? [a, b] : [b, a]
        let n = 0
        for (let t = lo.getTime(); t <= hi.getTime(); t += 86400000) if (isWork(new Date(t))) n++
        return `${n} business day(s) from ${isoDay(lo)} to ${isoDay(hi)} inclusive.`
      }
      const add = Math.round(num(add_days))
      if (!Number.isFinite(add)) return 'Provide an end date or add_days.'
      let t = a.getTime()
      let left = Math.abs(add)
      const step = add < 0 ? -86400000 : 86400000
      while (left > 0) {
        t += step
        if (isWork(new Date(t))) left--
      }
      return `${Math.abs(add)} business day(s) ${add < 0 ? 'before' : 'after'} ${isoDay(a)} is ${isoDay(new Date(t))} (${new Date(t).toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' })}).`
    },
  },
  {
    name: 'salary_convert',
    category: 'HR & payroll',
    description: 'Convert a pay rate between hourly, daily, weekly, monthly and annual figures.',
    keywords: 'salary convert hourly annual monthly weekly daily rate wage pay per hour yearly income equivalent compensation',
    parameters: {
      amount: { type: 'string', description: 'The pay amount' },
      period: { type: 'string', description: 'What the amount covers: hourly, daily, weekly, monthly or annual' },
      hours_per_week: { type: 'string', description: 'Hours per week (default 40)', optional: true },
    },
    run: ({ amount, period = '', hours_per_week }) => {
      const a = num(amount)
      const hpw = Number.isFinite(num(hours_per_week)) ? num(hours_per_week) : 40
      const p = /year/i.test(period) ? 'annual' : PERIODS.find((x) => period.toLowerCase().startsWith(x.slice(0, 3)))
      if (!ok(a) || !p) return 'Provide an amount and a period (hourly, daily, weekly, monthly or annual).'
      const hourly = { hourly: a, daily: a / (hpw / 5), weekly: a / hpw, monthly: (a * 12) / (hpw * 52), annual: a / (hpw * 52) }[p as 'hourly']
      return `Based on ${hpw} h/week: hourly ${money(hourly)}, daily ${money(hourly * (hpw / 5))}, weekly ${money(hourly * hpw)}, monthly ${money((hourly * hpw * 52) / 12)}, annual ${money(hourly * hpw * 52)}.`
    },
  },
  {
    name: 'commission_calc',
    category: 'HR & payroll',
    description: 'Tiered (marginal) sales commission, e.g. 2% on the first 10,000, 5% up to 50,000, 8% above.',
    keywords: 'commission sales tiers bonus incentive percentage tiered rate earnings salesperson payout marginal',
    parameters: {
      sales: { type: 'string', description: 'Total sales amount' },
      tiers: { type: 'string', description: 'Tiers like "0-10000:2%; 10000-50000:5%; 50000+:8%"' },
    },
    run: ({ sales, tiers = '' }) => {
      const s = num(sales)
      const parsed = rows(tiers).map((t) => {
        const m = /^\s*([\d,.]+)\s*(?:-\s*([\d,.]+)|\+)\s*:\s*([\d.]+)\s*%?\s*$/.exec(t)
        return m ? { lo: num(m[1]), hi: m[2] ? num(m[2]) : Infinity, rate: Number(m[3]) / 100 } : null
      })
      if (!ok(s) || !parsed.length || parsed.some((t) => !t)) return 'Write tiers like "0-10000:2%; 10000-50000:5%; 50000+:8%".'
      let total = 0
      const lines: string[] = []
      for (const t of parsed as { lo: number; hi: number; rate: number }[]) {
        const part = Math.max(0, Math.min(s, t.hi) - t.lo)
        if (part > 0) {
          total += part * t.rate
          lines.push(`${money(part)} at ${round(t.rate * 100, 2)}% = ${money(part * t.rate)}`)
        }
      }
      return `${lines.join('\n')}\nCommission ${money(total)} on sales of ${money(s)} (effective ${s ? round((total / s) * 100, 2) : 0}%).`
    },
  },
]
