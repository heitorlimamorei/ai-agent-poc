import { z } from "zod";

export const saleSessionParamsSchema = z.object({
  sessionId: z.uuid(),
});

export const saleMessageRequestSchema = z.object({
  message: z.string().trim().min(1),
});

export const saleMessageResponseSchema = z.object({
  endedAt: z.iso.datetime().nullable(),
  orderId: z.uuid().nullable(),
  response: z.string(),
  sessionId: z.uuid(),
});

export type SaleSessionParams = z.infer<typeof saleSessionParamsSchema>;
export type SaleMessageRequest = z.infer<typeof saleMessageRequestSchema>;
export type SaleMessageResponse = z.infer<typeof saleMessageResponseSchema>;
