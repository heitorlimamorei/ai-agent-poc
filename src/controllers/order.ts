import type { Context } from "hono";
import { z } from "zod";

import {
  createOrderRequestSchema,
  orderParamsSchema,
  updateOrderRequestSchema,
} from "../dtos/index.ts";
import type { OrderService } from "../services/index.ts";
import { err, ok, type Result } from "../utils/result.ts";
import { jsonResult } from "./errors.ts";

export interface OrderController {
  readonly create: (context: Context) => Promise<Response>;
  readonly delete: (context: Context) => Promise<Response>;
  readonly get: (context: Context) => Promise<Response>;
  readonly list: (context: Context) => Promise<Response>;
  readonly update: (context: Context) => Promise<Response>;
}

async function parseJsonBody(context: Context): Promise<Result<unknown>> {
  try {
    return ok(await context.req.json());
  } catch (error) {
    return err({
      cause: error,
      code: "INVALID_ARGUMENT",
      expose: true,
      message: "Invalid JSON body",
      origin: "TRANSPORT",
    });
  }
}

function parseOrderParams(context: Context): ReturnType<(typeof orderParamsSchema)["safeParse"]> {
  return orderParamsSchema.safeParse({
    id: context.req.param("id"),
  });
}

export function NewOrderController(orderService: OrderService): OrderController {
  async function create(context: Context): Promise<Response> {
    const [body, bodyFailure] = await parseJsonBody(context);

    if (bodyFailure !== null) {
      return jsonResult(context, err(bodyFailure));
    }

    const parsedBody = createOrderRequestSchema.safeParse(body);

    if (!parsedBody.success) {
      return jsonResult(
        context,
        err({
          cause: parsedBody.error,
          code: "INVALID_ARGUMENT",
          details: z.treeifyError(parsedBody.error),
          expose: true,
          message: "Invalid order body",
          origin: "INPUT",
        }),
      );
    }

    return jsonResult(context, await orderService.create(parsedBody.data), 201);
  }

  async function get(context: Context): Promise<Response> {
    const parsedParams = parseOrderParams(context);

    if (!parsedParams.success) {
      return jsonResult(
        context,
        err({
          cause: parsedParams.error,
          code: "INVALID_ARGUMENT",
          details: z.treeifyError(parsedParams.error),
          expose: true,
          message: "Invalid order params",
          origin: "INPUT",
        }),
      );
    }

    return jsonResult(context, await orderService.get(parsedParams.data.id));
  }

  async function list(context: Context): Promise<Response> {
    return jsonResult(context, await orderService.list());
  }

  async function update(context: Context): Promise<Response> {
    const parsedParams = parseOrderParams(context);

    if (!parsedParams.success) {
      return jsonResult(
        context,
        err({
          cause: parsedParams.error,
          code: "INVALID_ARGUMENT",
          details: z.treeifyError(parsedParams.error),
          expose: true,
          message: "Invalid order params",
          origin: "INPUT",
        }),
      );
    }

    const [body, bodyFailure] = await parseJsonBody(context);

    if (bodyFailure !== null) {
      return jsonResult(context, err(bodyFailure));
    }

    const parsedBody = updateOrderRequestSchema.safeParse(body);

    if (!parsedBody.success) {
      return jsonResult(
        context,
        err({
          cause: parsedBody.error,
          code: "INVALID_ARGUMENT",
          details: z.treeifyError(parsedBody.error),
          expose: true,
          message: "Invalid order body",
          origin: "INPUT",
        }),
      );
    }

    return jsonResult(context, await orderService.update(parsedParams.data.id, parsedBody.data));
  }

  async function deleteOrder(context: Context): Promise<Response> {
    const parsedParams = parseOrderParams(context);

    if (!parsedParams.success) {
      return jsonResult(
        context,
        err({
          cause: parsedParams.error,
          code: "INVALID_ARGUMENT",
          details: z.treeifyError(parsedParams.error),
          expose: true,
          message: "Invalid order params",
          origin: "INPUT",
        }),
      );
    }

    return jsonResult(context, await orderService.delete(parsedParams.data.id));
  }

  return { create, delete: deleteOrder, get, list, update };
}
