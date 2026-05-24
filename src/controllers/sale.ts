import type { Context } from "hono";
import { z } from "zod";

import { saleMessageRequestSchema, saleSessionParamsSchema } from "../dtos/index.ts";
import type { SaleService } from "../services/index.ts";
import { err, ok, type Result } from "../utils/result.ts";
import { jsonResult } from "./errors.ts";

export interface SaleController {
  readonly continueSession: (context: Context) => Promise<Response>;
  readonly startSession: (context: Context) => Promise<Response>;
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

export function NewSaleController(saleService: SaleService): SaleController {
  async function startSession(context: Context): Promise<Response> {
    const [body, bodyFailure] = await parseJsonBody(context);

    if (bodyFailure !== null) {
      return jsonResult(context, err(bodyFailure));
    }

    const parsedBody = saleMessageRequestSchema.safeParse(body);

    if (!parsedBody.success) {
      return jsonResult(
        context,
        err({
          cause: parsedBody.error,
          code: "INVALID_ARGUMENT",
          details: z.treeifyError(parsedBody.error),
          expose: true,
          message: "Invalid sale message body",
          origin: "INPUT",
        }),
      );
    }

    return jsonResult(context, await saleService.startSession(parsedBody.data), 201);
  }

  async function continueSession(context: Context): Promise<Response> {
    const parsedParams = saleSessionParamsSchema.safeParse({
      sessionId: context.req.param("sessionId"),
    });

    if (!parsedParams.success) {
      return jsonResult(
        context,
        err({
          cause: parsedParams.error,
          code: "INVALID_ARGUMENT",
          details: z.treeifyError(parsedParams.error),
          expose: true,
          message: "Invalid sale session params",
          origin: "INPUT",
        }),
      );
    }

    const [body, bodyFailure] = await parseJsonBody(context);

    if (bodyFailure !== null) {
      return jsonResult(context, err(bodyFailure));
    }

    const parsedBody = saleMessageRequestSchema.safeParse(body);

    if (!parsedBody.success) {
      return jsonResult(
        context,
        err({
          cause: parsedBody.error,
          code: "INVALID_ARGUMENT",
          details: z.treeifyError(parsedBody.error),
          expose: true,
          message: "Invalid sale message body",
          origin: "INPUT",
        }),
      );
    }

    return jsonResult(
      context,
      await saleService.continueSession(parsedParams.data.sessionId, parsedBody.data),
    );
  }

  return { continueSession, startSession };
}
