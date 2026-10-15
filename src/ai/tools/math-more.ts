import type { Tool } from '../tool-types'
import { nums, num, ok, round } from './helpers'

function quantile(sorted: number[], q: number): number {
  const pos = (sorted.length - 1) * q
  const lo = Math.floor(pos)
  const hi = Math.ceil(pos)
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo)
}

const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen']
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety']
const SCALES = ['', 'thousand', 'million', 'billion', 'trillion', 'quadrillion']

function below1000(n: number): string {
  const parts: string[] = []
  if (n >= 100) {
    parts.push(`${ONES[Math.floor(n / 100)]} hundred`)
    n %= 100
  }
  if (n >= 20) {
    parts.push(TENS[Math.floor(n / 10)] + (n % 10 ? `-${ONES[n % 10]}` : ''))
  } else if (n > 0) {
    parts.push(ONES[n])
  }
  return parts.join(' ')
}

function toWords(n: number): string {
  if (n === 0) return 'zero'
  const chunks: string[] = []
  let scale = 0
  while (n > 0) {
    const part = n % 1000
    if (part) chunks.unshift(`${below1000(part)}${SCALES[scale] ? ` ${SCALES[scale]}` : ''}`)
    n = Math.floor(n / 1000)
    scale++
  }
  return chunks.join(' ')
}

const ROMAN: [number, string][] = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']]

const gcd = (a: number, b: number): number => (b === 0 ? Math.abs(a) : gcd(b, a % b))

const SHAPES: Record<string, { dims: string[]; calc: (d: number[]) => string }> = {
  circle: { dims: ['radius'], calc: ([r]) => `area ${round(Math.PI * r * r, 3)}, circumference ${round(2 * Math.PI * r, 3)}` },
  rectangle: { dims: ['width', 'height'], calc: ([w, h]) => `area ${round(w * h, 3)}, perimeter ${round(2 * (w + h), 3)}, diagonal ${round(Math.hypot(w, h), 3)}` },
  triangle: { dims: ['base', 'height'], calc: ([b, h]) => `area ${round((b * h) / 2, 3)}` },
  sphere: { dims: ['radius'], calc: ([r]) => `volume ${round((4 / 3) * Math.PI * r ** 3, 3)}, surface area ${round(4 * Math.PI * r * r, 3)}` },
  cylinder: { dims: ['radius', 'height'], calc: ([r, h]) => `volume ${round(Math.PI * r * r * h, 3)}, surface area ${round(2 * Math.PI * r * (r + h), 3)}` },
  cone: { dims: ['radius', 'height'], calc: ([r, h]) => `volume ${round((Math.PI * r * r * h) / 3, 3)}, surface area ${round(Math.PI * r * (r + Math.hypot(r, h)), 3)}` },
  cube: { dims: ['side'], calc: ([s]) => `volume ${round(s ** 3, 3)}, surface area ${round(6 * s * s, 3)}` },
  box: { dims: ['length', 'width', 'height'], calc: ([l, w, h]) => `volume ${round(l * w * h, 3)}, surface area ${round(2 * (l * w + l * h + w * h), 3)}` },
}

export const mathMoreTools: Tool[] = [
  {
    name: 'statistics',
    category: 'Statistics & math',
    description: 'Descriptive statistics for a list of numbers: count, sum, mean, median, mode, range, standard deviation, quartiles and outliers.',
    keywords: 'statistics stats mean average median mode standard deviation variance quartile percentile range outlier spread numbers data set summary',
    parameters: { numbers: { type: 'string', description: 'Numbers separated by commas or spaces' } },
    run: ({ numbers }) => {
      const x = nums(numbers)
      if (x.length < 1 || !ok(...x)) return 'Provide a list of numbers.'
      const s = [...x].sort((a, b) => a - b)
      const n = x.length
      const sum = x.reduce((a, b) => a + b, 0)
      const mean = sum / n
      const ss = x.reduce((a, b) => a + (b - mean) ** 2, 0)
      const counts = new Map<number, number>()
      for (const v of x) counts.set(v, (counts.get(v) ?? 0) + 1)
      const top = Math.max(...counts.values())
      const modes = top > 1 ? [...counts].filter(([, c]) => c === top).map(([v]) => v) : []
      const q1 = quantile(s, 0.25)
      const q3 = quantile(s, 0.75)
      const iqr = q3 - q1
      const outliers = x.filter((v) => v < q1 - 1.5 * iqr || v > q3 + 1.5 * iqr)
      return [
        `n ${n}, sum ${round(sum, 4)}, mean ${round(mean, 4)}, median ${round(quantile(s, 0.5), 4)}, mode ${modes.length ? modes.join(', ') : 'none'}`,
        `min ${s[0]}, max ${s[n - 1]}, range ${round(s[n - 1] - s[0], 4)}`,
        `std dev: sample ${n > 1 ? round(Math.sqrt(ss / (n - 1)), 4) : 'n/a'}, population ${round(Math.sqrt(ss / n), 4)}`,
        `quartiles: Q1 ${round(q1, 4)}, Q3 ${round(q3, 4)}, IQR ${round(iqr, 4)}; outliers: ${outliers.length ? outliers.join(', ') : 'none'}`,
      ].join('\n')
    },
  },
  {
    name: 'linear_regression',
    category: 'Statistics & math',
    description: 'Fit a straight line to paired x and y numbers: slope, intercept, correlation r, R squared, and an optional prediction.',
    keywords: 'linear regression correlation trend line fit slope intercept relationship predict forecast scatter least squares pearson r squared',
    parameters: {
      x: { type: 'string', description: 'x values, comma separated' },
      y: { type: 'string', description: 'y values, comma separated (same count as x)' },
      predict_x: { type: 'string', description: 'Predict y for this x value', optional: true },
    },
    run: ({ x, y, predict_x }) => {
      const a = nums(x)
      const b = nums(y)
      if (a.length < 2 || a.length !== b.length || !ok(...a, ...b)) return 'Provide two lists of numbers of the same length (at least 2).'
      const n = a.length
      const mx = a.reduce((p, c) => p + c, 0) / n
      const my = b.reduce((p, c) => p + c, 0) / n
      const sxy = a.reduce((p, c, i) => p + (c - mx) * (b[i] - my), 0)
      const sxx = a.reduce((p, c) => p + (c - mx) ** 2, 0)
      const syy = b.reduce((p, c) => p + (c - my) ** 2, 0)
      if (sxx === 0) return 'All x values are the same, so no line can be fitted.'
      const slope = sxy / sxx
      const intercept = my - slope * mx
      const r = syy === 0 ? 0 : sxy / Math.sqrt(sxx * syy)
      const p = num(predict_x)
      return `y = ${round(slope, 4)} x + ${round(intercept, 4)}; correlation r ${round(r, 4)}, R² ${round(r * r, 4)} (${Math.abs(r) > 0.7 ? 'strong' : Math.abs(r) > 0.4 ? 'moderate' : 'weak'} ${r >= 0 ? 'positive' : 'negative'} relationship).${Number.isFinite(p) ? ` Prediction at x=${p}: ${round(slope * p + intercept, 4)}.` : ''} Correlation does not prove cause.`
    },
  },
  {
    name: 'base_convert',
    category: 'Statistics & math',
    description: 'Convert a number between bases 2-36 (binary, octal, decimal, hexadecimal, ...).',
    keywords: 'base convert binary hexadecimal octal decimal hex bin number system radix conversion bits',
    parameters: {
      value: { type: 'string', description: 'The number, e.g. 255 or FF or 11111111' },
      from_base: { type: 'string', description: 'Base of the input (default 10)', optional: true },
      to_base: { type: 'string', description: 'Base of the output (default 2)', optional: true },
    },
    run: ({ value = '', from_base, to_base }) => {
      const from = Number.isFinite(num(from_base)) ? Math.round(num(from_base)) : 10
      const to = Number.isFinite(num(to_base)) ? Math.round(num(to_base)) : 2
      if (from < 2 || from > 36 || to < 2 || to > 36) return 'Bases must be between 2 and 36.'
      const digits = '0123456789abcdefghijklmnopqrstuvwxyz'
      let n = 0n
      for (const ch of value.trim().toLowerCase().replace(/^0[xbo]/, '')) {
        const d = digits.indexOf(ch)
        if (d < 0 || d >= from) return `"${ch}" is not a valid digit in base ${from}.`
        n = n * BigInt(from) + BigInt(d)
      }
      return `${value} (base ${from}) = ${n.toString(to).toUpperCase()} (base ${to}); decimal ${n.toString(10)}.`
    },
  },
  {
    name: 'gcd_lcm',
    category: 'Statistics & math',
    description: 'Greatest common divisor and least common multiple of two or more whole numbers.',
    keywords: 'gcd lcm greatest common divisor least common multiple factor hcf divisible whole numbers',
    parameters: { numbers: { type: 'string', description: 'Whole numbers separated by commas' } },
    run: ({ numbers }) => {
      const x = nums(numbers)
      if (x.length < 2 || x.some((v) => !Number.isInteger(v) || v <= 0)) return 'Provide two or more positive whole numbers.'
      const g = x.reduce(gcd)
      const l = x.reduce((a, b) => (a / gcd(a, b)) * b)
      return `GCD ${g}, LCM ${l}.`
    },
  },
  {
    name: 'prime_factors',
    category: 'Statistics & math',
    description: 'Check whether a whole number is prime and list its prime factors.',
    keywords: 'prime number factors factorization factor divisors is prime composite',
    parameters: { n: { type: 'string', description: 'A whole number from 2 to 1,000,000,000,000' } },
    run: ({ n }) => {
      let v = num(n)
      if (!Number.isInteger(v) || v < 2 || v > 1e12) return 'Provide a whole number between 2 and 1,000,000,000,000.'
      const original = v
      const f: number[] = []
      for (let p = 2; p * p <= v; p += p === 2 ? 1 : 2) {
        while (v % p === 0) {
          f.push(p)
          v /= p
        }
      }
      if (v > 1) f.push(v)
      const grouped = [...new Set(f)].map((p) => `${p}${f.filter((x) => x === p).length > 1 ? `^${f.filter((x) => x === p).length}` : ''}`)
      return f.length === 1 ? `${original} is prime.` : `${original} = ${grouped.join(' x ')}.`
    },
  },
  {
    name: 'quadratic_solver',
    category: 'Statistics & math',
    description: 'Solve a quadratic equation a x² + b x + c = 0 (real or complex roots).',
    keywords: 'quadratic equation solve roots discriminant algebra parabola ax2 bx c zero',
    parameters: {
      a: { type: 'string', description: 'Coefficient of x squared' },
      b: { type: 'string', description: 'Coefficient of x' },
      c: { type: 'string', description: 'Constant term' },
    },
    run: ({ a, b, c }) => {
      const [A, B, C] = [a, b, c].map(num)
      if (!ok(A, B, C)) return 'Provide numbers for a, b and c.'
      if (A === 0) return B === 0 ? 'Not an equation in x.' : `Linear: x = ${round(-C / B, 6)}.`
      const d = B * B - 4 * A * C
      if (d > 0) return `Two real roots: x = ${round((-B + Math.sqrt(d)) / (2 * A), 6)} and x = ${round((-B - Math.sqrt(d)) / (2 * A), 6)} (discriminant ${round(d, 4)}).`
      if (d === 0) return `One repeated root: x = ${round(-B / (2 * A), 6)}.`
      return `Complex roots: x = ${round(-B / (2 * A), 6)} ± ${round(Math.sqrt(-d) / (2 * A), 6)}i (discriminant ${round(d, 4)}).`
    },
  },
  {
    name: 'geometry',
    category: 'Statistics & math',
    description: `Area, perimeter, volume or surface area of a shape. Shapes: ${Object.keys(SHAPES).join(', ')}.`,
    keywords: 'geometry area perimeter volume surface circle rectangle triangle sphere cylinder cone cube box shape formula measure',
    parameters: {
      shape: { type: 'string', description: `One of: ${Object.keys(SHAPES).join(', ')}` },
      dimensions: { type: 'string', description: 'Numbers in order, e.g. circle: radius; rectangle: width, height; cylinder: radius, height' },
    },
    run: ({ shape = '', dimensions }) => {
      const s = SHAPES[shape.trim().toLowerCase()]
      if (!s) return `Unknown shape. Choose from: ${Object.keys(SHAPES).join(', ')}.`
      const d = nums(dimensions)
      if (d.length < s.dims.length || !ok(...d) || d.some((v) => v < 0)) return `${shape} needs: ${s.dims.join(', ')}.`
      return `${shape} (${s.dims.map((n, i) => `${n} ${d[i]}`).join(', ')}): ${s.calc(d)}.`
    },
  },
  {
    name: 'combinatorics',
    category: 'Statistics & math',
    description: 'Factorial, permutations (nPr) and combinations (nCr).',
    keywords: 'combinations permutations factorial choose nCr nPr counting arrangements probability ways to pick lottery',
    parameters: {
      n: { type: 'string', description: 'Total items' },
      r: { type: 'string', description: 'Items chosen (omit for factorial only)', optional: true },
    },
    run: ({ n, r }) => {
      const N = num(n)
      const R = num(r)
      if (!Number.isInteger(N) || N < 0 || N > 500) return 'n must be a whole number from 0 to 500.'
      const fact = (k: number) => {
        let f = 1n
        for (let i = 2n; i <= BigInt(k); i++) f *= i
        return f
      }
      if (!Number.isFinite(R)) return `${N}! = ${fact(N).toString().length > 40 ? `${fact(N).toString().slice(0, 12)}... (${fact(N).toString().length} digits)` : fact(N).toString()}.`
      if (!Number.isInteger(R) || R < 0 || R > N) return 'r must be a whole number from 0 to n.'
      const nPr = fact(N) / fact(N - R)
      const nCr = nPr / fact(R)
      return `P(${N},${R}) = ${nPr.toLocaleString('en-US')} ordered arrangements; C(${N},${R}) = ${nCr.toLocaleString('en-US')} combinations.`
    },
  },
  {
    name: 'roman_numeral',
    category: 'Statistics & math',
    description: 'Convert between Roman numerals and numbers (1-3999).',
    keywords: 'roman numeral convert xiv mcm numbers latin numerals',
    parameters: { value: { type: 'string', description: 'A number like 1994, or a numeral like MCMXCIV' } },
    run: ({ value = '' }) => {
      const v = value.trim().toUpperCase()
      if (/^\d+$/.test(v)) {
        let n = Number(v)
        if (n < 1 || n > 3999) return 'Roman numerals cover 1 to 3999.'
        let out = ''
        for (const [k, s] of ROMAN) {
          while (n >= k) {
            out += s
            n -= k
          }
        }
        return `${v} = ${out}`
      }
      if (!/^[MDCLXVI]+$/.test(v)) return 'Give a number or a Roman numeral (letters I V X L C D M).'
      let total = 0
      for (let i = 0; i < v.length; i++) {
        const cur = ROMAN.find(([, s]) => s === v[i])![0]
        const next = ROMAN.find(([, s]) => s === v[i + 1])?.[0] ?? 0
        total += cur < next ? -cur : cur
      }
      return `${v} = ${total}`
    },
  },
  {
    name: 'number_to_words',
    category: 'Statistics & math',
    description: 'Write a whole number in English words, for example for cheques and contracts.',
    keywords: 'number to words spell out written amount cheque check words english numeral text form',
    parameters: { number: { type: 'string', description: 'A whole number up to 999 trillion' } },
    run: ({ number }) => {
      const n = num(number)
      if (!Number.isInteger(n) || Math.abs(n) > 999_999_999_999_999) return 'Provide a whole number below one quadrillion.'
      return `${n < 0 ? 'minus ' : ''}${toWords(Math.abs(n))}`
    },
  },
  {
    name: 'fraction_simplify',
    category: 'Statistics & math',
    description: 'Simplify a fraction like 12/18, or turn a decimal like 0.375 into a fraction, with decimal and percent forms.',
    keywords: 'fraction simplify reduce decimal to fraction numerator denominator lowest terms percent ratio',
    parameters: { value: { type: 'string', description: 'A fraction like 12/18 or a decimal like 0.375' } },
    run: ({ value = '' }) => {
      const f = /^\s*(-?\d+)\s*\/\s*(\d+)\s*$/.exec(value)
      let nume: number
      let den: number
      if (f) {
        nume = Number(f[1])
        den = Number(f[2])
        if (den === 0) return 'The denominator cannot be zero.'
      } else {
        const d = num(value)
        if (!ok(d)) return 'Give a fraction like 12/18 or a decimal like 0.375.'
        den = 1
        while (Math.abs(d * den - Math.round(d * den)) > 1e-9 && den < 1e6) den *= 10
        nume = Math.round(d * den)
      }
      const g = gcd(nume, den) || 1
      const [sn, sd] = [nume / g, den / g]
      return `${sn}/${sd} (= ${round(sn / sd, 6)} = ${round((sn / sd) * 100, 4)}%)${g > 1 ? `, simplified by ${g}` : ', already in lowest terms'}.`
    },
  },
]
