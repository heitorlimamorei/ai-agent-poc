import { type FlexibleSchema, type Tool, type ToolSet, tool } from "ai";

import type { AiToolDefinition, AiToolKit } from "../toolkit/index.ts";

export function toVercelAiTool<Input, Output>(
  definition: AiToolDefinition<Input, Output>,
): Tool<Input, Output> {
  const adaptedTool = {
    description: definition.description,
    inputSchema: definition.inputSchema as FlexibleSchema<Input>,
    outputSchema: definition.outputSchema as FlexibleSchema<Output>,
    execute: async (input: Input) => definition.execute(input),
  } as unknown as Tool<Input, Output>;

  return tool<Input, Output>(adaptedTool);
}

export function toVercelAiToolSet(toolKit: AiToolKit): ToolSet {
  const toolSet: ToolSet = {};

  for (const [key, definition] of Object.entries(toolKit)) {
    toolSet[key] = toVercelAiTool(definition);
  }

  return toolSet;
}
