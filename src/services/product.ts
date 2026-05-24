import type { CreateEmbedding } from "../adpters/ai.ts";
import {
  type NewProduct,
  type Product,
  type ProductSearchResult,
  productEmbeddingText,
  productSearchEmbeddingText,
} from "../entities/index.ts";
import type { ProductRepository } from "../repositories/index.ts";
import { err, type Result } from "../utils/result.ts";

export interface ProductAi {
  readonly createEmbedding: CreateEmbedding;
}

export interface ProductService {
  create: (product: NewProduct) => Promise<Result<Product>>;
  list: (search?: string) => Promise<Result<Product[] | ProductSearchResult[]>>;
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

  async function list(search?: string): Promise<Result<Product[] | ProductSearchResult[]>> {
    if (search === undefined) {
      return productRepository.list();
    }

    const textEmbedding = productSearchEmbeddingText(search);
    const [embedding, embeddingFailure] = await ai.createEmbedding(textEmbedding);

    if (embeddingFailure !== null) {
      return err(embeddingFailure);
    }

    return productRepository.search(embedding);
  }

  return { create, list };
}
