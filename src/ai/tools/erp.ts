import type { Tool } from '../tool-types'
import { money, num, ok, round, rows, zScore } from './helpers'

const day = 86400000
const fmtDate = (d: Date) => d.toISOString().slice(0, 10)

export const erpTools: Tool[] = [
  {
    name: 'eoq_reorder',
    category: 'ERP',
    description: 'Economic order quantity (the cheapest order size) and reorder point for an inventory item.',
    keywords: 'eoq economic order quantity reorder point inventory ordering cost holding carrying cost lead time replenishment stock purchasing',
    parameters: {
      annual_demand: { type: 'string', description: 'Units sold or used per year' },
      order_cost: { type: 'string', description: 'Cost of placing one order' },
      holding_cost: { type: 'string', description: 'Cost to hold one unit for a year' },
      lead_time_days: { type: 'string', description: 'Days from ordering to delivery', optional: true },
      safety_stock: { type: 'string', description: 'Extra units kept as a buffer', optional: true },
    },
    run: ({ annual_demand, order_cost, holding_cost, lead_time_days, safety_stock }) => {
      const d = num(annual_demand)
      const s = num(order_cost)
      const h = num(holding_cost)
      if (!ok(d, s, h) || d <= 0 || s <= 0 || h <= 0) return 'Provide positive annual demand, order cost and holding cost.'
      const q = Math.sqrt((2 * d * s) / h)
      const orders = d / q
      const total = orders * s + (q / 2) * h
      let out = `EOQ: ${round(q, 1)} units per order. About ${round(orders, 1)} orders a year (every ${round(365 / orders, 0)} days). Yearly ordering + holding cost: ${money(total)}.`
      const lead = num(lead_time_days)
      if (Number.isFinite(lead)) {
        const ss = Number.isFinite(num(safety_stock)) ? num(safety_stock) : 0
        out += ` Reorder point: ${round((d / 365) * lead + ss, 1)} units (demand during lead time${ss ? ' + safety stock' : ''}).`
      }
      return out
    },
  },
  {
    name: 'safety_stock',
    category: 'ERP',
    description: 'Safety stock needed for a target service level, from demand variability and supplier lead time.',
    keywords: 'safety stock buffer service level stockout demand variability standard deviation lead time inventory planning',
    parameters: {
      service_level_percent: { type: 'string', description: 'Target chance of not running out, e.g. 95' },
      daily_demand_std_dev: { type: 'string', description: 'Standard deviation of daily demand in units' },
      lead_time_days: { type: 'string', description: 'Supplier lead time in days' },
    },
    run: ({ service_level_percent, daily_demand_std_dev, lead_time_days }) => {
      const p = num(service_level_percent) / 100
      const sd = num(daily_demand_std_dev)
      const lt = num(lead_time_days)
      if (!ok(p, sd, lt) || p <= 0.5 || p >= 1 || sd < 0 || lt <= 0) return 'Provide a service level between 50 and 100, a std deviation and a lead time.'
      const z = zScore(p)
      return `Safety stock = z x std dev x sqrt(lead time) = ${round(z, 2)} x ${sd} x sqrt(${lt}) = ${round(z * sd * Math.sqrt(lt), 1)} units (z = ${round(z, 2)} for ${round(p * 100, 1)}% service level).`
    },
  },
  {
    name: 'inventory_turnover',
    category: 'ERP',
    description: 'Inventory turnover and days of inventory on hand, from cost of goods sold and average inventory.',
    keywords: 'inventory turnover turns days inventory on hand dio stock rotation slow moving cogs efficiency',
    parameters: {
      cogs: { type: 'string', description: 'Cost of goods sold for the period (a year)' },
      average_inventory: { type: 'string', description: 'Average inventory value, or give beginning and ending instead', optional: true },
      beginning_inventory: { type: 'string', description: 'Inventory value at the start', optional: true },
      ending_inventory: { type: 'string', description: 'Inventory value at the end', optional: true },
    },
    run: ({ cogs, average_inventory, beginning_inventory, ending_inventory }) => {
      const c = num(cogs)
      const avg = Number.isFinite(num(average_inventory)) ? num(average_inventory) : (num(beginning_inventory) + num(ending_inventory)) / 2
      if (!ok(c, avg) || c < 0 || avg <= 0) return 'Provide COGS and either average inventory or beginning and ending inventory.'
      const turns = c / avg
      return `Turnover ${round(turns, 2)}x per year, so stock sits about ${round(365 / turns, 0)} days on average. (${round(c, 0)} COGS / ${round(avg, 0)} average inventory.)`
    },
  },
  {
    name: 'three_way_match',
    category: 'ERP',
    description: 'Check a purchase order, goods receipt and supplier invoice against each other before paying (3-way match).',
    keywords: 'three way match 3-way purchase order po goods receipt invoice supplier payable accounts payable accounting verify mismatch procurement',
    parameters: {
      po_qty: { type: 'string', description: 'Quantity on the purchase order' },
      po_price: { type: 'string', description: 'Unit price on the purchase order' },
      received_qty: { type: 'string', description: 'Quantity actually received' },
      invoice_qty: { type: 'string', description: 'Quantity billed on the invoice' },
      invoice_price: { type: 'string', description: 'Unit price billed on the invoice' },
      tolerance_percent: { type: 'string', description: 'Allowed price difference in percent (default 0)', optional: true },
    },
    run: ({ po_qty, po_price, received_qty, invoice_qty, invoice_price, tolerance_percent }) => {
      const [pq, pp, rq, iq, ip] = [po_qty, po_price, received_qty, invoice_qty, invoice_price].map(num)
      const tol = Number.isFinite(num(tolerance_percent)) ? num(tolerance_percent) : 0
      if (!ok(pq, pp, rq, iq, ip)) return 'Provide numbers for all five values.'
      const issues: string[] = []
      if (rq > pq) issues.push(`received ${rq} is more than ordered ${pq}`)
      if (iq > rq) issues.push(`invoice bills ${iq} but only ${rq} received (do not pay for goods not received)`)
      const priceDiff = pp === 0 ? 0 : (Math.abs(ip - pp) / pp) * 100
      if (priceDiff > tol) issues.push(`invoice price ${ip} differs from PO price ${pp} by ${round(priceDiff, 1)}% (tolerance ${tol}%)`)
      return issues.length
        ? `MISMATCH - hold payment: ${issues.join('; ')}.`
        : `MATCH - safe to pay ${money(iq * ip)} (${iq} x ${ip}).`
    },
  },
  {
    name: 'bom_cost',
    category: 'ERP',
    description: 'Cost a bill of materials: total material cost for a product from component quantities and unit costs.',
    keywords: 'bom bill of materials cost components manufacturing production product costing material overhead assembly recipe',
    parameters: {
      components: { type: 'string', description: 'Lines of name:quantity:unit_cost separated by ; or new lines, e.g. "Frame:1:500; Screws:8:2.5"' },
      units: { type: 'string', description: 'How many finished units to build (default 1)', optional: true },
      overhead_percent: { type: 'string', description: 'Overhead added on top of materials, in percent', optional: true },
    },
    run: ({ components, units, overhead_percent }) => {
      const lines = rows(components).map((l) => l.split(':').map((x) => x.trim()))
      if (!lines.length || lines.some((l) => l.length !== 3 || !ok(num(l[1]), num(l[2])))) {
        return 'Write each component as name:quantity:unit_cost, separated by ; or new lines.'
      }
      const n = Number.isFinite(num(units)) ? num(units) : 1
      const oh = Number.isFinite(num(overhead_percent)) ? num(overhead_percent) : 0
      const detail = lines.map(([name, q, c]) => `${name}: ${q} x ${c} = ${money(num(q) * num(c))}`)
      const materials = lines.reduce((a, [, q, c]) => a + num(q) * num(c), 0)
      const unitCost = materials * (1 + oh / 100)
      return `${detail.join('\n')}\nMaterials per unit: ${money(materials)}${oh ? `; with ${oh}% overhead: ${money(unitCost)}` : ''}.\nFor ${n} unit(s): ${money(unitCost * n)}.`
    },
  },
  {
    name: 'payment_terms',
    category: 'ERP',
    description: 'Work out due date, early-payment discount and the real yearly cost of skipping it, for terms like "2/10 net 30".',
    keywords: 'payment terms net 30 2/10 early payment discount due date invoice supplier accounts payable receivable credit terms',
    parameters: {
      terms: { type: 'string', description: 'Terms such as "2/10 net 30" or "net 45"' },
      invoice_date: { type: 'string', description: 'Invoice date YYYY-MM-DD (default today)', optional: true },
      amount: { type: 'string', description: 'Invoice amount', optional: true },
    },
    run: ({ terms = '', invoice_date, amount }) => {
      const start = invoice_date?.trim() ? new Date(`${invoice_date.trim()}T00:00:00Z`) : new Date(`${fmtDate(new Date())}T00:00:00Z`)
      if (Number.isNaN(start.getTime())) return 'Could not read the invoice date; use YYYY-MM-DD.'
      const disc = /(\d+(?:\.\d+)?)\s*\/\s*(\d+)\s*,?\s*net\s*(\d+)/i.exec(terms)
      const plain = /net\s*(\d+)/i.exec(terms)
      const amt = num(amount)
      if (disc) {
        const [pct, dDays, nDays] = [Number(disc[1]), Number(disc[2]), Number(disc[3])]
        const cost = (pct / (100 - pct)) * (365 / (nDays - dDays)) * 100
        const save = Number.isFinite(amt) ? ` Discount saves ${money((amt * pct) / 100)} (pay ${money(amt * (1 - pct / 100))}).` : ''
        return `Take ${pct}% off if paid by ${fmtDate(new Date(start.getTime() + dDays * day))}; otherwise full amount due ${fmtDate(new Date(start.getTime() + nDays * day))}.${save} Skipping the discount is like borrowing at about ${round(cost, 1)}% a year, so it is usually worth taking.`
      }
      if (plain) return `Full amount due ${fmtDate(new Date(start.getTime() + Number(plain[1]) * day))} (net ${plain[1]} days from ${fmtDate(start)}).`
      return 'Write terms like "2/10 net 30" or "net 45".'
    },
  },
  {
    name: 'valuation_methods',
    category: 'ERP',
    description: 'Compare FIFO, LIFO and weighted-average inventory costing: cost of goods sold and ending inventory.',
    keywords: 'fifo lifo weighted average inventory valuation costing cogs ending inventory cost flow accounting purchases layers',
    parameters: {
      purchases: { type: 'string', description: 'Purchases oldest first as qty@unit_cost separated by ;, e.g. "100@10; 50@12"' },
      units_sold: { type: 'string', description: 'Total units sold' },
    },
    run: ({ purchases, units_sold }) => {
      const layers = rows(purchases).map((l) => l.split('@').map(num))
      const sold = num(units_sold)
      if (!layers.length || layers.some((l) => l.length !== 2 || !ok(l[0], l[1])) || !ok(sold)) {
        return 'Write purchases oldest first as qty@cost separated by ;, e.g. 100@10; 50@12.'
      }
      const have = layers.reduce((a, [q]) => a + q, 0)
      if (sold > have) return `Cannot sell ${sold}; only ${have} units were purchased.`
      const totalCost = layers.reduce((a, [q, c]) => a + q * c, 0)
      const consume = (order: number[][]) => {
        let left = sold
        let cogs = 0
        for (const [q, c] of order) {
          const take = Math.min(q, left)
          cogs += take * c
          left -= take
        }
        return cogs
      }
      const fifo = consume(layers)
      const lifo = consume([...layers].reverse())
      const wac = (totalCost / have) * sold
      const line = (name: string, cogs: number) => `${name}: COGS ${money(cogs)}, ending inventory ${money(totalCost - cogs)}`
      return [line('FIFO', fifo), line('LIFO', lifo), line('Weighted average', wac)].join('\n')
    },
  },
]
