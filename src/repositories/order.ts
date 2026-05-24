import { desc, eq } from "drizzle-orm";

import type { DrizzleDatabase } from "../adpters/drizzle.ts";
import { orders } from "../database/schema.ts";
import {
  type NewOrder,
  newOrderToRecord,
  type Order,
  orderFromRecord,
  type UpdateOrder,
  updateOrderToRecord,
} from "../entities/index.ts";
import { err, ok, type Result } from "../utils/result.ts";

export interface OrderRepository {
  create: (order: NewOrder) => Promise<Result<Order>>;
  delete: (id: string) => Promise<Result<Order>>;
  get: (id: string) => Promise<Result<Order>>;
  list: () => Promise<Result<Order[]>>;
  update: (id: string, order: UpdateOrder) => Promise<Result<Order>>;
}

function hasErrorCode(error: unknown, code: string): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  if ("code" in error && error.code === code) {
    return true;
  }

  return "cause" in error && hasErrorCode(error.cause, code);
}

function isForeignKeyViolation(error: unknown): boolean {
  return hasErrorCode(error, "23503");
}

function dependencyFailure(error: unknown, message: string): Result<never> {
  if (isForeignKeyViolation(error)) {
    return err({
      cause: error,
      code: "INVALID_ARGUMENT",
      expose: true,
      message: "Product not found",
      origin: "INPUT",
    });
  }

  return err({
    cause: error,
    code: "DEPENDENCY_FAILURE",
    message,
    origin: "DEPENDENCY",
  });
}

export function NewOrderRepository(db: DrizzleDatabase): OrderRepository {
  const orderColumns = {
    createdAt: orders.createdAt,
    customerName: orders.customerName,
    id: orders.id,
    productId: orders.productId,
  };

  async function create(order: NewOrder): Promise<Result<Order>> {
    const [validOrderRecord, invalidOrderFailure] = newOrderToRecord(order);

    if (invalidOrderFailure !== null) {
      return [null, invalidOrderFailure];
    }

    let orderRecord: unknown;

    try {
      const [createdOrderRecord] = await db
        .insert(orders)
        .values(validOrderRecord)
        .returning(orderColumns);

      if (createdOrderRecord === undefined) {
        return err({
          code: "INTERNAL",
          message: "Failed to create order",
          origin: "SYSTEM",
        });
      }

      orderRecord = createdOrderRecord;
    } catch (error) {
      return dependencyFailure(error, "Failed to create order");
    }

    return orderFromRecord(orderRecord);
  }

  async function get(id: string): Promise<Result<Order>> {
    let orderRecord: unknown;

    try {
      const [selectedOrderRecord] = await db
        .select(orderColumns)
        .from(orders)
        .where(eq(orders.id, id))
        .limit(1);

      if (selectedOrderRecord === undefined) {
        return err({
          code: "NOT_FOUND",
          expose: true,
          message: "Order not found",
          origin: "DOMAIN",
        });
      }

      orderRecord = selectedOrderRecord;
    } catch (error) {
      return dependencyFailure(error, "Failed to get order");
    }

    return orderFromRecord(orderRecord);
  }

  async function list(): Promise<Result<Order[]>> {
    let orderRecords: unknown[];

    try {
      orderRecords = await db.select(orderColumns).from(orders).orderBy(desc(orders.createdAt));
    } catch (error) {
      return dependencyFailure(error, "Failed to list orders");
    }

    const parsedOrders: Order[] = [];

    for (const orderRecord of orderRecords) {
      const [order, orderFailure] = orderFromRecord(orderRecord);

      if (orderFailure !== null) {
        return err(orderFailure);
      }

      parsedOrders.push(order);
    }

    return ok(parsedOrders);
  }

  async function update(id: string, order: UpdateOrder): Promise<Result<Order>> {
    const [validOrderRecord, invalidOrderFailure] = updateOrderToRecord(order);

    if (invalidOrderFailure !== null) {
      return [null, invalidOrderFailure];
    }

    let orderRecord: unknown;

    try {
      const [updatedOrderRecord] = await db
        .update(orders)
        .set(validOrderRecord)
        .where(eq(orders.id, id))
        .returning(orderColumns);

      if (updatedOrderRecord === undefined) {
        return err({
          code: "NOT_FOUND",
          expose: true,
          message: "Order not found",
          origin: "DOMAIN",
        });
      }

      orderRecord = updatedOrderRecord;
    } catch (error) {
      return dependencyFailure(error, "Failed to update order");
    }

    return orderFromRecord(orderRecord);
  }

  async function deleteOrder(id: string): Promise<Result<Order>> {
    let orderRecord: unknown;

    try {
      const [deletedOrderRecord] = await db
        .delete(orders)
        .where(eq(orders.id, id))
        .returning(orderColumns);

      if (deletedOrderRecord === undefined) {
        return err({
          code: "NOT_FOUND",
          expose: true,
          message: "Order not found",
          origin: "DOMAIN",
        });
      }

      orderRecord = deletedOrderRecord;
    } catch (error) {
      return dependencyFailure(error, "Failed to delete order");
    }

    return orderFromRecord(orderRecord);
  }

  return { create, delete: deleteOrder, get, list, update };
}
