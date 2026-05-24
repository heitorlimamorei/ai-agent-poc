import { z } from "zod";

import { newProductSchema, productSchema, productSearchResultSchema } from "../entities/index.ts";

export const createProductRequestSchema = newProductSchema;

export const listProductsQuerySchema = z.object({
  search: z.string().trim().min(1).optional(),
});

export const productResponseSchema = productSchema;

export const productSearchResultResponseSchema = productSearchResultSchema;

export const listProductsResponseSchema = z.array(
  z.union([productSearchResultResponseSchema, productResponseSchema]),
);

export type CreateProductRequest = z.infer<typeof createProductRequestSchema>;
export type ListProductsResponse = z.infer<typeof listProductsResponseSchema>;
export type ListProductsQuery = z.infer<typeof listProductsQuerySchema>;
export type ProductResponse = z.infer<typeof productResponseSchema>;
export type ProductSearchResultResponse = z.infer<typeof productSearchResultResponseSchema>;
