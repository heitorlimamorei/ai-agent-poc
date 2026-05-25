import type { Context } from "hono";
import type { HTTPException } from "hono/http-exception";
import { HTTPException as HonoHTTPException } from "hono/http-exception";
import type { ErrorHandler, NotFoundHandler } from "hono/types";
import type { ContentfulStatusCode } from "hono/utils/http-status";

import type { ErrorResponse } from "../dtos/index.ts";
import {
  type Failure,
  type FailureCode,
  failure,
  isFailure,
  type Result,
} from "../utils/result.ts";

const httpStatusByFailureCode = {
  ALREADY_EXISTS: 409,
  CANCELLED: 408,
  CONFLICT: 409,
  DEADLINE_EXCEEDED: 504,
  DEPENDENCY_FAILURE: 502,
  FAILED_PRECONDITION: 412,
  INTERNAL: 500,
  INVALID_ARGUMENT: 400,
  NOT_FOUND: 404,
  PERMISSION_DENIED: 403,
  RESOURCE_EXHAUSTED: 429,
  UNAUTHENTICATED: 401,
  UNKNOWN: 500,
} satisfies Record<FailureCode, ContentfulStatusCode>;

export function failureCodeFromHttpStatus(
  status: ContentfulStatusCode,
): FailureCode {
  if (status === 400 || status === 422) {
    return "INVALID_ARGUMENT";
  }

  if (status === 401) {
    return "UNAUTHENTICATED";
  }

  if (status === 403) {
    return "PERMISSION_DENIED";
  }

  if (status === 404) {
    return "NOT_FOUND";
  }

  if (status === 409) {
    return "CONFLICT";
  }

  if (status === 412) {
    return "FAILED_PRECONDITION";
  }

  if (status === 429) {
    return "RESOURCE_EXHAUSTED";
  }

  if (status === 504) {
    return "DEADLINE_EXCEEDED";
  }

  if (status === 500 || status === 502 || status === 503) {
    return "DEPENDENCY_FAILURE";
  }

  if (status >= 500) {
    return "INTERNAL";
  }

  return "UNKNOWN";
}

export function failureToHttpStatus(error: Failure): ContentfulStatusCode {
  return httpStatusByFailureCode[error.code];
}

export function errorResponseFromFailure(error: Failure): ErrorResponse {
  const message = error.expose ? error.message : "Internal server error";
  const details = error.expose ? error.details : undefined;

  if (details === undefined) {
    return {
      error: {
        code: error.code,
        message,
      },
    };
  }

  return {
    error: {
      code: error.code,
      details,
      message,
    },
  };
}

export function errorResponseFromHttpException(
  error: HTTPException,
): ErrorResponse {
  const status: ContentfulStatusCode = error.status;
  const message = status < 500 ? error.message : "Internal server error";

  return {
    error: {
      code: failureCodeFromHttpStatus(status),
      message,
    },
  };
}

export function failureFromUnknown(error: unknown): Failure {
  if (isFailure(error)) {
    return error;
  }

  return failure({
    cause: error,
    code: "INTERNAL",
    message: "Internal server error",
    origin: "SYSTEM",
  });
}

export function jsonFailure(context: Context, error: Failure): Response {
  if (!error.expose) {
    console.error(error);
  }

  return context.json(
    errorResponseFromFailure(error),
    failureToHttpStatus(error),
  );
}

export function jsonHttpException(
  context: Context,
  error: HTTPException,
): Response {
  return context.json(errorResponseFromHttpException(error), error.status);
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

export const errorHandler: ErrorHandler = (error, context): Response => {
  if (error instanceof HonoHTTPException) {
    return jsonHttpException(context, error);
  }

  console.error(error);

  return jsonFailure(context, failureFromUnknown(error));
};

export const notFoundHandler: NotFoundHandler = (context): Response =>
  jsonFailure(
    context,
    failure({
      code: "NOT_FOUND",
      details: {
        method: context.req.method,
        path: context.req.path,
      },
      expose: true,
      message: "Route not found",
      origin: "TRANSPORT",
    }),
  );
