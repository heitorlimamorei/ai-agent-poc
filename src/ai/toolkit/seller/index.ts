import type { OrderService, ProductService } from "../../../services/index.ts";
import type { AiToolKit } from "../types.ts";
import { NewCreateOrderTool } from "./order.ts";
import { NewFindProductsTool } from "./product.ts";

export * from "./order.ts";
export * from "./product.ts";

export interface SellerToolKitDependencies {
  readonly orderService: Pick<OrderService, "create">;
  readonly productService: Pick<ProductService, "list">;
}

export interface SellerToolKit extends AiToolKit {
  readonly createOrder: ReturnType<typeof NewCreateOrderTool>;
  readonly findProducts: ReturnType<typeof NewFindProductsTool>;
}

export function NewSellerToolKit(dependencies: SellerToolKitDependencies): SellerToolKit {
  return {
    createOrder: NewCreateOrderTool({
      orderService: dependencies.orderService,
    }),
    findProducts: NewFindProductsTool({
      productService: dependencies.productService,
    }),
  };
}
