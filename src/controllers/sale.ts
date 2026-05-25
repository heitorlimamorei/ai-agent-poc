import type { Context } from "hono";

import {
  saleMessageRequestSchema,
  saleSessionParamsSchema,
} from "../dtos/index.ts";
import type { SaleService } from "../services/index.ts";
import { jsonResult } from "./errors.ts";
import { parseJsonRequestInput, parseRequestInput } from "./utils.ts";

export interface SaleController {
  readonly continueSession: (context: Context) => Promise<Response>;
  readonly startSession: (context: Context) => Promise<Response>;
}

export function NewSaleController(saleService: SaleService): SaleController {
  async function startSession(context: Context): Promise<Response> {
    const parsedBody = await parseJsonRequestInput(
      context,
      saleMessageRequestSchema,
      "Invalid sale message body",
    );

    if (parsedBody[1] !== null) {
      return jsonResult(context, parsedBody);
    }

    return jsonResult(
      context,
      await saleService.startSession(parsedBody[0]),
      201,
    );
  }

  async function continueSession(context: Context): Promise<Response> {
    const parsedParams = parseRequestInput(
      saleSessionParamsSchema,
      {
        sessionId: context.req.param("sessionId"),
      },
      "Invalid sale session params",
    );

    if (parsedParams[1] !== null) {
      return jsonResult(context, parsedParams);
    }

    const parsedBody = await parseJsonRequestInput(
      context,
      saleMessageRequestSchema,
      "Invalid sale message body",
    );

    if (parsedBody[1] !== null) {
      return jsonResult(context, parsedBody);
    }

    return jsonResult(
      context,
      await saleService.continueSession(
        parsedParams[0].sessionId,
        parsedBody[0],
      ),
    );
  }

  return { continueSession, startSession };
}
