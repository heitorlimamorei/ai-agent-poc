import type { Tool, ToolSet } from "ai";
import type { OrderService } from "../../services/index.ts";
import {
  type CreateOrderToolInput,
  type CreateOrderToolOutput,
  NewCreateOrderTool,
} from "../toolkit/index.ts";
import { toVercelAiTool } from "./vercel-ai.ts";

export {
  type CreateOrderToolInput,
  type CreateOrderToolOutput,
  createOrderToolInputSchema,
  createOrderToolOutputSchema,
} from "../toolkit/index.ts";

export interface OrderTools extends ToolSet {
  readonly createOrder: Tool<CreateOrderToolInput, CreateOrderToolOutput>;
}

export interface OrderToolsDependencies {
  readonly orderService: Pick<OrderService, "create">;
}

export function NewOrderTools(dependencies: OrderToolsDependencies): OrderTools {
  const createOrder = NewCreateOrderTool({
    orderService: dependencies.orderService,
  });

  return {
    createOrder: toVercelAiTool(createOrder),
  };
}
