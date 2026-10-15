import { retrieveHybrid } from '../rag'
import type { Hit } from '../rag'
import type { Tool, ToolContext } from '../tool-types'
import { searchAllData } from './fuzzy'

/** Models sometimes pass the text "null" for an optional argument. */
const clean = (v: string | undefined) => (v && !/^(null|undefined|none|all|n\/a)$/i.test(v.trim()) ? v : undefined)

/**
 * Search the documents, forgiving of small-model mistakes: the two arguments may be swapped or one
 * left empty, and a document filter that matches nothing is dropped. Used by the tool and by the
 * source list shown under answers, so both always agree.
 */
export async function smartRetrieve(
  ctx: Pick<ToolContext, 'index' | 'semantic'>,
  query: string | undefined,
  document: string | undefined,
): Promise<{ hits: Hit[]; q: string }> {
  const q = query?.trim() ? query : (document ?? '')
  const doc = clean(document)
  let hits = await retrieveHybrid(ctx.index, q, { semantic: ctx.semantic, document: doc })
  if (!hits.length && doc) hits = await retrieveHybrid(ctx.index, q, { semantic: ctx.semantic })
  return { hits, q }
}

export function knowledgeTools({ index, docs, semantic }: ToolContext): Tool[] {
  return [
    {
      name: 'search_knowledge_base',
      category: 'Knowledge',
      description:
        'Search written company documents (policies, IT support, onboarding, ERP, AI notes, uploaded and learned files). Not for people, products, numbers or data tables - use the data tools for those.',
      keywords: 'document policy knowledge search find according procedure handbook faq guide what is how do',
      parameters: {
        query: { type: 'string', description: 'What to look up, in a few keywords' },
        document: { type: 'string', description: 'Only search the document with this id or title', optional: true },
      },
      match: (query) => ({ query }),
      run: async ({ query, document }) => {
        const { hits, q } = await smartRetrieve({ index, semantic }, query, document)
        if (!hits.length) {
          // Small models often reach for this tool first, so also look through the company data before giving up.
          const rows = searchAllData(q)
          return rows.length
            ? `No passages in the documents, but found in company data:\n${rows.join('\n')}`
            : 'No relevant passages or records found.'
        }
        return hits.map((h) => `[${h.chunk.id}] ${h.chunk.text}`).join('\n---\n')
      },
    },
    {
      name: 'read_document',
      category: 'Knowledge',
      description: 'Read one whole document by its id or title. Leave empty to list all available documents.',
      keywords: 'read open show full document file list documents available what documents',
      parameters: { id: { type: 'string', description: 'Document id or title; empty to list documents', optional: true } },
      run: ({ id = '' }) => {
        const q = id.trim().toLowerCase()
        if (!q) return docs.map((d) => `${d.id}: ${d.title}`).join('\n')
        const doc =
          docs.find((d) => d.id.toLowerCase() === q || d.title.toLowerCase() === q) ??
          docs.find((d) => d.title.toLowerCase().includes(q) || d.id.toLowerCase().includes(q))
        return doc ? `# ${doc.title}\n\n${doc.text.slice(0, 5000)}` : `No document matches "${id}".`
      },
    },
    {
      name: 'summarize_document',
      category: 'Knowledge',
      description: 'Get the key lines of a document (its first sentences and headings) for a quick overview.',
      keywords: 'summarize summary overview outline gist tldr brief document key points',
      parameters: { id: { type: 'string', description: 'Document id or title' } },
      run: ({ id = '' }) => {
        const q = id.trim().toLowerCase()
        const doc = docs.find((d) => d.id.toLowerCase() === q || d.title.toLowerCase().includes(q))
        if (!doc) return `No document matches "${id}".`
        const firsts = doc.text
          .split(/\n\s*\n/)
          .map((p) => p.trim().match(/[^.!?]+[.!?]/)?.[0]?.trim())
          .filter(Boolean)
        return `${doc.title}\n- ${firsts.join('\n- ')}`
      },
    },
  ]
}
