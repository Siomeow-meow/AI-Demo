import { businessTools } from './tools/business'
import { companyTools } from './tools/company'
import { datasetTools } from './tools/datasets'
import { erpTools } from './tools/erp'
import { financeTools } from './tools/finance'
import { financeExtraTools } from './tools/finance-extra'
import { itTools } from './tools/it'
import { knowledgeTools } from './tools/knowledge'
import { networkingTools } from './tools/networking'
import { posTools } from './tools/pos'
import { textTools } from './tools/text'
import { textExtraTools } from './tools/text-extra'
import { timeColorTools } from './tools/time-color'
import { utilityTools } from './tools/utility'
import { webTools } from './tools/web'
import { webExtraTools } from './tools/web-extra'
import { workspaceTools } from './tools/workspace'
import type { Tool, ToolContext } from './tool-types'

export type { Learnable, Tool, ToolCall, ToolContext, ToolParam } from './tool-types'
export { calculate } from './tools/utility'

/**
 * The full registry. To add a tool, add it to one of the files in ./tools
 * (or create a new group and list it here). The router decides which few
 * tools are shown to the model for each question, so this list can grow.
 */
export function createTools(ctx: ToolContext): Tool[] {
  return [
    ...utilityTools,
    ...timeColorTools,
    ...textTools,
    ...textExtraTools,
    ...knowledgeTools(ctx),
    ...companyTools,
    ...datasetTools,
    ...erpTools,
    ...posTools,
    ...businessTools,
    ...financeTools,
    ...financeExtraTools,
    ...itTools,
    ...networkingTools,
    ...workspaceTools,
    ...webTools,
    ...webExtraTools,
  ]
}
