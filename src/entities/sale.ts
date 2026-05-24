import { modelMessageSchema } from "ai";
import { z } from "zod";

import type { saleMessages, saleSessions } from "../database/schema.ts";
import { err, ok, type Result } from "../utils/result.ts";

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

export type SaleSession = z.infer<typeof saleSessionSchema>;
export type SaleMessage = z.infer<typeof saleMessageSchema>;
export type NewSaleMessage = z.infer<typeof newSaleMessageSchema>;
export type SaleSessionRecord = typeof saleSessions.$inferSelect;
export type SaleMessageRecord = typeof saleMessages.$inferSelect;
export type NewSaleMessageRecord = typeof saleMessages.$inferInsert;

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
