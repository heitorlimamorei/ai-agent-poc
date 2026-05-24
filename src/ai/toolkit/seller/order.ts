import { z } from "zod";

import { orderSchema } from "../../../entities/index.ts";
import type { OrderService } from "../../../services/index.ts";
import {
  toolFailureFromFailure,
  toolFailureFromUnknown,
  toolFailureOutputSchema,
} from "../errors.ts";
import type { AiToolDefinition } from "../types.ts";

const createOrderErrorOptions = {
  fallbackMessage: "Failed to create order",
};

export const createOrderToolInputSchema = z.object({
  customerName: z
    .string()
    .min(1)
    .max(255)
    .describe("Customer name to associate with the confirmed order."),
  productId: z.uuid().describe("ID of the product the customer confirmed they want to buy."),
});

export const createOrderToolOutputSchema = z.discriminatedUnion("ok", [
  z.object({
    ok: z.literal(true),
    order: orderSchema,
  }),
  toolFailureOutputSchema,
]);

export type CreateOrderToolInput = z.infer<typeof createOrderToolInputSchema>;
export type CreateOrderToolOutput = z.infer<typeof createOrderToolOutputSchema>;

export interface CreateOrderToolDependencies {
  readonly orderService: Pick<OrderService, "create">;
}

export function NewCreateOrderTool(
  dependencies: CreateOrderToolDependencies,
): AiToolDefinition<CreateOrderToolInput, CreateOrderToolOutput> {
  const { orderService } = dependencies;

  return {
    description:
      "Create an order after the customer explicitly confirms the purchase of a product.",
    inputSchema: createOrderToolInputSchema,
    name: "createOrder",
    outputSchema: createOrderToolOutputSchema,
    async execute({ customerName, productId }): Promise<CreateOrderToolOutput> {
      try {
        const [order, orderFailure] = await orderService.create({
          customerName: customerName.trim().replaceAll(/\s+/g, " "),
          productId,
        });

        if (orderFailure !== null) {
          return toolFailureFromFailure(orderFailure, createOrderErrorOptions);
        }

        return {
          ok: true,
          order,
        };
      } catch (error) {
        return toolFailureFromUnknown(error, createOrderErrorOptions);
      }
    },
  };
}
