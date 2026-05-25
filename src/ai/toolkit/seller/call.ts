import { z } from "zod";

import type { AiToolDefinition } from "../types.ts";

export const endConversationToolInputSchema = z.object({});

export const endConversationToolOutputSchema = z.object({
  ok: z.literal(true),
});

export type EndConversationToolInput = z.infer<typeof endConversationToolInputSchema>;
export type EndConversationToolOutput = z.infer<typeof endConversationToolOutputSchema>;

export function NewEndConversationTool(): AiToolDefinition<
  EndConversationToolInput,
  EndConversationToolOutput
> {
  return {
    description:
      "End the current voice conversation when the caller clearly says goodbye, asks to finish, or confirms there is nothing else they need.",
    inputSchema: endConversationToolInputSchema,
    name: "endConversation",
    outputSchema: endConversationToolOutputSchema,
    async execute(): Promise<EndConversationToolOutput> {
      await Promise.resolve();

      return {
        ok: true,
      };
    },
  };
}
