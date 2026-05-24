import { z } from "zod";

import { newOrderSchema, orderSchema, updateOrderSchema } from "../entities/index.ts";

export const orderParamsSchema = z.object({
  id: z.uuid(),
});

export const createOrderRequestSchema = newOrderSchema;

export const updateOrderRequestSchema = updateOrderSchema;

export const orderResponseSchema = orderSchema;

export const listOrdersResponseSchema = z.array(orderResponseSchema);

export type OrderParams = z.infer<typeof orderParamsSchema>;
export type CreateOrderRequest = z.infer<typeof createOrderRequestSchema>;
export type UpdateOrderRequest = z.infer<typeof updateOrderRequestSchema>;
export type OrderResponse = z.infer<typeof orderResponseSchema>;
export type ListOrdersResponse = z.infer<typeof listOrdersResponseSchema>;
