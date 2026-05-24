import type { z } from "zod";

export interface AiToolDefinition<Input = unknown, Output = unknown> {
  readonly description: string;
  readonly inputSchema: z.ZodType<Input>;
  readonly name: string;
  readonly outputSchema: z.ZodType<Output>;
  execute(input: Input): Promise<Output>;
}

export type AiToolKit = Record<string, AiToolDefinition>;
