import type { Tool } from '../tool-types'
import { money, num, ok, round } from './helpers'

const KPIS: { name: string; formula: string; note: string }[] = [
  { name: 'Gross margin', formula: '(Revenue - COGS) / Revenue', note: 'Share of sales left after direct costs.' },
  { name: 'Operating margin', formula: 'Operating income / Revenue', note: 'Profit from the core business before interest and tax.' },
  { name: 'Net profit margin', formula: 'Net income / Revenue', note: 'Share of each sale that ends up as profit.' },
  { name: 'Churn rate', formula: 'Customers lost in period / Customers at start', note: 'Lower is better; track monthly for subscriptions.' },
  { name: 'Customer acquisition cost (CAC)', formula: 'Sales and marketing spend / New customers won', note: 'What it costs to win one customer.' },
  { name: 'Customer lifetime value (LTV)', formula: 'Average revenue per customer x Gross margin x Average lifetime', note: 'Total profit expected from one customer.' },
  { name: 'LTV:CAC ratio', formula: 'LTV / CAC', note: 'Around 3 or more is usually considered healthy.' },
  { name: 'Net Promoter Score (NPS)', formula: '% Promoters (9-10) - % Detractors (0-6)', note: 'Ranges from -100 to +100.' },
  { name: 'ARPU', formula: 'Total revenue / Number of users', note: 'Average revenue per user.' },
  { name: 'MRR / ARR', formula: 'Sum of monthly recurring revenue; ARR = MRR x 12', note: 'Core subscription-business metrics.' },
  { name: 'Conversion rate', formula: 'Conversions / Visitors', note: 'Share of visitors who buy, sign up, etc.' },
  { name: 'Average order value (AOV)', formula: 'Revenue / Number of orders', note: 'How much a typical order is worth.' },
  { name: 'Inventory turnover', formula: 'COGS / Average inventory', note: 'How many times stock is sold and replaced per year.' },
  { name: 'Days sales outstanding (DSO)', formula: 'Accounts receivable / Revenue x Days', note: 'Average days to collect payment.' },
  { name: 'Days payable outstanding (DPO)', formula: 'Accounts payable / COGS x Days', note: 'Average days you take to pay suppliers.' },
  { name: 'Cash conversion cycle', formula: 'Days inventory + DSO - DPO', note: 'Days cash is tied up in operations.' },
  { name: 'OEE', formula: 'Availability x Performance x Quality', note: 'Overall equipment effectiveness in manufacturing.' },
  { name: 'Employee turnover rate', formula: 'Employees who left / Average headcount', note: 'Annual or monthly share of staff leaving.' },
  { name: 'Utilization rate', formula: 'Billable hours / Available hours', note: 'How much working time earns revenue.' },
  { name: 'ROI', formula: '(Gain - Cost) / Cost', note: 'Return on an investment as a percentage.' },
  { name: 'ROAS', formula: 'Revenue from ads / Ad spend', note: 'Return on advertising spend.' },
  { name: 'First response time', formula: 'Time from ticket created to first reply', note: 'A key support quality measure.' },
]

const TEMPLATES: Record<string, (t: string) => string> = {
  swot: (t) => `SWOT: ${t}\n\nStrengths (internal, helpful)\n- \n\nWeaknesses (internal, harmful)\n- \n\nOpportunities (external, helpful)\n- \n\nThreats (external, harmful)\n- `,
  okr: (t) => `OKR: ${t}\n\nObjective: (inspiring, qualitative)\n\nKey Result 1: (measurable, from X to Y)\nKey Result 2: \nKey Result 3: \n\nInitiatives: \n\nOwner / Quarter: `,
  raci: (t) => `RACI matrix: ${t}\n\nTask | Responsible | Accountable | Consulted | Informed\n-----|-------------|--------------|-----------|---------\n     |             |              |           |\n\nRule: exactly one Accountable per task.`,
  meeting_agenda: (t) => `Meeting agenda: ${t}\n\nDate / time / attendees:\nGoal of the meeting:\n\n1. Welcome and objectives (5 min)\n2. Review of previous actions (10 min)\n3. Main topic: ${t} (25 min)\n4. Decisions needed\n5. Action items - who, what, by when (10 min)\n6. Next meeting`,
  project_charter: (t) => `Project charter: ${t}\n\nPurpose and background:\nObjectives (SMART):\nScope - in:\nScope - out:\nDeliverables:\nStakeholders and sponsor:\nMilestones and timeline:\nBudget:\nRisks and assumptions:\nSuccess criteria:`,
  status_report: (t) => `Status report: ${t}\n\nOverall status: Green / Amber / Red\nProgress since last report:\nPlanned next:\nRisks and issues (with owner):\nDecisions or help needed:\nBudget and schedule:`,
  one_on_one: (t) => `1:1 meeting: ${t}\n\nHow are you doing?\nWins since last time:\nChallenges / blockers:\nGoals progress:\nFeedback (both directions):\nCareer and development:\nActions before next 1:1:`,
  risk_register: (t) => `Risk register: ${t}\n\nID | Risk | Likelihood (1-5) | Impact (1-5) | Score | Mitigation | Owner | Status\n---|------|------------------|--------------|-------|------------|-------|-------\n1  |      |                  |              |       |            |       |`,
  user_story: (t) => `User story: ${t}\n\nAs a [type of user], I want [goal], so that [benefit].\n\nAcceptance criteria:\n- Given [context], when [action], then [result].\n- \n\nNotes / out of scope:`,
}

export const businessTools: Tool[] = [
  {
    name: 'break_even',
    category: 'Business',
    description: 'Break-even point: how many units and how much revenue you need to cover fixed costs (or reach a profit target).',
    keywords: 'break even breakeven fixed costs variable cost contribution margin units to sell profit target startup viability',
    parameters: {
      fixed_costs: { type: 'string', description: 'Total fixed costs for the period' },
      price_per_unit: { type: 'string', description: 'Selling price per unit' },
      variable_cost_per_unit: { type: 'string', description: 'Variable cost per unit' },
      target_profit: { type: 'string', description: 'Profit you want on top of break-even', optional: true },
    },
    run: ({ fixed_costs, price_per_unit, variable_cost_per_unit, target_profit }) => {
      const f = num(fixed_costs)
      const p = num(price_per_unit)
      const v = num(variable_cost_per_unit)
      const goal = Number.isFinite(num(target_profit)) ? num(target_profit) : 0
      if (!ok(f, p, v)) return 'Provide fixed costs, price per unit and variable cost per unit.'
      const cm = p - v
      if (cm <= 0) return 'Price must be higher than the variable cost, or you lose money on every unit.'
      const units = Math.ceil((f + goal) / cm)
      return `Contribution margin ${money(cm)} per unit (${round((cm / p) * 100, 1)}%). ${goal ? `To earn ${money(goal)} profit` : 'Break-even'}: ${units} units, about ${money(units * p)} in revenue.`
    },
  },
  {
    name: 'roi_calc',
    category: 'Business',
    description: 'Return on investment, and the yearly rate if you give the number of years.',
    keywords: 'roi return on investment gain profit payback annualized investment decision project value',
    parameters: {
      investment: { type: 'string', description: 'Amount invested' },
      final_value: { type: 'string', description: 'What it is worth or returned at the end' },
      years: { type: 'string', description: 'How many years it took', optional: true },
    },
    run: ({ investment, final_value, years }) => {
      const i = num(investment)
      const f = num(final_value)
      if (!ok(i, f) || i <= 0) return 'Provide a positive investment and a final value.'
      let out = `ROI ${round(((f - i) / i) * 100, 1)}% (gain ${money(f - i)}).`
      const y = num(years)
      if (Number.isFinite(y) && y > 0 && f > 0) out += ` About ${round((Math.pow(f / i, 1 / y) - 1) * 100, 2)}% per year over ${y} years.`
      return out
    },
  },
  {
    name: 'cagr',
    category: 'Business',
    description: 'Compound annual growth rate between a starting and an ending value.',
    keywords: 'cagr compound annual growth rate revenue growth yearly average growth trend start end value',
    parameters: {
      start_value: { type: 'string', description: 'Starting value' },
      end_value: { type: 'string', description: 'Ending value' },
      years: { type: 'string', description: 'Number of years between them' },
    },
    run: ({ start_value, end_value, years }) => {
      const s = num(start_value)
      const e = num(end_value)
      const y = num(years)
      if (!ok(s, e, y) || s <= 0 || e <= 0 || y <= 0) return 'Provide positive start value, end value and years.'
      return `CAGR ${round((Math.pow(e / s, 1 / y) - 1) * 100, 2)}% per year (${s} to ${e} over ${y} years).`
    },
  },
  {
    name: 'pert_estimate',
    category: 'Business',
    description: 'Three-point (PERT) estimate for a task or project from optimistic, most likely and pessimistic values.',
    keywords: 'pert estimate three point estimation project schedule task duration optimistic pessimistic most likely planning',
    parameters: {
      optimistic: { type: 'string', description: 'Best case' },
      most_likely: { type: 'string', description: 'Most likely case' },
      pessimistic: { type: 'string', description: 'Worst case' },
    },
    run: ({ optimistic, most_likely, pessimistic }) => {
      const [o, m, p] = [optimistic, most_likely, pessimistic].map(num)
      if (!ok(o, m, p) || o > m || m > p) return 'Provide optimistic <= most likely <= pessimistic.'
      const e = (o + 4 * m + p) / 6
      const sd = (p - o) / 6
      return `Expected ${round(e, 2)}, std dev ${round(sd, 2)}. About 68% of outcomes fall between ${round(e - sd, 1)} and ${round(e + sd, 1)}; 95% between ${round(e - 2 * sd, 1)} and ${round(e + 2 * sd, 1)}.`
    },
  },
  {
    name: 'nps_calc',
    category: 'Business',
    description: 'Net Promoter Score from a list of 0-10 survey scores, or from promoter / passive / detractor counts.',
    keywords: 'nps net promoter score survey customer satisfaction loyalty promoters detractors passives feedback',
    parameters: {
      scores: { type: 'string', description: 'Comma-separated 0-10 scores, e.g. "10, 9, 7, 3"', optional: true },
      promoters: { type: 'string', description: 'Count of 9-10 scores', optional: true },
      passives: { type: 'string', description: 'Count of 7-8 scores', optional: true },
      detractors: { type: 'string', description: 'Count of 0-6 scores', optional: true },
    },
    run: ({ scores, promoters, passives, detractors }) => {
      let pro = num(promoters)
      let pas = num(passives)
      let det = num(detractors)
      if (scores?.trim()) {
        const list = scores.split(/[,\s;]+/).map(Number).filter((n) => Number.isFinite(n) && n >= 0 && n <= 10)
        pro = list.filter((n) => n >= 9).length
        pas = list.filter((n) => n >= 7 && n < 9).length
        det = list.filter((n) => n < 7).length
      }
      if (!ok(pro, pas, det) || pro + pas + det === 0) return 'Provide scores, or promoter, passive and detractor counts.'
      const total = pro + pas + det
      return `NPS ${round(((pro - det) / total) * 100, 0)} (${pro} promoters, ${pas} passives, ${det} detractors of ${total}).`
    },
  },
  {
    name: 'kpi_formulas',
    category: 'Business',
    description: 'Look up the formula and meaning of a business KPI (churn, CAC, LTV, gross margin, DSO, OEE, ...). Empty to list all.',
    keywords: 'kpi metric formula definition how to calculate churn cac ltv margin arpu dso dpo oee conversion rate what is meaning business metrics',
    parameters: { kpi: { type: 'string', description: 'KPI name or part of it; empty to list all', optional: true } },
    run: ({ kpi = '' }) => {
      const q = kpi.trim().toLowerCase()
      if (!q) return KPIS.map((k) => k.name).join(', ')
      const hits = KPIS.filter((k) => k.name.toLowerCase().includes(q) || q.includes(k.name.toLowerCase().split(' ')[0]))
      return hits.length ? hits.map((k) => `${k.name}: ${k.formula}. ${k.note}`).join('\n') : `No KPI matches "${kpi}". Try: ${KPIS.map((k) => k.name).join(', ')}`
    },
  },
  {
    name: 'business_template',
    category: 'Business',
    description: `Generate a ready-to-fill business document skeleton. Kinds: ${Object.keys(TEMPLATES).join(', ')}.`,
    keywords: 'template swot okr raci meeting agenda project charter status report one on one risk register user story document outline plan format',
    parameters: {
      kind: { type: 'string', description: `One of: ${Object.keys(TEMPLATES).join(', ')}` },
      topic: { type: 'string', description: 'What it is about', optional: true },
    },
    run: ({ kind = '', topic = 'your topic' }) => {
      const key = kind.toLowerCase().replace(/[\s-]+/g, '_').replace(/^1_1$/, 'one_on_one')
      const make = TEMPLATES[key] ?? TEMPLATES[Object.keys(TEMPLATES).find((k) => key.includes(k) || k.includes(key)) ?? '']
      return make ? make(topic) : `Unknown template. Choose from: ${Object.keys(TEMPLATES).join(', ')}.`
    },
  },
]
