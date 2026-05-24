import { describe, expect, test } from "bun:test";

import { errorResponseSchema, orderResponseSchema } from "../dtos/index.ts";
import { NewOrderRouteTestSuite } from "../test/order-suite.ts";

const orderSuite = NewOrderRouteTestSuite();

describe("order routes", () => {
  test("creates an order for a product", async () => {
    const productId = await orderSuite.createProduct();

    const response = await orderSuite.postOrder({
      customerName: "Maria Silva",
      productId,
    });

    expect(response.status).toBe(201);

    const body = orderResponseSchema.parse(await response.json());

    expect(body.customerName).toBe("Maria Silva");
    expect(body.productId).toBe(productId);
    expect(Date.parse(body.createdAt)).not.toBeNaN();
    expect(await orderSuite.countOrders()).toBe(1);
  });

  test("lists, gets, updates, and deletes an order", async () => {
    const productId = await orderSuite.createProduct();
    const createResponse = await orderSuite.postOrder({
      customerName: "Maria Silva",
      productId,
    });
    const createdOrder = orderResponseSchema.parse(await createResponse.json());

    const listResponse = await orderSuite.getOrders();
    const orders = orderResponseSchema.array().parse(await listResponse.json());

    expect(listResponse.status).toBe(200);
    expect(orders).toHaveLength(1);
    expect(orders[0]?.id).toBe(createdOrder.id);

    const getResponse = await orderSuite.getOrder(createdOrder.id);
    const foundOrder = orderResponseSchema.parse(await getResponse.json());

    expect(getResponse.status).toBe(200);
    expect(foundOrder.id).toBe(createdOrder.id);

    const updateResponse = await orderSuite.patchOrder(createdOrder.id, {
      customerName: "Joao Souza",
    });
    const updatedOrder = orderResponseSchema.parse(await updateResponse.json());

    expect(updateResponse.status).toBe(200);
    expect(updatedOrder.customerName).toBe("Joao Souza");
    expect(updatedOrder.productId).toBe(productId);

    const deleteResponse = await orderSuite.deleteOrder(createdOrder.id);
    const deletedOrder = orderResponseSchema.parse(await deleteResponse.json());

    expect(deleteResponse.status).toBe(200);
    expect(deletedOrder.id).toBe(createdOrder.id);
    expect(await orderSuite.countOrders()).toBe(0);
  });

  test("rejects order creation for an unknown product", async () => {
    const response = await orderSuite.postOrder({
      customerName: "Maria Silva",
      productId: crypto.randomUUID(),
    });

    expect(response.status).toBe(400);

    const body = errorResponseSchema.parse(await response.json());

    expect(body.error.code).toBe("INVALID_ARGUMENT");
    expect(body.error.message).toBe("Product not found");
    expect(await orderSuite.countOrders()).toBe(0);
  });
});
