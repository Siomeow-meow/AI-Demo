import { tokenize } from './rag'
import type { Tool } from './tool-types'

/**
 * Tool router. Sending every tool to a small model wastes context (and RAM) and
 * makes it pick worse. Instead we score each tool against the question with a
 * cheap IDF-weighted keyword match and offer only the best few.
 */
export function selectTools(tools: Tool[], question: string, k = 3, always: string[] = ['search_knowledge_base']): Tool[] {
  const docs = tools.map((t) => new Set(tokenize(`${t.name.replace(/_/g, ' ')} ${t.description} ${t.keywords} ${t.dynamicKeywords?.() ?? ''}`)))
  const df = new Map<string, number>()
  for (const d of docs) for (const w of d) df.set(w, (df.get(w) ?? 0) + 1)

  const q = new Set(tokenize(question))
  const scored = tools
    .map((tool, i) => {
      let score = 0
      for (const w of q) if (docs[i].has(w)) score += Math.log(1 + tools.length / (df.get(w) ?? 1))
      return { tool, score }
    })
    .filter((x) => x.score > 0 && !always.includes(x.tool.name))
    .sort((a, b) => b.score - a.score)

  // Drop weak matches (less than 60% of the best score) so unrelated tools do not add noise.
  const best = scored[0]?.score ?? 0
  const picked = scored.filter((x) => x.score >= best * 0.6).slice(0, k).map((x) => x.tool)

  const triggered = tools.filter((t) => t.trigger?.test(question) && !picked.includes(t) && !always.includes(t.name))
  // The always-on tool goes last: small models tend to favour the first tool they are offered.
  return [...triggered, ...picked, ...tools.filter((t) => always.includes(t.name))]
}
