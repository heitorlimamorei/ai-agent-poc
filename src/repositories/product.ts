import { isNotNull } from "drizzle-orm";
import { cosineDistance } from "drizzle-orm/sql/functions/vector";

import type { DrizzleDatabase } from "../adpters/drizzle.ts";
import { products } from "../database/schema.ts";
import {
  type NewProductWithEmbedding,
  newProductToRecord,
  type Product,
  type ProductSearchResult,
  productFromRecord,
  productSearchResultFromRecord,
} from "../entities/index.ts";
import { err, ok, type Result } from "../utils/result.ts";

export interface ProductRepository {
  create: (product: NewProductWithEmbedding) => Promise<Result<Product>>;
  list: () => Promise<Result<Product[]>>;
  search: (embedding: number[]) => Promise<Result<ProductSearchResult[]>>;
}

export function NewProductRepository(db: DrizzleDatabase): ProductRepository {
  const productColumns = {
    adValue: products.adValue,
    country: products.country,
    description: products.description,
    id: products.id,
    photoUrl: products.photoUrl,
    url: products.url,
  };

  async function create(product: NewProductWithEmbedding): Promise<Result<Product>> {
    const [validProductRecord, invalidProductFailure] = newProductToRecord(product);

    if (invalidProductFailure !== null) {
      return [null, invalidProductFailure];
    }

    let productRecord: unknown;

    try {
      const [createdProductRecord] = await db
        .insert(products)
        .values(validProductRecord)
        .returning(productColumns);

      if (createdProductRecord === undefined) {
        return err({
          code: "INTERNAL",
          message: "Failed to create product",
          origin: "SYSTEM",
        });
      }

      productRecord = createdProductRecord;
    } catch (error) {
      return err({
        cause: error,
        code: "DEPENDENCY_FAILURE",
        message: "Failed to create product",
        origin: "DEPENDENCY",
      });
    }

    return productFromRecord(productRecord);
  }

  async function list(): Promise<Result<Product[]>> {
    let productRecords: unknown[];

    try {
      productRecords = await db.select(productColumns).from(products);
    } catch (error) {
      return err({
        cause: error,
        code: "DEPENDENCY_FAILURE",
        message: "Failed to list products",
        origin: "DEPENDENCY",
      });
    }

    const parsedProducts: Product[] = [];

    for (const productRecord of productRecords) {
      const [product, productFailure] = productFromRecord(productRecord);

      if (productFailure !== null) {
        return err(productFailure);
      }

      parsedProducts.push(product);
    }

    return ok(parsedProducts);
  }

  async function search(embedding: number[]): Promise<Result<ProductSearchResult[]>> {
    const distance = cosineDistance(products.embedding, embedding);
    let productRecords: unknown[];

    try {
      productRecords = await db
        .select({
          ...productColumns,
          score: distance.mapWith(Number),
        })
        .from(products)
        .where(isNotNull(products.embedding))
        .orderBy(distance)
        .limit(5);
    } catch (error) {
      return err({
        cause: error,
        code: "DEPENDENCY_FAILURE",
        message: "Failed to search products",
        origin: "DEPENDENCY",
      });
    }

    const parsedProducts: ProductSearchResult[] = [];

    for (const productRecord of productRecords) {
      const [product, productFailure] = productSearchResultFromRecord({
        ...(productRecord as Record<string, unknown>),
        score: 1 - Number((productRecord as { score: unknown }).score),
      });

      if (productFailure !== null) {
        return err(productFailure);
      }

      parsedProducts.push(product);
    }

    return ok(parsedProducts);
  }

  return { create, list, search };
}
