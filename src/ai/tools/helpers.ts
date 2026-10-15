/** Parse a number the way people type it: "1,200", "₱500", "12%". Returns NaN if it is not a number. */
export const num = (s: string | undefined): number => (s?.trim() ? Number(s.replace(/[,₱$%\s]/g, '')) : NaN)

export const money = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export const round = (n: number, digits = 2) => +n.toFixed(digits)

/** True when every value is a real, finite number. */
export const ok = (...n: number[]) => n.every(Number.isFinite)

/** Split a pasted list on semicolons or new lines. */
export const rows = (s: string | undefined) =>
  (s ?? '')
    .split(/[;\n]+/)
    .map((x) => x.trim())
    .filter(Boolean)

/** Inverse of the standard normal distribution (Abramowitz-Stegun 26.2.23, accurate to about 0.0005). */
export function zScore(p: number): number {
  if (p <= 0 || p >= 1) return NaN
  const upper = p > 0.5
  const q = upper ? 1 - p : p
  const t = Math.sqrt(-2 * Math.log(q))
  const z = t - (2.515517 + 0.802853 * t + 0.010328 * t * t) / (1 + 1.432788 * t + 0.189269 * t * t + 0.001308 * t ** 3)
  return upper ? z : -z
}
