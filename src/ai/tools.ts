import { businessTools } from './tools/business'
import { companyTools } from './tools/company'
import { dateTimeExtraTools } from './tools/datetime-extra'
import { educationTools } from './tools/education'
import { erpMoreTools } from './tools/erp-more'
import { everydayTools } from './tools/everyday'
import { hrTools } from './tools/hr'
import { mathMoreTools } from './tools/math-more'
import { textMoreTools } from './tools/text-more'
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
    ...dateTimeExtraTools,
    ...mathMoreTools,
    ...everydayTools,
    ...educationTools,
    ...textTools,
    ...textExtraTools,
    ...textMoreTools,
    ...knowledgeTools(ctx),
    ...companyTools,
    ...datasetTools,
    ...erpTools,
    ...erpMoreTools,
    ...hrTools,
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
