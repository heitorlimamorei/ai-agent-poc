import { beforeEach } from "bun:test";

import { NewOrderRepository, NewProductRepository } from "../repositories/index.ts";
import { NewRoutes } from "../routes/index.ts";
import { NewOrderService, NewProductService } from "../services/index.ts";
import { FakeSaleService } from "./fake-sale-service.ts";
import { type IntegrationSuite, NewIntegrationSuite } from "./integration-suite.ts";
import { createProductPayload, FakeProductAi } from "./product-suite.ts";

export interface OrderRouteTestSuite {
  readonly app: () => ReturnType<typeof NewRoutes>;
  readonly countOrders: () => Promise<number>;
  readonly createProduct: () => Promise<string>;
  readonly deleteOrder: (id: string) => Promise<Response>;
  readonly getOrder: (id: string) => Promise<Response>;
  readonly getOrders: () => Promise<Response>;
  readonly patchOrder: (id: string, body: unknown) => Promise<Response>;
  readonly postOrder: (body: unknown) => Promise<Response>;
}

function requireSuiteValue<Value>(value: Value | undefined, name: string): Value {
  if (value === undefined) {
    throw new Error(`${name} is not ready`);
  }

  return value;
}

function newOrderApp(integrationSuite: IntegrationSuite): ReturnType<typeof NewRoutes> {
  const ai = new FakeProductAi();
  const productRepository = NewProductRepository(integrationSuite.db());
  const orderRepository = NewOrderRepository(integrationSuite.db());
  const productService = NewProductService(ai, productRepository);
  const orderService = NewOrderService(orderRepository);

  return NewRoutes(productService, orderService, new FakeSaleService());
}

export function NewOrderRouteTestSuite(): OrderRouteTestSuite {
  const integrationSuite = NewIntegrationSuite();
  let app: ReturnType<typeof NewRoutes> | undefined;

  beforeEach(async () => {
    await integrationSuite.truncateTables(["sale_messages", "sale_sessions", "orders", "products"]);

    app = newOrderApp(integrationSuite);
  });

  async function postJson(path: string, body: unknown, method = "POST"): Promise<Response> {
    return requireSuiteValue(app, "Order app").request(path, {
      body: JSON.stringify(body),
      headers: {
        "content-type": "application/json",
      },
      method,
    });
  }

  return {
    app(): ReturnType<typeof NewRoutes> {
      return requireSuiteValue(app, "Order app");
    },
    async countOrders(): Promise<number> {
      return integrationSuite.countRows("orders");
    },
    async createProduct(): Promise<string> {
      const response = await postJson("/products", createProductPayload);
      const body = (await response.json()) as { id: string };

      return body.id;
    },
    async deleteOrder(id: string): Promise<Response> {
      return requireSuiteValue(app, "Order app").request(`/orders/${id}`, {
        method: "DELETE",
      });
    },
    async getOrder(id: string): Promise<Response> {
      return requireSuiteValue(app, "Order app").request(`/orders/${id}`);
    },
    async getOrders(): Promise<Response> {
      return requireSuiteValue(app, "Order app").request("/orders");
    },
    async patchOrder(id: string, body: unknown): Promise<Response> {
      return postJson(`/orders/${id}`, body, "PATCH");
    },
    async postOrder(body: unknown): Promise<Response> {
      return postJson("/orders", body);
    },
  };
}
