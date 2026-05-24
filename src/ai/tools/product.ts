import type { Tool, ToolSet } from "ai";
import type { ProductService } from "../../services/index.ts";
import {
  type FindProductsToolInput,
  type FindProductsToolOutput,
  NewFindProductsTool,
} from "../toolkit/index.ts";
import { toVercelAiTool } from "./vercel-ai.ts";

export {
  type FindProductsToolInput,
  type FindProductsToolOutput,
  findProductsToolInputSchema,
  findProductsToolOutputSchema,
} from "../toolkit/index.ts";

export interface ProductTools extends ToolSet {
  readonly findProducts: Tool<FindProductsToolInput, FindProductsToolOutput>;
}

export interface ProductToolsDependencies {
  readonly productService: Pick<ProductService, "list">;
}

export function NewProductTools(dependencies: ProductToolsDependencies): ProductTools {
  const findProducts = NewFindProductsTool({
    productService: dependencies.productService,
  });

  return {
    findProducts: toVercelAiTool(findProducts),
  };
}
