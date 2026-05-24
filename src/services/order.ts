import {
  type NewOrder,
  newOrderSchema,
  type Order,
  type UpdateOrder,
  updateOrderSchema,
} from "../entities/index.ts";
import type { OrderRepository } from "../repositories/index.ts";
import { err, type Result } from "../utils/result.ts";

export interface OrderService {
  create: (order: NewOrder) => Promise<Result<Order>>;
  delete: (id: string) => Promise<Result<Order>>;
  get: (id: string) => Promise<Result<Order>>;
  list: () => Promise<Result<Order[]>>;
  update: (id: string, order: UpdateOrder) => Promise<Result<Order>>;
}

export function NewOrderService(orderRepository: OrderRepository): OrderService {
  async function create(order: NewOrder): Promise<Result<Order>> {
    const parsedOrder = newOrderSchema.safeParse(order);

    if (!parsedOrder.success) {
      return err({
        cause: parsedOrder.error,
        code: "INVALID_ARGUMENT",
        details: parsedOrder.error.issues,
        expose: true,
        message: "Invalid order",
        origin: "INPUT",
      });
    }

    return orderRepository.create(parsedOrder.data);
  }

  async function update(id: string, order: UpdateOrder): Promise<Result<Order>> {
    const parsedOrder = updateOrderSchema.safeParse(order);

    if (!parsedOrder.success) {
      return err({
        cause: parsedOrder.error,
        code: "INVALID_ARGUMENT",
        details: parsedOrder.error.issues,
        expose: true,
        message: "Invalid order update",
        origin: "INPUT",
      });
    }

    return orderRepository.update(id, parsedOrder.data);
  }

  return {
    create,
    delete: orderRepository.delete,
    get: orderRepository.get,
    list: orderRepository.list,
    update,
  };
}
