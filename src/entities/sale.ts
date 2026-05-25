import { modelMessageSchema } from "ai";
import { z } from "zod";

import type { saleMemoryEpisodes, saleMessages, saleSessions } from "../database/schema.ts";
import { err, ok, type Result } from "../utils/result.ts";

export const saleMemoryEmbeddingDimensions = 1536;

export const saleMemoryEmbeddingSchema = z.array(z.number()).length(saleMemoryEmbeddingDimensions);

const timestampSchema = z.preprocess((value) => {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "string") {
    return new Date(value).toISOString();
  }

  return value;
}, z.iso.datetime());

export const saleSessionSchema = z.object({
  id: z.uuid(),
  startedAt: timestampSchema,
  endedAt: timestampSchema.nullable(),
  orderId: z.uuid().nullable(),
});

export const saleMessageSchema = z.object({
  id: z.uuid(),
  sessionId: z.uuid(),
  sequence: z.number().int().nonnegative(),
  message: modelMessageSchema,
  createdAt: timestampSchema,
});

export const newSaleMessageSchema = saleMessageSchema.omit({
  createdAt: true,
  id: true,
});

export const saleMemoryToolCallSchema = z.object({
  step: z.number().int().nonnegative(),
  toolName: z.string().min(1),
  input: z.unknown().nullable(),
  output: z.unknown().nullable(),
});

export const saleMemoryEpisodeSchema = z.object({
  id: z.uuid(),
  sessionId: z.uuid(),
  userMessage: z.string().min(1),
  assistantResponse: z.string().min(1),
  orderId: z.uuid().nullable(),
  toolCalls: z.array(saleMemoryToolCallSchema),
  createdAt: timestampSchema,
});

export const saleMemoryEpisodeSearchResultSchema = saleMemoryEpisodeSchema.extend({
  score: z.number(),
});

export const newSaleMemoryEpisodeSchema = saleMemoryEpisodeSchema
  .omit({
    createdAt: true,
    id: true,
  })
  .extend({
    embedding: saleMemoryEmbeddingSchema,
  });

export type SaleSession = z.infer<typeof saleSessionSchema>;
export type SaleMessage = z.infer<typeof saleMessageSchema>;
export type NewSaleMessage = z.infer<typeof newSaleMessageSchema>;
export type SaleMemoryEpisode = z.infer<typeof saleMemoryEpisodeSchema>;
export type SaleMemoryEpisodeSearchResult = z.infer<typeof saleMemoryEpisodeSearchResultSchema>;
export type NewSaleMemoryEpisode = z.infer<typeof newSaleMemoryEpisodeSchema>;
export type SaleMemoryToolCall = z.infer<typeof saleMemoryToolCallSchema>;
export type SaleSessionRecord = typeof saleSessions.$inferSelect;
export type SaleMessageRecord = typeof saleMessages.$inferSelect;
export type NewSaleMessageRecord = typeof saleMessages.$inferInsert;
export type SaleMemoryEpisodeRecord = typeof saleMemoryEpisodes.$inferSelect;
export type NewSaleMemoryEpisodeRecord = typeof saleMemoryEpisodes.$inferInsert;

function normalizeMemoryText(text: string): string {
  return text.trim().replaceAll(/\s+/g, " ");
}

export function saleMemoryEpisodeEmbeddingText(
  episode: Pick<
    NewSaleMemoryEpisode,
    "assistantResponse" | "orderId" | "toolCalls" | "userMessage"
  >,
): string {
  const toolNames = [...new Set(episode.toolCalls.map((toolCall) => toolCall.toolName))];

  return [
    `type: sale_memory_episode`,
    `customer: ${normalizeMemoryText(episode.userMessage)}`,
    `agent: ${normalizeMemoryText(episode.assistantResponse)}`,
    `tools: ${toolNames.length === 0 ? "none" : toolNames.join(", ")}`,
    `outcome: ${episode.orderId === null ? "conversation_continued" : "order_created"}`,
  ].join("\n");
}

export function saleMemorySearchEmbeddingText(query: string): string {
  return [`type: sale_memory_episode`, `query: ${normalizeMemoryText(query)}`].join("\n");
}

function invalidSaleInput(message: string, error: z.ZodError): Result<never> {
  return err({
    cause: error,
    code: "INVALID_ARGUMENT",
    details: error.issues,
    expose: true,
    message,
    origin: "INPUT",
  });
}

function invalidSaleRecord(message: string, error: z.ZodError): Result<never> {
  return err({
    cause: error,
    code: "INTERNAL",
    message,
    origin: "SYSTEM",
  });
}

export function saleSessionFromRecord(record: unknown): Result<SaleSession> {
  const result = saleSessionSchema.safeParse(record);

  if (!result.success) {
    return invalidSaleRecord("Invalid sale session record", result.error);
  }

  return ok(result.data);
}

export function saleMessageFromRecord(record: unknown): Result<SaleMessage> {
  const result = saleMessageSchema.safeParse(record);

  if (!result.success) {
    return invalidSaleRecord("Invalid sale message record", result.error);
  }

  return ok(result.data);
}

export function saleMemoryEpisodeFromRecord(record: unknown): Result<SaleMemoryEpisode> {
  const result = saleMemoryEpisodeSchema.safeParse(record);

  if (!result.success) {
    return invalidSaleRecord("Invalid sale memory episode record", result.error);
  }

  return ok(result.data);
}

export function saleMemoryEpisodeSearchResultFromRecord(
  record: unknown,
): Result<SaleMemoryEpisodeSearchResult> {
  const result = saleMemoryEpisodeSearchResultSchema.safeParse(record);

  if (!result.success) {
    return invalidSaleRecord("Invalid sale memory episode search result record", result.error);
  }

  return ok(result.data);
}

export function newSaleMessageToRecord(message: NewSaleMessage): Result<NewSaleMessageRecord> {
  const result = newSaleMessageSchema.safeParse(message);

  if (!result.success) {
    return invalidSaleInput("Invalid sale message", result.error);
  }

  return ok({
    message: result.data.message,
    sequence: result.data.sequence,
    sessionId: result.data.sessionId,
  });
}

export function newSaleMemoryEpisodeToRecord(
  episode: NewSaleMemoryEpisode,
): Result<NewSaleMemoryEpisodeRecord> {
  const result = newSaleMemoryEpisodeSchema.safeParse(episode);

  if (!result.success) {
    return invalidSaleInput("Invalid sale memory episode", result.error);
  }

  return ok({
    assistantResponse: result.data.assistantResponse,
    embedding: result.data.embedding,
    orderId: result.data.orderId,
    sessionId: result.data.sessionId,
    toolCalls: result.data.toolCalls,
    userMessage: result.data.userMessage,
  });
}
