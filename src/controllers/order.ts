import type { Context } from "hono";
import type { z } from "zod";

import {
  createOrderRequestSchema,
  orderParamsSchema,
  updateOrderRequestSchema,
} from "../dtos/index.ts";
import type { OrderService } from "../services/index.ts";
import type { Result } from "../utils/result.ts";
import {
  jsonResult,
  parseJsonRequestInput,
  parseRequestInput,
} from "./utils.ts";

export interface OrderController {
  readonly create: (context: Context) => Promise<Response>;
  readonly delete: (context: Context) => Promise<Response>;
  readonly get: (context: Context) => Promise<Response>;
  readonly list: (context: Context) => Promise<Response>;
  readonly update: (context: Context) => Promise<Response>;
}

function parseOrderParams(
  context: Context,
): Result<z.output<typeof orderParamsSchema>> {
  return parseRequestInput(
    orderParamsSchema,
    {
      id: context.req.param("id"),
    },
    "Invalid order params",
  );
}

export function NewOrderController(
  orderService: OrderService,
): OrderController {
  async function create(context: Context): Promise<Response> {
    const parsedBody = await parseJsonRequestInput(
      context,
      createOrderRequestSchema,
      "Invalid order body",
    );

    if (parsedBody[1] !== null) {
      return jsonResult(context, parsedBody);
    }

    return jsonResult(context, await orderService.create(parsedBody[0]), 201);
  }

  async function get(context: Context): Promise<Response> {
    const parsedParams = parseOrderParams(context);

    if (parsedParams[1] !== null) {
      return jsonResult(context, parsedParams);
    }

    return jsonResult(context, await orderService.get(parsedParams[0].id));
  }

  async function list(context: Context): Promise<Response> {
    return jsonResult(context, await orderService.list());
  }

  async function update(context: Context): Promise<Response> {
    const parsedParams = parseOrderParams(context);

    if (parsedParams[1] !== null) {
      return jsonResult(context, parsedParams);
    }

    const parsedBody = await parseJsonRequestInput(
      context,
      updateOrderRequestSchema,
      "Invalid order body",
    );

    if (parsedBody[1] !== null) {
      return jsonResult(context, parsedBody);
    }

    return jsonResult(
      context,
      await orderService.update(parsedParams[0].id, parsedBody[0]),
    );
  }

  async function deleteOrder(context: Context): Promise<Response> {
    const parsedParams = parseOrderParams(context);

    if (parsedParams[1] !== null) {
      return jsonResult(context, parsedParams);
    }

    return jsonResult(context, await orderService.delete(parsedParams[0].id));
  }

  return { create, delete: deleteOrder, get, list, update };
}
