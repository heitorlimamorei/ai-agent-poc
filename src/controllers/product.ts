import type { Context } from "hono";
import { z } from "zod";

import { createProductRequestSchema, listProductsQuerySchema } from "../dtos/index.ts";
import type { ProductService } from "../services/index.ts";
import { err } from "../utils/result.ts";
import { jsonResult } from "./errors.ts";

export interface ProductController {
  readonly create: (context: Context) => Promise<Response>;
  readonly list: (context: Context) => Promise<Response>;
}

export function NewProductController(productService: ProductService): ProductController {
  async function create(context: Context): Promise<Response> {
    let body: unknown;

    try {
      body = await context.req.json();
    } catch (error) {
      return jsonResult(
        context,
        err({
          cause: error,
          code: "INVALID_ARGUMENT",
          expose: true,
          message: "Invalid JSON body",
          origin: "TRANSPORT",
        }),
      );
    }

    const parsedBody = createProductRequestSchema.safeParse(body);

    if (!parsedBody.success) {
      return jsonResult(
        context,
        err({
          cause: parsedBody.error,
          code: "INVALID_ARGUMENT",
          details: z.treeifyError(parsedBody.error),
          expose: true,
          message: "Invalid product body",
          origin: "INPUT",
        }),
      );
    }

    return jsonResult(context, await productService.create(parsedBody.data), 201);
  }

  async function list(context: Context): Promise<Response> {
    const parsedQuery = listProductsQuerySchema.safeParse({
      search: context.req.query("search"),
    });

    if (!parsedQuery.success) {
      return jsonResult(
        context,
        err({
          cause: parsedQuery.error,
          code: "INVALID_ARGUMENT",
          details: z.treeifyError(parsedQuery.error),
          expose: true,
          message: "Invalid product query",
          origin: "INPUT",
        }),
      );
    }

    return jsonResult(context, await productService.list(parsedQuery.data.search));
  }

  return { create, list };
}
