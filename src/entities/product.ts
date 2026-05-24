import { z } from "zod";

import type { products } from "../database/schema.ts";
import { err, ok, type Result } from "../utils/result.ts";

export const productEmbeddingDimensions = 1536;

export const productEmbeddingSchema = z.array(z.number()).length(productEmbeddingDimensions);

export const productSchema = z.object({
  id: z.uuid(),
  url: z.url(),
  country: z.string().regex(/^[A-Z]{2}$/),
  adValue: z.number(),
  description: z.string().min(1),
  photoUrl: z.url(),
});

export const productWithEmbeddingSchema = productSchema.extend({
  embedding: productEmbeddingSchema.nullable(),
});

export const productSearchResultSchema = productSchema.extend({
  score: z.number(),
});

export const newProductSchema = productSchema.omit({ id: true });

export const newProductWithEmbeddingSchema = newProductSchema.extend({
  embedding: productEmbeddingSchema.nullish(),
});

export type Product = z.infer<typeof productSchema>;
export type ProductSearchResult = z.infer<typeof productSearchResultSchema>;
export type ProductWithEmbedding = z.infer<typeof productWithEmbeddingSchema>;
export type NewProduct = z.infer<typeof newProductSchema>;
export type NewProductWithEmbedding = z.infer<typeof newProductWithEmbeddingSchema>;
export type ProductRecord = typeof products.$inferSelect;
export type NewProductRecord = typeof products.$inferInsert;

export function productEmbeddingText(product: NewProduct): string {
  const description = product.description.trim().replaceAll(/\s+/g, " ");

  return [`type: product`, `country: ${product.country}`, `description: ${description}`].join("\n");
}

export function productSearchEmbeddingText(query: string): string {
  return [`type: product`, `query: ${query.trim().replaceAll(/\s+/g, " ")}`].join("\n");
}

function invalidProductInput(message: string, error: z.ZodError): Result<never> {
  return err({
    cause: error,
    code: "INVALID_ARGUMENT",
    details: error.issues,
    expose: true,
    message,
    origin: "INPUT",
  });
}

function invalidProductRecord(message: string, error: z.ZodError): Result<never> {
  return err({
    cause: error,
    code: "INTERNAL",
    message,
    origin: "SYSTEM",
  });
}

export function productFromRecord(record: unknown): Result<Product> {
  const result = productSchema.safeParse(record);

  if (!result.success) {
    return invalidProductRecord("Invalid product record", result.error);
  }

  return ok(result.data);
}

export function productSearchResultFromRecord(record: unknown): Result<ProductSearchResult> {
  const result = productSearchResultSchema.safeParse(record);

  if (!result.success) {
    return invalidProductRecord("Invalid product search result record", result.error);
  }

  return ok(result.data);
}

export function productWithEmbeddingFromRecord(
  record: ProductRecord,
): Result<ProductWithEmbedding> {
  const result = productWithEmbeddingSchema.safeParse(record);

  if (!result.success) {
    return invalidProductRecord("Invalid product record", result.error);
  }

  return ok(result.data);
}

export function productToRecord(product: ProductWithEmbedding): Result<ProductRecord> {
  const result = productWithEmbeddingSchema.safeParse(product);

  if (!result.success) {
    return invalidProductInput("Invalid product", result.error);
  }

  return ok(result.data);
}

export function newProductToRecord(product: NewProductWithEmbedding): Result<NewProductRecord> {
  const result = newProductWithEmbeddingSchema.safeParse(product);

  if (!result.success) {
    return invalidProductInput("Invalid product", result.error);
  }

  const parsedProduct = result.data;

  return ok({
    adValue: parsedProduct.adValue,
    country: parsedProduct.country,
    description: parsedProduct.description,
    embedding: parsedProduct.embedding ?? null,
    photoUrl: parsedProduct.photoUrl,
    url: parsedProduct.url,
  });
}
