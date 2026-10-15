export interface SourceDoc {
  id: string
  title: string
  text: string
  /** Set for documents the assistant learned from the web. */
  source?: string
  savedAt?: string
}

// Every Markdown file in src/docs is loaded as raw text and indexed for RAG.
const files = import.meta.glob('../docs/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

export const sampleDocs: SourceDoc[] = Object.entries(files).map(([path, raw]) => {
  const id = path.split('/').pop()!.replace(/\.md$/, '')
  const heading = /^#\s+(.+)$/m.exec(raw)
  return {
    id,
    title: heading?.[1].trim() ?? id,
    text: raw.replace(/^#\s+.+\r?\n/, '').trim(),
  }
})
