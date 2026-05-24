import type { z } from "zod";

import { newProductSchema, productSchema } from "../entities/index.ts";

export const createProductRequestSchema = newProductSchema;

export const productResponseSchema = productSchema;

export type CreateProductRequest = z.infer<typeof createProductRequestSchema>;
export type ProductResponse = z.infer<typeof productResponseSchema>;
