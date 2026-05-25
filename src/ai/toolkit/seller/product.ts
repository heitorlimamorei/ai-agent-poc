import { z } from "zod";

import { productSchema, productSearchResultSchema } from "../../../entities/index.ts";
import type { ProductService } from "../../../services/index.ts";
import { failure } from "../../../utils/result.ts";
import {
  toolErrorFromFailure,
  toolFailureFromFailure,
  toolFailureFromUnknown,
  toolFailureOutputSchema,
} from "../errors.ts";
import type { AiToolDefinition } from "../types.ts";

const findProductsErrorOptions = {
  fallbackMessage: "Failed to find products",
};

export const findProductsToolInputSchema = z.object({
  query: z
    .string()
    .min(1)
    .max(500)
    .describe("User search query describing the product they are looking for."),
});

export const findProductsToolOutputSchema = z.discriminatedUnion("ok", [
  z.object({
    ok: z.literal(true),
    products: z.array(productSearchResultSchema).max(5),
    query: z.string(),
  }),
  toolFailureOutputSchema.extend({
    query: z.string(),
  }),
]);

export type FindProductsToolInput = z.infer<typeof findProductsToolInputSchema>;
export type FindProductsToolOutput = z.infer<typeof findProductsToolOutputSchema>;

export const listAvailableProductsToolInputSchema = z.object({});

export const listAvailableProductsToolOutputSchema = z.discriminatedUnion("ok", [
  z.object({
    ok: z.literal(true),
    products: z.array(productSchema),
  }),
  toolFailureOutputSchema,
]);

export type ListAvailableProductsToolInput = z.infer<typeof listAvailableProductsToolInputSchema>;
export type ListAvailableProductsToolOutput = z.infer<typeof listAvailableProductsToolOutputSchema>;

export interface FindProductsToolDependencies {
  readonly productService: Pick<ProductService, "list">;
}

export interface ListAvailableProductsToolDependencies {
  readonly productService: Pick<ProductService, "list">;
}

export function NewFindProductsTool(
  dependencies: FindProductsToolDependencies,
): AiToolDefinition<FindProductsToolInput, FindProductsToolOutput> {
  const { productService } = dependencies;

  return {
    description:
      "Find the five products in the database that are most related to the user's query.",
    inputSchema: findProductsToolInputSchema,
    name: "findProducts",
    outputSchema: findProductsToolOutputSchema,
    async execute({ query }): Promise<FindProductsToolOutput> {
      const normalizedQuery = query.trim().replaceAll(/\s+/g, " ");

      try {
        const [products, productsFailure] = await productService.list(normalizedQuery);

        if (productsFailure !== null) {
          return {
            ...toolFailureFromFailure(productsFailure, findProductsErrorOptions),
            ok: false,
            query: normalizedQuery,
          };
        }

        const parsedProducts = z.array(productSearchResultSchema).max(5).safeParse(products);

        if (!parsedProducts.success) {
          return {
            error: toolErrorFromFailure(
              failure({
                cause: parsedProducts.error,
                code: "INTERNAL",
                message: "Invalid product search result",
                origin: "SYSTEM",
              }),
              findProductsErrorOptions,
            ),
            ok: false,
            query: normalizedQuery,
          };
        }

        return {
          ok: true,
          products: parsedProducts.data,
          query: normalizedQuery,
        };
      } catch (error) {
        return {
          ...toolFailureFromUnknown(error, findProductsErrorOptions),
          ok: false,
          query: normalizedQuery,
        };
      }
    },
  };
}

export function NewListAvailableProductsTool(
  dependencies: ListAvailableProductsToolDependencies,
): AiToolDefinition<ListAvailableProductsToolInput, ListAvailableProductsToolOutput> {
  const { productService } = dependencies;

  return {
    description:
      "List all products currently available in the database when the caller asks for the full catalog or all options without a search filter.",
    inputSchema: listAvailableProductsToolInputSchema,
    name: "listAvailableProducts",
    outputSchema: listAvailableProductsToolOutputSchema,
    async execute(): Promise<ListAvailableProductsToolOutput> {
      try {
        const [products, productsFailure] = await productService.list();

        if (productsFailure !== null) {
          return toolFailureFromFailure(productsFailure, findProductsErrorOptions);
        }

        const parsedProducts = z.array(productSchema).safeParse(products);

        if (!parsedProducts.success) {
          return {
            error: toolErrorFromFailure(
              failure({
                cause: parsedProducts.error,
                code: "INTERNAL",
                message: "Invalid product list result",
                origin: "SYSTEM",
              }),
              findProductsErrorOptions,
            ),
            ok: false,
          };
        }

        return {
          ok: true,
          products: parsedProducts.data,
        };
      } catch (error) {
        return toolFailureFromUnknown(error, findProductsErrorOptions);
      }
    },
  };
}
