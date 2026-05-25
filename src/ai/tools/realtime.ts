import { z } from "zod";

import type { AiToolDefinition, AiToolExecutionResult, AiToolKit } from "../toolkit/index.ts";

export interface RealtimeFunctionTool {
  readonly description: string;
  readonly name: string;
  readonly parameters: unknown;
  readonly type: "function";
}

export interface RealtimeToolCall {
  readonly arguments: unknown;
  readonly name: string;
}

export type RealtimeToolExecutionResult = AiToolExecutionResult;

export function toRealtimeTool(definition: AiToolDefinition): RealtimeFunctionTool {
  return {
    description: definition.description,
    name: definition.name,
    parameters: z.toJSONSchema(definition.inputSchema),
    type: "function",
  };
}

export function toRealtimeTools(toolKit: AiToolKit): RealtimeFunctionTool[] {
  return Object.values(toolKit).map(toRealtimeTool);
}

function parseRealtimeToolArguments(argumentsValue: RealtimeToolCall["arguments"]): unknown {
  if (typeof argumentsValue !== "string") {
    return argumentsValue;
  }

  return JSON.parse(argumentsValue);
}

export async function executeRealtimeToolCall(
  toolKit: AiToolKit,
  call: RealtimeToolCall,
): Promise<RealtimeToolExecutionResult> {
  const definition = toolKit[call.name];

  if (definition === undefined) {
    throw new Error(`Unknown realtime tool: ${call.name}`);
  }

  const input = definition.inputSchema.parse(parseRealtimeToolArguments(call.arguments));
  const output = await definition.execute(input);

  return {
    input,
    output: definition.outputSchema.parse(output),
    toolName: definition.name,
  };
}
