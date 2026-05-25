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

const updateOrderErrorOptions = {
  fallbackMessage: "Failed to update order",
};

export const createOrderToolInputSchema = z.object({
  customerNameConfirmed: z
    .literal(true)
    .describe(
      "Must be true. Set only after the customer clearly confirms the full customer name read back by the assistant.",
    ),
  customerName: z
    .string()
    .min(1)
    .max(255)
    .describe(
      "Customer name to associate with the order. Use only the name explicitly confirmed by the customer, not an inferred or guessed name.",
    ),
  productId: z.uuid().describe("ID of the product the customer confirmed they want to buy."),
});

export const createOrderToolOutputSchema = z.discriminatedUnion("ok", [
  z.object({
    ok: z.literal(true),
    order: orderSchema,
  }),
  toolFailureOutputSchema,
]);

export const updateOrderToolInputSchema = z
  .object({
    correctionConfirmed: z
      .literal(true)
      .describe(
        "Must be true. Set only after the customer clearly confirms the final corrected order value.",
      ),
    customerName: z
      .string()
      .min(1)
      .max(255)
      .optional()
      .describe(
        "Corrected customer name. Use only after the customer explicitly confirms the full corrected name.",
      ),
    orderId: z.uuid().describe("ID of the existing order that must be corrected."),
    productId: z
      .uuid()
      .optional()
      .describe(
        "Corrected product ID. Use only after the customer explicitly confirms the replacement product.",
      ),
  })
  .refine(
    (order) => order.customerName !== undefined || order.productId !== undefined,
    "At least one order correction must be provided",
  );

export const updateOrderToolOutputSchema = z.discriminatedUnion("ok", [
  z.object({
    ok: z.literal(true),
    order: orderSchema,
  }),
  toolFailureOutputSchema,
]);

export type CreateOrderToolInput = z.infer<typeof createOrderToolInputSchema>;
export type CreateOrderToolOutput = z.infer<typeof createOrderToolOutputSchema>;
export type UpdateOrderToolInput = z.infer<typeof updateOrderToolInputSchema>;
export type UpdateOrderToolOutput = z.infer<typeof updateOrderToolOutputSchema>;

export interface CreateOrderToolDependencies {
  readonly orderService: Pick<OrderService, "create">;
}

export interface UpdateOrderToolDependencies {
  readonly orderService: Pick<OrderService, "update">;
}

function normalizeCustomerName(customerName: string): string {
  return customerName.trim().replaceAll(/\s+/g, " ");
}

export function NewCreateOrderTool(
  dependencies: CreateOrderToolDependencies,
): AiToolDefinition<CreateOrderToolInput, CreateOrderToolOutput> {
  const { orderService } = dependencies;

  return {
    description:
      "Create an order only after the customer explicitly confirms the purchase and the customer name has been read back and confirmed.",
    inputSchema: createOrderToolInputSchema,
    name: "createOrder",
    outputSchema: createOrderToolOutputSchema,
    async execute({ customerName, productId }): Promise<CreateOrderToolOutput> {
      try {
        const [order, orderFailure] = await orderService.create({
          customerName: normalizeCustomerName(customerName),
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

export function NewUpdateOrderTool(
  dependencies: UpdateOrderToolDependencies,
): AiToolDefinition<UpdateOrderToolInput, UpdateOrderToolOutput> {
  const { orderService } = dependencies;

  return {
    description:
      "Correct an existing order after it was created, only when the customer notices a mistake and explicitly confirms the corrected name or product.",
    inputSchema: updateOrderToolInputSchema,
    name: "updateOrder",
    outputSchema: updateOrderToolOutputSchema,
    async execute({ customerName, orderId, productId }): Promise<UpdateOrderToolOutput> {
      try {
        const [order, orderFailure] = await orderService.update(orderId, {
          ...(customerName !== undefined
            ? { customerName: normalizeCustomerName(customerName) }
            : {}),
          ...(productId !== undefined ? { productId } : {}),
        });

        if (orderFailure !== null) {
          return toolFailureFromFailure(orderFailure, updateOrderErrorOptions);
        }

        return {
          ok: true,
          order,
        };
      } catch (error) {
        return toolFailureFromUnknown(error, updateOrderErrorOptions);
      }
    },
  };
}
