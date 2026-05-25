import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { z } from "zod";

import { err, ok, type Result } from "../utils/result.ts";
import { jsonFailure } from "./errors.ts";

export async function parseJsonBody(
  context: Context,
): Promise<Result<unknown>> {
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

export async function parseJsonRequestInput<Schema extends z.ZodType>(
  context: Context,
  schema: Schema,
  message: string,
): Promise<Result<z.output<Schema>>> {
  const [body, bodyFailure] = await parseJsonBody(context);

  if (bodyFailure !== null) {
    return err(bodyFailure);
  }

  return parseRequestInput(schema, body, message);
}

export function parseRequestInput<Schema extends z.ZodType>(
  schema: Schema,
  input: unknown,
  message: string,
): Result<z.output<Schema>> {
  const parsedInput = schema.safeParse(input);

  if (!parsedInput.success) {
    return err({
      cause: parsedInput.error,
      code: "INVALID_ARGUMENT",
      details: z.treeifyError(parsedInput.error),
      expose: true,
      message,
      origin: "INPUT",
    });
  }

  return ok(parsedInput.data);
}

export function jsonResult<Success>(
  context: Context,
  result: Result<Success>,
  status: ContentfulStatusCode = 200,
): Response {
  const [data, error] = result;

  if (error !== null) {
    return jsonFailure(context, error);
  }

  return context.json(data, status);
}
