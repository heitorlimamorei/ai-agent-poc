import { describe, expect, test } from "bun:test";
import { z } from "zod";

import { errorResponseSchema, saleMessageResponseSchema } from "../dtos/index.ts";
import { NewSaleRouteTestSuite } from "../test/sale-suite.ts";

const saleSuite = NewSaleRouteTestSuite();
const persistedToolCallSchema = z.object({
  input: z.unknown().nullable(),
  output: z.unknown().nullable(),
  step: z.number(),
  toolName: z.string(),
});

describe("sale routes", () => {
  test("starts a sale session and persists the first turn", async () => {
    await saleSuite.createProduct();

    const response = await saleSuite.postStartSale("Procuro um produto para correr");

    expect(response.status).toBe(201);

    const body = saleMessageResponseSchema.parse(await response.json());

    expect(body.sessionId).toBeString();
    expect(body.response).toBe("Encontrei uma boa opcao para voce.");
    expect(body.endedAt).toBeNull();
    expect(body.orderId).toBeNull();
    expect(await saleSuite.countSaleSessions()).toBe(1);
    expect(await saleSuite.countSaleMessages()).toBe(2);
    expect(await saleSuite.countSaleMemoryEpisodes()).toBe(1);
  });

  test("continues a session with history and ends it when an order is created", async () => {
    await saleSuite.createProduct();

    const startResponse = await saleSuite.postStartSale("Procuro um produto para correr");
    const startedSale = saleMessageResponseSchema.parse(await startResponse.json());

    const continueResponse = await saleSuite.postSaleMessage(
      startedSale.sessionId,
      "Confirmar compra para Maria Silva",
    );

    expect(continueResponse.status).toBe(200);

    const body = saleMessageResponseSchema.parse(await continueResponse.json());

    expect(body.sessionId).toBe(startedSale.sessionId);
    expect(body.response).toBe("Venda confirmada.");
    expect(body.endedAt).not.toBeNull();
    expect(body.orderId).not.toBeNull();
    expect(await saleSuite.countOrders()).toBe(1);
    expect(await saleSuite.countSaleMessages()).toBe(4);
    expect(await saleSuite.countSaleMemoryEpisodes()).toBe(2);

    const [, orderMemoryEpisode] = await saleSuite.getSaleMemoryEpisodes();
    const [toolCall] = z.array(persistedToolCallSchema).parse(orderMemoryEpisode?.toolCalls);

    expect(toolCall?.toolName).toBe("createOrder");
    expect(toolCall?.output).toMatchObject({
      ok: true,
      order: {
        id: body.orderId,
      },
    });

    const [session] = await saleSuite.getEndedSessions();

    expect(Date.parse(session?.endedAt ?? "")).toBe(Date.parse(body.endedAt ?? ""));
    expect(session?.orderId).toBe(body.orderId);
  });

  test("rejects messages for ended sessions", async () => {
    await saleSuite.createProduct();

    const startResponse = await saleSuite.postStartSale("Procuro um produto para correr");
    const startedSale = saleMessageResponseSchema.parse(await startResponse.json());

    await saleSuite.postSaleMessage(startedSale.sessionId, "Confirmar compra para Maria Silva");

    const response = await saleSuite.postSaleMessage(startedSale.sessionId, "Outra mensagem");

    expect(response.status).toBe(412);

    const body = errorResponseSchema.parse(await response.json());

    expect(body.error.code).toBe("FAILED_PRECONDITION");
    expect(body.error.message).toBe("Sale session is already ended");
  });

  test("injects related episodic memory into text agent context", async () => {
    await saleSuite.createProduct();

    await saleSuite.postStartSale("Procuro um tenis para correr");
    await saleSuite.postStartSale("Quero um produto para corrida");

    const [, secondSessionBatch] = saleSuite.generatedMessageBatches();
    const memoryMessage = secondSessionBatch?.[0];

    expect(memoryMessage?.role).toBe("system");

    if (typeof memoryMessage?.content !== "string") {
      throw new Error("Expected memory context to be a text system message");
    }

    expect(memoryMessage.content).toContain("Memorias episodicas");
    expect(memoryMessage.content).toContain("Procuro um tenis para correr");
  });
});
