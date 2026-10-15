import type { Tool } from '../tool-types'

// Free public APIs that need no key and allow browser requests. They are optional
// (the "Internet tools" switch) because the text of the question is sent to them.

export async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return (await res.json()) as T
}

const WEATHER_CODES: Record<number, string> = {
  0: 'clear sky', 1: 'mainly clear', 2: 'partly cloudy', 3: 'overcast', 45: 'fog', 48: 'fog',
  51: 'light drizzle', 53: 'drizzle', 55: 'heavy drizzle', 61: 'light rain', 63: 'rain', 65: 'heavy rain',
  71: 'light snow', 73: 'snow', 75: 'heavy snow', 80: 'rain showers', 81: 'rain showers', 82: 'violent rain showers',
  95: 'thunderstorm', 96: 'thunderstorm with hail', 99: 'thunderstorm with hail',
}

export const webTools: Tool[] = [
  {
    name: 'wikipedia',
    category: 'Internet',
    network: true,
    description: 'Look up a short factual summary of a person, place, company, concept or event on Wikipedia.',
    keywords: 'wikipedia who what is define definition explain history facts encyclopedia meaning capital',
    parameters: { topic: { type: 'string', description: 'Topic name, e.g. "Enterprise resource planning"' } },
    learn: (_args, result) => {
      const lines = result.split('\n')
      const source = lines[lines.length - 1]?.replace(/^Source: /, '')
      if (lines.length < 3 || !source?.startsWith('http')) return null
      return { title: lines[0], text: lines.slice(1, -1).join('\n'), source }
    },
    run: async ({ topic }) => {
      try {
        const found = await getJson<[string, string[]]>(
          `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(topic)}&limit=1&format=json&origin=*`,
        )
        const title = found[1][0]
        if (!title) return `No Wikipedia article found for "${topic}".`
        const s = await getJson<{ title: string; extract: string; content_urls?: { desktop?: { page?: string } } }>(
          `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`,
        )
        return `${s.title}\n${s.extract.slice(0, 900)}\nSource: ${s.content_urls?.desktop?.page ?? 'https://wikipedia.org'}`
      } catch (e) {
        return `Wikipedia lookup failed: ${(e as Error).message}`
      }
    },
  },
  {
    name: 'weather',
    category: 'Internet',
    network: true,
    description: 'Get the current weather and the high/low for today in a city.',
    keywords: 'weather temperature forecast rain sunny hot cold humidity wind climate today',
    parameters: { city: { type: 'string', description: 'City name, e.g. Manila' } },
    run: async ({ city }) => {
      try {
        const geo = await getJson<{ results?: { name: string; country: string; latitude: number; longitude: number }[] }>(
          `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1`,
        )
        const place = geo.results?.[0]
        if (!place) return `Could not find a city named "${city}".`
        const w = await getJson<{
          current: { temperature_2m: number; relative_humidity_2m: number; wind_speed_10m: number; weather_code: number }
          daily: { temperature_2m_max: number[]; temperature_2m_min: number[] }
        }>(
          `https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}` +
            `&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code` +
            `&daily=temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=1`,
        )
        const c = w.current
        return `${place.name}, ${place.country}: ${c.temperature_2m}°C, ${WEATHER_CODES[c.weather_code] ?? 'unknown conditions'}, humidity ${c.relative_humidity_2m}%, wind ${c.wind_speed_10m} km/h. Today: high ${w.daily.temperature_2m_max[0]}°C, low ${w.daily.temperature_2m_min[0]}°C.`
      } catch (e) {
        return `Weather lookup failed: ${(e as Error).message}`
      }
    },
  },
  {
    name: 'currency_convert',
    category: 'Internet',
    network: true,
    description: 'Convert an amount between currencies using the latest exchange rates (ECB data).',
    keywords: 'currency exchange rate convert usd php eur dollars pesos euro yen money forex',
    parameters: {
      amount: { type: 'string', description: 'Amount to convert' },
      from: { type: 'string', description: '3-letter currency code, e.g. USD' },
      to: { type: 'string', description: '3-letter currency code, e.g. PHP' },
    },
    run: async ({ amount, from, to }) => {
      const n = Number(amount)
      if (!Number.isFinite(n)) return `Not a number: ${amount}`
      try {
        const r = await getJson<{ date: string; rates: Record<string, number> }>(
          `https://api.frankfurter.dev/v1/latest?base=${encodeURIComponent(from.toUpperCase())}&symbols=${encodeURIComponent(to.toUpperCase())}`,
        )
        const rate = r.rates[to.toUpperCase()]
        if (rate === undefined) return `No rate available for ${from} to ${to}.`
        return `${n} ${from.toUpperCase()} = ${(n * rate).toFixed(2)} ${to.toUpperCase()} (rate ${rate}, ${r.date}).`
      } catch (e) {
        return `Exchange rate lookup failed: ${(e as Error).message}`
      }
    },
  },
]
