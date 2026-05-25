import type { Tool, ToolSet } from "ai";
import type { OrderService } from "../../services/index.ts";
import {
  type CreateOrderToolInput,
  type CreateOrderToolOutput,
  NewCreateOrderTool,
  NewUpdateOrderTool,
  type UpdateOrderToolInput,
  type UpdateOrderToolOutput,
} from "../toolkit/index.ts";
import { toVercelAiTool } from "./vercel-ai.ts";

export {
  type CreateOrderToolInput,
  type CreateOrderToolOutput,
  createOrderToolInputSchema,
  createOrderToolOutputSchema,
  type UpdateOrderToolInput,
  type UpdateOrderToolOutput,
  updateOrderToolInputSchema,
  updateOrderToolOutputSchema,
} from "../toolkit/index.ts";

export interface OrderTools extends ToolSet {
  readonly createOrder: Tool<CreateOrderToolInput, CreateOrderToolOutput>;
  readonly updateOrder: Tool<UpdateOrderToolInput, UpdateOrderToolOutput>;
}

export interface OrderToolsDependencies {
  readonly orderService: Pick<OrderService, "create" | "update">;
}

export function NewOrderTools(dependencies: OrderToolsDependencies): OrderTools {
  const createOrder = NewCreateOrderTool({
    orderService: dependencies.orderService,
  });
  const updateOrder = NewUpdateOrderTool({
    orderService: dependencies.orderService,
  });

  return {
    createOrder: toVercelAiTool(createOrder),
    updateOrder: toVercelAiTool(updateOrder),
  };
}
