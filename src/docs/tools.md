# AI Tool Use

Tool use (also called function calling) lets an AI agent take actions. Each tool has a name, a description, and a typed input schema. The agent reads the user's request, decides which tool to call, supplies the arguments, and receives the result.

The result is fed back so the agent can compose its final answer. Common tools include calculators, web search, database queries, code execution, and knowledge-base retrieval. Good tool descriptions matter because the model uses them to decide when each tool applies.
