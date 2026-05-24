import type { CreateEmbedding } from "../adpters/ai.ts";
import { type NewProduct, type Product, productEmbeddingText } from "../entities/index.ts";
import type { ProductRepository } from "../repositories/index.ts";
import { err, type Result } from "../utils/result.ts";

export interface ProductAi {
  readonly createEmbedding: CreateEmbedding;
}

export interface ProductService {
  create: (product: NewProduct) => Promise<Result<Product>>;
}

export function NewProductService(
  ai: ProductAi,
  productRepository: ProductRepository,
): ProductService {
  async function create(product: NewProduct): Promise<Result<Product>> {
    const textEmbedding = productEmbeddingText(product);
    const [embedding, embeddingFailure] = await ai.createEmbedding(textEmbedding);

    if (embeddingFailure !== null) {
      return err(embeddingFailure);
    }

    return productRepository.create({
      ...product,
      embedding,
    });
  }

  return { create };
}
