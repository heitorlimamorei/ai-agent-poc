import type { DrizzleDatabase } from "../adpters/drizzle.ts";
import { products } from "../database/schema.ts";
import {
  type NewProductWithEmbedding,
  newProductToRecord,
  type Product,
  productFromRecord,
} from "../entities/index.ts";
import { err, type Result } from "../utils/result.ts";

export interface ProductRepository {
  create: (product: NewProductWithEmbedding) => Promise<Result<Product>>;
}

export function NewProductRepository(db: DrizzleDatabase): ProductRepository {
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
        .returning({
          adValue: products.adValue,
          country: products.country,
          description: products.description,
          id: products.id,
          photoUrl: products.photoUrl,
          url: products.url,
        });

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

  return { create };
}
