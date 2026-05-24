import { z } from "zod";

import type { orders } from "../database/schema.ts";
import { err, ok, type Result } from "../utils/result.ts";

const createdAtSchema = z.preprocess((value) => {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "string") {
    return new Date(value).toISOString();
  }

  return value;
}, z.iso.datetime());

export const orderSchema = z.object({
  id: z.uuid(),
  customerName: z.string().trim().min(1).max(255),
  productId: z.uuid(),
  createdAt: createdAtSchema,
});

export const newOrderSchema = orderSchema.omit({
  createdAt: true,
  id: true,
});

export const updateOrderSchema = newOrderSchema
  .partial()
  .refine(
    (order) => order.customerName !== undefined || order.productId !== undefined,
    "At least one order field must be provided",
  );

export type Order = z.infer<typeof orderSchema>;
export type NewOrder = z.infer<typeof newOrderSchema>;
export type UpdateOrder = z.infer<typeof updateOrderSchema>;
export type OrderRecord = typeof orders.$inferSelect;
export type NewOrderRecord = typeof orders.$inferInsert;

function invalidOrderInput(message: string, error: z.ZodError): Result<never> {
  return err({
    cause: error,
    code: "INVALID_ARGUMENT",
    details: error.issues,
    expose: true,
    message,
    origin: "INPUT",
  });
}

function invalidOrderRecord(message: string, error: z.ZodError): Result<never> {
  return err({
    cause: error,
    code: "INTERNAL",
    message,
    origin: "SYSTEM",
  });
}

export function orderFromRecord(record: unknown): Result<Order> {
  const result = orderSchema.safeParse(record);

  if (!result.success) {
    return invalidOrderRecord("Invalid order record", result.error);
  }

  return ok(result.data);
}

export function newOrderToRecord(order: NewOrder): Result<NewOrderRecord> {
  const result = newOrderSchema.safeParse(order);

  if (!result.success) {
    return invalidOrderInput("Invalid order", result.error);
  }

  const parsedOrder = result.data;

  return ok({
    customerName: parsedOrder.customerName,
    productId: parsedOrder.productId,
  });
}

export function updateOrderToRecord(order: UpdateOrder): Result<Partial<NewOrderRecord>> {
  const result = updateOrderSchema.safeParse(order);

  if (!result.success) {
    return invalidOrderInput("Invalid order update", result.error);
  }

  const parsedOrder = result.data;

  return ok({
    ...(parsedOrder.customerName !== undefined ? { customerName: parsedOrder.customerName } : {}),
    ...(parsedOrder.productId !== undefined ? { productId: parsedOrder.productId } : {}),
  });
}
