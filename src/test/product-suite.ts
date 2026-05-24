import { beforeEach } from "bun:test";

import type { CreateEmbedding } from "../adpters/ai.ts";
import { productEmbeddingDimensions } from "../entities/index.ts";
import { NewOrderRepository, NewProductRepository } from "../repositories/index.ts";
import { NewRoutes } from "../routes/index.ts";
import { NewOrderService, NewProductService, type ProductAi } from "../services/index.ts";
import { failure, ok, type Result } from "../utils/result.ts";
import { FakeSaleService } from "./fake-sale-service.ts";
import { type IntegrationSuite, NewIntegrationSuite } from "./integration-suite.ts";

export const createProductPayload = {
  adValue: 129.9,
  country: "BR",
  description: "Produto para teste de integracao",
  photoUrl: "https://example.com/product.jpg",
  url: "https://example.com/product",
};

export type CreateProductPayload = typeof createProductPayload;

export interface ProductRouteTestSuite {
  readonly ai: () => FakeProductAi;
  readonly countProducts: () => Promise<number>;
  readonly countProductsWithEmbedding: () => Promise<number>;
  readonly getProducts: () => Promise<Response>;
  readonly getProductsSearch: (search: string) => Promise<Response>;
  readonly postCreateProduct: (body: unknown) => Promise<Response>;
  readonly postCreateProductJson: (body: string) => Promise<Response>;
  readonly postCreateProductSilencingErrors: (body: unknown) => Promise<Response>;
}

export function newEmbedding(value: number): number[] {
  return Array.from({ length: productEmbeddingDimensions }, () => value);
}

export function newEmbeddingWithFirstValues(values: readonly number[]): number[] {
  return Array.from({ length: productEmbeddingDimensions }, (_, index) => values[index] ?? 0);
}

export class FakeProductAi implements ProductAi {
  readonly inputs: string[] = [];
  private embeddingResult: Result<number[]> = ok(newEmbedding(0.5));

  failEmbeddingCreation(): void {
    this.embeddingResult = [
      null,
      failure({
        code: "DEPENDENCY_FAILURE",
        message: "Failed to create embedding",
        origin: "DEPENDENCY",
      }),
    ];
  }

  setEmbeddingResult(result: Result<number[]>): void {
    this.embeddingResult = result;
  }

  readonly createEmbedding: CreateEmbedding = async (input: string): Promise<Result<number[]>> => {
    this.inputs.push(input);
    await Promise.resolve();

    return this.embeddingResult;
  };
}

async function withoutConsoleError<Success>(
  operation: () => Success | Promise<Success>,
): Promise<Success> {
  const originalConsoleError: typeof console.error = console.error;

  console.error = (): void => {
    // Intentionally silence expected error logs in this test branch.
  };

  try {
    return await operation();
  } finally {
    console.error = originalConsoleError;
  }
}

function requireSuiteValue<Value>(value: Value | undefined, name: string): Value {
  if (value === undefined) {
    throw new Error(`${name} is not ready`);
  }

  return value;
}

function newProductApp(integrationSuite: IntegrationSuite): {
  readonly ai: FakeProductAi;
  readonly app: ReturnType<typeof NewRoutes>;
} {
  const ai = new FakeProductAi();
  const productRepository = NewProductRepository(integrationSuite.db());
  const orderRepository = NewOrderRepository(integrationSuite.db());
  const productService = NewProductService(ai, productRepository);
  const orderService = NewOrderService(orderRepository);
  const app = NewRoutes(productService, orderService, new FakeSaleService());

  return { ai, app };
}

export function NewProductRouteTestSuite(): ProductRouteTestSuite {
  const integrationSuite = NewIntegrationSuite();
  let ai: FakeProductAi | undefined;
  let app: ReturnType<typeof NewRoutes> | undefined;

  beforeEach(async () => {
    await integrationSuite.truncateTables(["sale_messages", "sale_sessions", "orders", "products"]);

    const testApp = newProductApp(integrationSuite);

    ai = testApp.ai;
    app = testApp.app;
  });

  async function postCreateProductJson(body: string): Promise<Response> {
    return requireSuiteValue(app, "Product app").request("/products", {
      body,
      headers: {
        "content-type": "application/json",
      },
      method: "POST",
    });
  }

  async function postCreateProduct(body: unknown): Promise<Response> {
    return postCreateProductJson(JSON.stringify(body));
  }

  async function postCreateProductSilencingErrors(body: unknown): Promise<Response> {
    return withoutConsoleError(async (): Promise<Response> => postCreateProduct(body));
  }

  return {
    ai(): FakeProductAi {
      return requireSuiteValue(ai, "Fake product AI");
    },
    async countProducts(): Promise<number> {
      return integrationSuite.countRows("products");
    },
    async countProductsWithEmbedding(): Promise<number> {
      const rows = await integrationSuite.sql()<
        {
          count: string;
        }[]
      >`select count(*)::text as count from products where embedding is not null`;
      const [row] = rows;

      if (row === undefined) {
        throw new Error("Failed to count products with embedding");
      }

      return Number.parseInt(row.count, 10);
    },
    async getProducts(): Promise<Response> {
      return requireSuiteValue(app, "Product app").request("/products");
    },
    async getProductsSearch(search: string): Promise<Response> {
      const searchParams = new URLSearchParams({ search });

      return requireSuiteValue(app, "Product app").request(`/products?${searchParams.toString()}`);
    },
    postCreateProduct,
    postCreateProductJson,
    postCreateProductSilencingErrors,
  };
}
