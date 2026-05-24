import { z } from "zod";

import { type Failure, failure, isFailure } from "../../utils/result.ts";

export const toolFailureCodeSchema = z.enum([
  "ALREADY_EXISTS",
  "CANCELLED",
  "CONFLICT",
  "DEADLINE_EXCEEDED",
  "DEPENDENCY_FAILURE",
  "FAILED_PRECONDITION",
  "INTERNAL",
  "INVALID_ARGUMENT",
  "NOT_FOUND",
  "PERMISSION_DENIED",
  "RESOURCE_EXHAUSTED",
  "UNAUTHENTICATED",
  "UNKNOWN",
]);

export const toolFailureOriginSchema = z.enum([
  "DEPENDENCY",
  "DOMAIN",
  "INPUT",
  "SYSTEM",
  "TRANSPORT",
]);

export const toolErrorSchema = z.object({
  code: toolFailureCodeSchema,
  details: z.unknown().optional(),
  message: z.string(),
  origin: toolFailureOriginSchema,
  retryable: z.boolean(),
});

export const toolFailureOutputSchema = z.object({
  error: toolErrorSchema,
  ok: z.literal(false),
});

export type ToolError = z.infer<typeof toolErrorSchema>;
export type ToolFailureOutput = z.infer<typeof toolFailureOutputSchema>;

export interface ToolErrorOptions {
  readonly fallbackMessage: string;
}

function isRetryableFailure(error: Failure): boolean {
  return (
    error.code === "CANCELLED" ||
    error.code === "DEADLINE_EXCEEDED" ||
    error.code === "DEPENDENCY_FAILURE" ||
    error.code === "RESOURCE_EXHAUSTED" ||
    error.origin === "DEPENDENCY" ||
    error.origin === "TRANSPORT"
  );
}

export function toolErrorFromFailure(error: Failure, options: ToolErrorOptions): ToolError {
  return {
    code: error.code,
    ...(error.expose && error.details !== undefined ? { details: error.details } : {}),
    message: error.expose ? error.message : options.fallbackMessage,
    origin: error.origin,
    retryable: isRetryableFailure(error),
  };
}

export function toolErrorFromUnknown(error: unknown, options: ToolErrorOptions): ToolError {
  if (isFailure(error)) {
    return toolErrorFromFailure(error, options);
  }

  return toolErrorFromFailure(
    failure({
      cause: error,
      code: "UNKNOWN",
      message: options.fallbackMessage,
      origin: "SYSTEM",
    }),
    options,
  );
}

export function toolFailureFromFailure(
  error: Failure,
  options: ToolErrorOptions,
): ToolFailureOutput {
  return {
    error: toolErrorFromFailure(error, options),
    ok: false,
  };
}

export function toolFailureFromUnknown(
  error: unknown,
  options: ToolErrorOptions,
): ToolFailureOutput {
  return {
    error: toolErrorFromUnknown(error, options),
    ok: false,
  };
}
