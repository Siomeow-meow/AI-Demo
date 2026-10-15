import { Ollama } from 'ollama/browser'
import type { Semantic } from './rag'
import type { Chunk } from './rag'

export const ollama = new Ollama({ host: 'http://127.0.0.1:11434' })

// Optional small embedding model (~270 MB) for semantic search. Install with: ollama pull nomic-embed-text
export const EMBED_MODEL: string = import.meta.env.VITE_EMBED_MODEL ?? 'nomic-embed-text'

/** Resolves true if the embedding model is available in Ollama. */
export async function checkEmbedModel(): Promise<boolean> {
  try {
    const { models } = await ollama.list()
    return models.some((m) => m.name === EMBED_MODEL || m.name.startsWith(`${EMBED_MODEL}:`))
  } catch {
    return false
  }
}

async function embed(texts: string[]): Promise<number[][]> {
  const res = await ollama.embed({ model: EMBED_MODEL, input: texts, keep_alive: '1m' })
  return res.embeddings
}

// Vectors are cached per chunk text so re-indexing after an upload only embeds new chunks.
const cache = new Map<string, number[]>()

/** Embed every chunk (in small batches, to keep memory low) and return a semantic index. */
export async function buildSemantic(chunks: Chunk[]): Promise<Semantic> {
  const key = (c: Chunk) => `${EMBED_MODEL}|${c.title}|${c.text}`
  const missing = chunks.filter((c) => !cache.has(key(c)))
  for (let i = 0; i < missing.length; i += 16) {
    const batch = missing.slice(i, i + 16)
    const vectors = await embed(batch.map((c) => `search_document: ${c.title}\n${c.text}`))
    batch.forEach((c, j) => cache.set(key(c), vectors[j]))
  }
  const vectors = new Map(chunks.map((c) => [c.id, cache.get(key(c))!] as const))
  return { vectors, embedQuery: async (q) => (await embed([`search_query: ${q}`]))[0] }
}
