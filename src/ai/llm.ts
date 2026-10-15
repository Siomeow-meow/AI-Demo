import type { Message, ToolCall as OllamaToolCall } from 'ollama/browser'
import { ollama } from './ollama'
import { retrieveHybrid, toSources } from './rag'
import type { Source } from './rag'
import { selectTools } from './router'
import { createTools } from './tools'
import type { ToolCall, ToolContext } from './tools'
import type { AgentReply } from './agent'

// Override with VITE_OLLAMA_MODEL in .env.local, e.g. VITE_OLLAMA_MODEL=qwen2.5:3b
export const MODEL: string = import.meta.env.VITE_OLLAMA_MODEL ?? 'qwen2.5:3b'

export interface ChatMsg {
  role: 'user' | 'assistant'
  content: string
}

/** Resolves null if the Ollama server is reachable and the model is pulled, else a problem description. */
export async function checkModel(): Promise<string | null> {
  try {
    const { models } = await ollama.list()
    return models.some((m) => m.name === MODEL) ? null : `Model not found. Run: ollama pull ${MODEL}`
  } catch {
    return 'Ollama is not running at http://127.0.0.1:11434'
  }
}

function systemPrompt(docTitles: string[]) {
  return `You are Acme Assistant, a helpful, knowledgeable assistant for Acme Corp employees. Be concise and professional.
- Use the provided tools whenever they fit the request. Never invent tool results, employee, stock, sales or policy data; if a tool finds nothing, say so.
- People, products, stock, sales and imported data tables: use the data tools (lookup_employee, check_inventory, sales_summary, query_dataset, aggregate_dataset), not the knowledge base.
- For policies, procedures, IT help and company knowledge, search the knowledge base first and cite passages like [leave-policy#1]. Documents: ${docTitles.join('; ')}.
- Greetings and general-knowledge questions can be answered directly without tools.`
}

export function createLlmAgent(ctx: ToolContext) {
  const tools = createTools(ctx)
  const system = systemPrompt(ctx.docs.map((d) => d.title))

  /**
   * `onText` receives the full answer text so far, for live streaming in the UI.
   * Only a few routed tools are sent to the model per question, which keeps the
   * prompt small (less RAM, faster) and the choice easier for a small model.
   */
  async function respond(
    history: ChatMsg[],
    question: string,
    onText: (text: string) => void,
    allowNetwork: boolean,
  ): Promise<AgentReply> {
    const offeredTools = selectTools(
      tools.filter((t) => allowNetwork || !t.network),
      question,
    )
    const schemas = offeredTools.map((t) => ({
      type: 'function' as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: {
          type: 'object',
          properties: t.parameters,
          required: Object.entries(t.parameters)
            .filter(([, p]) => !p.optional)
            .map(([k]) => k),
        },
      },
    }))
    const offered = offeredTools.map((t) => t.name)

    const messages: Message[] = [
      { role: 'system', content: system },
      ...history.slice(-8),
      { role: 'user', content: question },
    ]
    const calls: ToolCall[] = []
    const sources = new Map<string, Source>()

    for (let step = 0; step < 5; step++) {
      const stream = await ollama.chat({
        model: MODEL,
        messages,
        tools: schemas,
        stream: true,
        keep_alive: '5m', // unload the model from RAM after 5 idle minutes
        options: { num_ctx: 4096 },
      })

      let content = ''
      const requested: OllamaToolCall[] = []
      for await (const part of stream) {
        if (part.message.content) {
          content += part.message.content
          onText(content)
        }
        if (part.message.tool_calls) requested.push(...part.message.tool_calls)
      }

      if (!requested.length) return { text: content, calls, sources: [...sources.values()], offered }

      onText('')
      messages.push({ role: 'assistant', content, tool_calls: requested })

      for (const c of requested) {
        const tool = offeredTools.find((t) => t.name === c.function.name)
        const args = Object.fromEntries(
          Object.entries(c.function.arguments)
            .filter(([, v]) => v !== null && v !== undefined && !/^(null|undefined)$/i.test(String(v)))
            .map(([k, v]) => [k, String(v)]),
        )
        let result: string
        try {
          result = tool ? await tool.run(args) : `Unknown or unavailable tool: ${c.function.name}`
        } catch (e) {
          result = `Tool error: ${(e as Error).message}`
        }
        calls.push({ tool: c.function.name, args, result })
        if (c.function.name === 'search_knowledge_base') {
          const hits = await retrieveHybrid(ctx.index, args.query ?? '', { semantic: ctx.semantic, document: args.document })
          for (const s of toSources(hits)) sources.set(s.id, s)
        }
        messages.push({ role: 'tool', tool_name: c.function.name, content: result })
      }
    }
    return { text: 'Stopped after too many tool steps.', calls, sources: [...sources.values()], offered }
  }

  return { tools, respond }
}
