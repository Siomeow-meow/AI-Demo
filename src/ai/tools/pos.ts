import type { Tool } from '../tool-types'
import { money, num, ok, round, rows } from './helpers'

export const posTools: Tool[] = [
  {
    name: 'pos_checkout',
    category: 'POS',
    description: 'Ring up a sale: item lines, discount, tax and cash tendered, giving the total and change.',
    keywords: 'pos point of sale checkout cashier receipt total tax discount change cash tendered cart basket sale transaction',
    parameters: {
      items: { type: 'string', description: 'Lines like "Coffee x2 @ 120" separated by ; or new lines' },
      discount_percent: { type: 'string', description: 'Discount on the whole sale, in percent', optional: true },
      tax_percent: { type: 'string', description: 'Sales tax / VAT rate in percent', optional: true },
      tax_included: { type: 'string', description: '"yes" if prices already include tax', optional: true },
      cash_tendered: { type: 'string', description: 'Cash the customer handed over', optional: true },
    },
    run: ({ items, discount_percent, tax_percent, tax_included, cash_tendered }) => {
      const lines = rows(items).map((l) => {
        const m = /^(.*?)\s*[x×*]\s*(\d+(?:\.\d+)?)\s*[@:]\s*[₱$]?\s*([\d,.]+)$/i.exec(l)
        return m ? { name: m[1].trim() || 'Item', qty: Number(m[2]), price: num(m[3]) } : null
      })
      if (!lines.length || lines.some((l) => !l || !ok(l.qty, l.price))) {
        return 'Write each item like "Coffee x2 @ 120", separated by ; or new lines.'
      }
      const cart = lines as { name: string; qty: number; price: number }[]
      const sub = cart.reduce((a, l) => a + l.qty * l.price, 0)
      const dPct = Number.isFinite(num(discount_percent)) ? num(discount_percent) : 0
      const tPct = Number.isFinite(num(tax_percent)) ? num(tax_percent) : 0
      const discount = (sub * dPct) / 100
      const taxable = sub - discount
      const included = /^(y|true|incl)/i.test(tax_included ?? '')
      const tax = included ? taxable - taxable / (1 + tPct / 100) : (taxable * tPct) / 100
      const total = included ? taxable : taxable + tax
      const out = [
        ...cart.map((l) => `${l.name} x${l.qty} @ ${money(l.price)} = ${money(l.qty * l.price)}`),
        `Subtotal ${money(sub)}`,
        ...(dPct ? [`Discount ${dPct}%: -${money(discount)}`] : []),
        ...(tPct ? [`Tax ${tPct}%${included ? ' (included)' : ''}: ${money(tax)}`] : []),
        `TOTAL ${money(total)}`,
      ]
      const cash = num(cash_tendered)
      if (Number.isFinite(cash)) out.push(cash >= total ? `Cash ${money(cash)}, change ${money(cash - total)}` : `Cash ${money(cash)} is short by ${money(total - cash)}`)
      return out.join('\n')
    },
  },
  {
    name: 'split_bill',
    category: 'POS',
    description: 'Split a bill between people, with an optional tip.',
    keywords: 'split bill divide restaurant tip gratuity per person share check dinner',
    parameters: {
      total: { type: 'string', description: 'Bill total' },
      people: { type: 'string', description: 'Number of people' },
      tip_percent: { type: 'string', description: 'Tip in percent', optional: true },
    },
    run: ({ total, people, tip_percent }) => {
      const t = num(total)
      const n = num(people)
      const tip = Number.isFinite(num(tip_percent)) ? num(tip_percent) : 0
      if (!ok(t, n) || n < 1) return 'Provide the total and the number of people.'
      const withTip = t * (1 + tip / 100)
      return `Total ${money(withTip)}${tip ? ` (tip ${money(t * (tip / 100))})` : ''}, so ${money(withTip / n)} each for ${n} people.`
    },
  },
  {
    name: 'markup_margin',
    category: 'POS',
    description: 'Convert between cost, selling price, markup % and margin %. Give the cost plus one of: price, margin %, markup %.',
    keywords: 'markup margin pricing selling price cost profit retail gross margin set price how much to charge',
    parameters: {
      cost: { type: 'string', description: 'What the item costs you' },
      price: { type: 'string', description: 'Selling price', optional: true },
      margin_percent: { type: 'string', description: 'Target margin (profit as % of price)', optional: true },
      markup_percent: { type: 'string', description: 'Target markup (profit as % of cost)', optional: true },
    },
    run: ({ cost, price, margin_percent, markup_percent }) => {
      const c = num(cost)
      if (!ok(c) || c <= 0) return 'Provide a positive cost.'
      let p = num(price)
      if (!Number.isFinite(p) && Number.isFinite(num(margin_percent))) p = c / (1 - num(margin_percent) / 100)
      if (!Number.isFinite(p) && Number.isFinite(num(markup_percent))) p = c * (1 + num(markup_percent) / 100)
      if (!Number.isFinite(p) || p <= 0) return 'Also give a price, margin_percent or markup_percent.'
      return `Cost ${money(c)}, price ${money(p)}: profit ${money(p - c)}, markup ${round(((p - c) / c) * 100, 1)}% (of cost), margin ${round(((p - c) / p) * 100, 1)}% (of price).`
    },
  },
  {
    name: 'cash_count',
    category: 'POS',
    description: 'End-of-day cash count: total the bills and coins, and compare with what the system expects (over / short).',
    keywords: 'cash count drawer till reconcile end of day over short denominations bills coins register closing cashier float',
    parameters: {
      denominations: { type: 'string', description: 'Pairs of value x count, e.g. "1000x3, 500x2, 100x10, 5x20"' },
      expected: { type: 'string', description: 'Amount the system says should be in the drawer', optional: true },
    },
    run: ({ denominations = '', expected }) => {
      const pairs = [...denominations.matchAll(/(\d+(?:\.\d+)?)\s*[x×*]\s*(\d+)/gi)].map((m) => [Number(m[1]), Number(m[2])])
      if (!pairs.length) return 'Write the count like "1000x3, 500x2, 100x10" (value x how many).'
      const total = pairs.reduce((a, [v, n]) => a + v * n, 0)
      const exp = num(expected)
      let out = `Counted ${money(total)} from ${pairs.reduce((a, [, n]) => a + n, 0)} notes/coins.`
      if (Number.isFinite(exp)) {
        const diff = total - exp
        out += diff === 0 ? ' Matches the expected amount exactly.' : ` ${diff > 0 ? 'OVER' : 'SHORT'} by ${money(Math.abs(diff))} against expected ${money(exp)}.`
      }
      return out
    },
  },
  {
    name: 'discount_calc',
    category: 'POS',
    description: 'Price after one or two stacked percentage discounts, with the savings and effective discount.',
    keywords: 'discount sale percent off price after discount coupon promo stacked double discount savings markdown',
    parameters: {
      price: { type: 'string', description: 'Original price' },
      discount_percent: { type: 'string', description: 'First discount in percent' },
      second_discount_percent: { type: 'string', description: 'Second discount applied after the first', optional: true },
    },
    run: ({ price, discount_percent, second_discount_percent }) => {
      const p = num(price)
      const d1 = num(discount_percent)
      const d2 = Number.isFinite(num(second_discount_percent)) ? num(second_discount_percent) : 0
      if (!ok(p, d1)) return 'Provide a price and a discount percent.'
      const final = p * (1 - d1 / 100) * (1 - d2 / 100)
      return `Final price ${money(final)}. You save ${money(p - final)} (${round(((p - final) / p) * 100, 1)}% effective discount${d2 ? '; stacked discounts multiply, they do not add' : ''}).`
    },
  },
]
