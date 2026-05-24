import { beforeEach } from "bun:test";
import type { ModelMessage } from "ai";

import type { SellerAgent, SellerTools } from "../ai/agents/index.ts";
import {
  NewOrderRepository,
  NewProductRepository,
  NewSaleRepository,
} from "../repositories/index.ts";
import { NewRoutes } from "../routes/index.ts";
import {
  NewOrderService,
  NewProductService,
  NewSaleService,
  type OrderService,
} from "../services/index.ts";
import { type IntegrationSuite, NewIntegrationSuite } from "./integration-suite.ts";
import { createProductPayload, FakeProductAi } from "./product-suite.ts";

export interface SaleRouteTestSuite {
  readonly app: () => ReturnType<typeof NewRoutes>;
  readonly countOrders: () => Promise<number>;
  readonly countSaleMessages: () => Promise<number>;
  readonly countSaleSessions: () => Promise<number>;
  readonly createProduct: () => Promise<string>;
  readonly getEndedSessions: () => Promise<{ endedAt: string | null; orderId: string | null }[]>;
  readonly postSaleMessage: (sessionId: string, message: string) => Promise<Response>;
  readonly postStartSale: (message: string) => Promise<Response>;
}

function requireSuiteValue<Value>(value: Value | undefined, name: string): Value {
  if (value === undefined) {
    throw new Error(`${name} is not ready`);
  }

  return value;
}

function lastUserMessage(messages: readonly ModelMessage[]): string {
  const lastMessage = messages.at(-1);

  if (lastMessage?.role !== "user") {
    return "";
  }

  return typeof lastMessage.content === "string" ? lastMessage.content : "";
}

function newFakeSellerAgent(orderService: OrderService, productId: string): SellerAgent {
  return {
    id: "fake-seller-agent",
    tools: {} as SellerTools,
    version: "agent-v1",
    async generate({ messages }) {
      const userText = lastUserMessage(messages ?? []);

      if (userText.toLowerCase().includes("confirmar")) {
        const [order, orderFailure] = await orderService.create({
          customerName: "Maria Silva",
          productId,
        });

        if (orderFailure !== null) {
          throw orderFailure;
        }

        return {
          response: {
            messages: [{ content: "Venda confirmada.", role: "assistant" }],
          },
          steps: [
            {
              toolResults: [
                {
                  output: {
                    ok: true,
                    order,
                  },
                  toolName: "createOrder",
                  type: "tool-result",
                },
              ],
            },
          ],
          text: "Venda confirmada.",
        } as unknown as Awaited<ReturnType<SellerAgent["generate"]>>;
      }

      return {
        response: {
          messages: [{ content: "Encontrei uma boa opcao para voce.", role: "assistant" }],
        },
        steps: [],
        text: "Encontrei uma boa opcao para voce.",
      } as unknown as Awaited<ReturnType<SellerAgent["generate"]>>;
    },
    stream() {
      throw new Error("Fake seller agent does not stream");
    },
  };
}

function newSaleApp(
  integrationSuite: IntegrationSuite,
  selectedProductId: string,
): ReturnType<typeof NewRoutes> {
  const ai = new FakeProductAi();
  const productRepository = NewProductRepository(integrationSuite.db());
  const orderRepository = NewOrderRepository(integrationSuite.db());
  const saleRepository = NewSaleRepository(integrationSuite.db());
  const productService = NewProductService(ai, productRepository);
  const orderService = NewOrderService(orderRepository);
  const saleService = NewSaleService({
    saleRepository,
    sellerAgent: newFakeSellerAgent(orderService, selectedProductId),
  });

  return NewRoutes(productService, orderService, saleService);
}

export function NewSaleRouteTestSuite(): SaleRouteTestSuite {
  const integrationSuite = NewIntegrationSuite();
  let app: ReturnType<typeof NewRoutes> | undefined;
  let selectedProductId: string | undefined;

  beforeEach(async () => {
    await integrationSuite.truncateTables(["sale_messages", "sale_sessions", "orders", "products"]);

    selectedProductId = crypto.randomUUID();
    app = newSaleApp(integrationSuite, selectedProductId);
  });

  async function postJson(path: string, body: unknown): Promise<Response> {
    return requireSuiteValue(app, "Sale app").request(path, {
      body: JSON.stringify(body),
      headers: {
        "content-type": "application/json",
      },
      method: "POST",
    });
  }

  return {
    app(): ReturnType<typeof NewRoutes> {
      return requireSuiteValue(app, "Sale app");
    },
    async countOrders(): Promise<number> {
      return integrationSuite.countRows("orders");
    },
    async countSaleMessages(): Promise<number> {
      return integrationSuite.countRows("sale_messages");
    },
    async countSaleSessions(): Promise<number> {
      return integrationSuite.countRows("sale_sessions");
    },
    async createProduct(): Promise<string> {
      const response = await postJson("/products", createProductPayload);
      const body = (await response.json()) as { id: string };

      selectedProductId = body.id;
      app = newSaleApp(integrationSuite, selectedProductId);

      return body.id;
    },
    async getEndedSessions(): Promise<{ endedAt: string | null; orderId: string | null }[]> {
      return await integrationSuite.sql()<{ endedAt: string | null; orderId: string | null }[]>`
        select ended_at as "endedAt", order_id as "orderId"
        from sale_sessions
      `;
    },
    async postSaleMessage(sessionId: string, message: string): Promise<Response> {
      return postJson(`/sales/${sessionId}/messages`, { message });
    },
    async postStartSale(message: string): Promise<Response> {
      return postJson("/sales", { message });
    },
  };
}
