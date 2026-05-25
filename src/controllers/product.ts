import type { Context } from "hono";

import {
  createProductRequestSchema,
  listProductsQuerySchema,
} from "../dtos/index.ts";
import type { ProductService } from "../services/index.ts";
import {
  jsonResult,
  parseJsonRequestInput,
  parseRequestInput,
} from "./utils.ts";

export interface ProductController {
  readonly create: (context: Context) => Promise<Response>;
  readonly list: (context: Context) => Promise<Response>;
}

export function NewProductController(
  productService: ProductService,
): ProductController {
  async function create(context: Context): Promise<Response> {
    const parsedBody = await parseJsonRequestInput(
      context,
      createProductRequestSchema,
      "Invalid product body",
    );

    if (parsedBody[1] !== null) {
      return jsonResult(context, parsedBody);
    }

    return jsonResult(context, await productService.create(parsedBody[0]), 201);
  }

  async function list(context: Context): Promise<Response> {
    const parsedQuery = parseRequestInput(
      listProductsQuerySchema,
      {
        search: context.req.query("search"),
      },
      "Invalid product query",
    );

    if (parsedQuery[1] !== null) {
      return jsonResult(context, parsedQuery);
    }

    return jsonResult(
      context,
      await productService.list(parsedQuery[0].search),
    );
  }

  return { create, list };
}
