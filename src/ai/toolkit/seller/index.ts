import type { OrderService, ProductService } from "../../../services/index.ts";
import type { AiToolKit } from "../types.ts";
import { NewEndConversationTool } from "./call.ts";
import { NewCreateOrderTool, NewUpdateOrderTool } from "./order.ts";
import { NewFindProductsTool, NewListAvailableProductsTool } from "./product.ts";

export * from "./call.ts";
export * from "./order.ts";
export * from "./product.ts";

export interface SellerToolKitDependencies {
  readonly orderService: Pick<OrderService, "create" | "update">;
  readonly productService: Pick<ProductService, "list">;
}

export interface SellerToolKit extends AiToolKit {
  readonly createOrder: ReturnType<typeof NewCreateOrderTool>;
  readonly endConversation: ReturnType<typeof NewEndConversationTool>;
  readonly findProducts: ReturnType<typeof NewFindProductsTool>;
  readonly listAvailableProducts: ReturnType<typeof NewListAvailableProductsTool>;
  readonly updateOrder: ReturnType<typeof NewUpdateOrderTool>;
}

export function NewSellerToolKit(dependencies: SellerToolKitDependencies): SellerToolKit {
  return {
    createOrder: NewCreateOrderTool({
      orderService: dependencies.orderService,
    }),
    endConversation: NewEndConversationTool(),
    findProducts: NewFindProductsTool({
      productService: dependencies.productService,
    }),
    listAvailableProducts: NewListAvailableProductsTool({
      productService: dependencies.productService,
    }),
    updateOrder: NewUpdateOrderTool({
      orderService: dependencies.orderService,
    }),
  };
}
