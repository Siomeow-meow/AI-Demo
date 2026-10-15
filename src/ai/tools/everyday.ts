import type { Tool } from '../tool-types'
import { money, num, ok, round, rows } from './helpers'

const ACTIVITY: Record<string, number> = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, very_active: 1.9 }

/** "1:45:30", "45:30" (mm:ss) or "45" (minutes) to seconds. */
function parseDuration(s: string | undefined): number {
  const parts = (s ?? '').trim().split(':').map(Number)
  if (!parts.length || parts.some((p) => !Number.isFinite(p))) return NaN
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
  if (parts.length === 2) return parts[0] * 60 + parts[1]
  return parts[0] * 60
}

const fmtDuration = (sec: number) => {
  const s = Math.round(sec)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return `${h ? `${h}:${String(m).padStart(2, '0')}` : m}:${String(s % 60).padStart(2, '0')}`
}

/** Read "1 1/2", "3/4" or "2.5" at the start of a line; returns the number and the rest of the text. */
function leadingQuantity(line: string): { qty: number; rest: string } | null {
  const m = /^\s*(\d+\s+\d+\/\d+|\d+\/\d+|\d*\.?\d+)\s*(.*)$/.exec(line)
  if (!m) return null
  const q = m[1].trim()
  const mixed = /^(\d+)\s+(\d+)\/(\d+)$/.exec(q)
  const frac = /^(\d+)\/(\d+)$/.exec(q)
  const qty = mixed ? Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]) : frac ? Number(frac[1]) / Number(frac[2]) : Number(q)
  return { qty, rest: m[2] }
}

export const everydayTools: Tool[] = [
  {
    name: 'bmi_calc',
    category: 'Everyday life',
    description: 'Body mass index (BMI), its WHO category and the weight range for a healthy BMI at that height. General information, not medical advice.',
    keywords: 'bmi body mass index weight height healthy weight overweight underweight health fitness calculator kg cm',
    parameters: {
      weight_kg: { type: 'string', description: 'Weight in kilograms' },
      height_cm: { type: 'string', description: 'Height in centimetres' },
    },
    run: ({ weight_kg, height_cm }) => {
      const w = num(weight_kg)
      const h = num(height_cm) / 100
      if (!ok(w, h) || w <= 0 || h <= 0.5) return 'Provide weight in kg and height in cm.'
      const bmi = w / (h * h)
      const cat = bmi < 18.5 ? 'underweight' : bmi < 25 ? 'normal weight' : bmi < 30 ? 'overweight' : 'obese range'
      return `BMI ${round(bmi, 1)} (${cat}). Healthy range (BMI 18.5-24.9) for ${round(h * 100, 0)} cm: ${round(18.5 * h * h, 1)}-${round(24.9 * h * h, 1)} kg. BMI is a rough screening number; talk to a health professional for advice.`
    },
  },
  {
    name: 'calorie_needs',
    category: 'Everyday life',
    description: 'Estimate daily calories: basal metabolic rate (Mifflin-St Jeor) and total daily energy expenditure from activity level.',
    keywords: 'calories bmr tdee daily energy metabolism diet weight loss gain nutrition maintenance calorie needs mifflin',
    parameters: {
      sex: { type: 'string', description: 'male or female' },
      age: { type: 'string', description: 'Age in years' },
      weight_kg: { type: 'string', description: 'Weight in kg' },
      height_cm: { type: 'string', description: 'Height in cm' },
      activity: { type: 'string', description: 'sedentary, light, moderate, active or very_active (default light)', optional: true },
    },
    run: ({ sex = '', age, weight_kg, height_cm, activity = 'light' }) => {
      const [a, w, h] = [age, weight_kg, height_cm].map(num)
      if (!ok(a, w, h)) return 'Provide age, weight in kg and height in cm.'
      const bmr = 10 * w + 6.25 * h - 5 * a + (/^m/i.test(sex) ? 5 : -161)
      const factor = ACTIVITY[activity.toLowerCase().replace(/[\s-]/g, '_')] ?? 1.375
      const tdee = bmr * factor
      return `BMR ${round(bmr, 0)} kcal/day; with ${activity} activity (x${factor}) about ${round(tdee, 0)} kcal/day to maintain weight. A moderate deficit is roughly ${round(tdee - 500, 0)} kcal, a surplus ${round(tdee + 500, 0)} kcal. Estimates only; individual needs vary.`
    },
  },
  {
    name: 'pace_calc',
    category: 'Everyday life',
    description: 'Running or cycling pace, speed, time and distance: give any two of distance, time and pace to get the rest.',
    keywords: 'pace running speed marathon 5k 10k time distance cycling split per km jogging race finish time training',
    parameters: {
      distance_km: { type: 'string', description: 'Distance in kilometres', optional: true },
      time: { type: 'string', description: 'Total time as h:mm:ss, mm:ss or minutes', optional: true },
      pace_per_km: { type: 'string', description: 'Pace as mm:ss per km', optional: true },
    },
    run: ({ distance_km, time, pace_per_km }) => {
      let d = num(distance_km)
      let t = parseDuration(time)
      let p = parseDuration(pace_per_km)
      if (ok(d, t)) p = t / d
      else if (ok(d, p)) t = d * p
      else if (ok(t, p)) d = t / p
      else return 'Give any two of: distance_km, time, pace_per_km.'
      if (d <= 0 || t <= 0) return 'Distance and time must be positive.'
      const race = (km: number, name: string) => `${name} ${fmtDuration(p * km)}`
      return `Distance ${round(d, 2)} km in ${fmtDuration(t)}: pace ${fmtDuration(p)} per km, speed ${round(3600 / p, 2)} km/h. At this pace: ${[race(5, '5K'), race(10, '10K'), race(21.0975, 'half marathon'), race(42.195, 'marathon')].join(', ')}.`
    },
  },
  {
    name: 'recipe_scale',
    category: 'Everyday life',
    description: 'Scale a recipe or any list of quantities up or down for a different number of servings.',
    keywords: 'recipe scale servings ingredients cooking baking double halve portions adjust quantities cups grams meal',
    parameters: {
      ingredients: { type: 'string', description: 'Lines like "2 cups flour; 1 1/2 tsp salt; 250 g sugar"' },
      from_servings: { type: 'string', description: 'Servings the recipe makes' },
      to_servings: { type: 'string', description: 'Servings you want' },
    },
    run: ({ ingredients, from_servings, to_servings }) => {
      const from = num(from_servings)
      const to = num(to_servings)
      if (!ok(from, to) || from <= 0 || to <= 0) return 'Provide from_servings and to_servings.'
      const factor = to / from
      const out = rows(ingredients).map((l) => {
        const q = leadingQuantity(l)
        return q ? `${round(q.qty * factor, 2)} ${q.rest}` : `${l} (no quantity found)`
      })
      return `x${round(factor, 3)} (${from} to ${to} servings):\n${out.join('\n')}`
    },
  },
  {
    name: 'fuel_trip_cost',
    category: 'Everyday life',
    description: 'Fuel needed and cost of a trip, optionally split between passengers.',
    keywords: 'fuel gas petrol trip cost travel drive distance km per liter mileage road trip commute gasoline split passengers',
    parameters: {
      distance_km: { type: 'string', description: 'One-way distance in km' },
      km_per_liter: { type: 'string', description: 'Fuel efficiency in km per liter' },
      price_per_liter: { type: 'string', description: 'Fuel price per liter' },
      round_trip: { type: 'string', description: '"yes" to double the distance', optional: true },
      passengers: { type: 'string', description: 'People sharing the cost', optional: true },
    },
    run: ({ distance_km, km_per_liter, price_per_liter, round_trip, passengers }) => {
      let d = num(distance_km)
      const eff = num(km_per_liter)
      const price = num(price_per_liter)
      if (!ok(d, eff, price) || eff <= 0) return 'Provide distance, km per liter and price per liter.'
      if (/^(y|true)/i.test(round_trip ?? '')) d *= 2
      const liters = d / eff
      const n = Number.isFinite(num(passengers)) ? Math.max(1, Math.round(num(passengers))) : 1
      return `${round(d, 1)} km needs ${round(liters, 2)} L, costing ${money(liters * price)}${n > 1 ? ` (${money((liters * price) / n)} each for ${n} people)` : ''}.`
    },
  },
  {
    name: 'electricity_cost',
    category: 'Everyday life',
    description: 'Running cost of an appliance: energy in kWh and cost per day, month and year.',
    keywords: 'electricity cost power bill appliance watts kwh energy aircon refrigerator computer consumption rate electric usage',
    parameters: {
      watts: { type: 'string', description: 'Appliance power in watts' },
      hours_per_day: { type: 'string', description: 'Hours used per day' },
      rate_per_kwh: { type: 'string', description: 'Electricity price per kWh' },
    },
    run: ({ watts, hours_per_day, rate_per_kwh }) => {
      const [w, h, r] = [watts, hours_per_day, rate_per_kwh].map(num)
      if (!ok(w, h, r)) return 'Provide watts, hours per day and the rate per kWh.'
      const kwh = (w / 1000) * h
      return `${round(kwh, 2)} kWh per day. Cost: ${money(kwh * r)} per day, ${money(kwh * r * 30)} per month, ${money(kwh * r * 365)} per year.`
    },
  },
  {
    name: 'unit_price_compare',
    category: 'Everyday life',
    description: 'Compare products by price per unit to find the best value.',
    keywords: 'compare price per unit best value cheaper shopping groceries bulk deal cost per gram per liter which is cheaper',
    parameters: { items: { type: 'string', description: 'Lines of name:price:quantity, e.g. "Small:45:250; Large:80:500"' } },
    run: ({ items }) => {
      const list = rows(items).map((l) => l.split(':').map((x) => x.trim()))
      if (list.length < 2 || list.some((l) => l.length !== 3 || !ok(num(l[1]), num(l[2])) || num(l[2]) <= 0)) {
        return 'Write at least two items as name:price:quantity, separated by ;.'
      }
      const priced = list.map(([name, p, q]) => ({ name, unit: num(p) / num(q) })).sort((a, b) => a.unit - b.unit)
      const worst = priced[priced.length - 1]
      return `${priced.map((x, i) => `${i + 1}. ${x.name}: ${round(x.unit, 4)} per unit`).join('\n')}\nBest value: ${priced[0].name}, ${round((1 - priced[0].unit / worst.unit) * 100, 1)}% cheaper per unit than ${worst.name}.`
    },
  },
]
