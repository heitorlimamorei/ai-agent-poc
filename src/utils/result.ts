export type FailureCode =
  | "ALREADY_EXISTS"
  | "CANCELLED"
  | "CONFLICT"
  | "DEADLINE_EXCEEDED"
  | "DEPENDENCY_FAILURE"
  | "FAILED_PRECONDITION"
  | "INTERNAL"
  | "INVALID_ARGUMENT"
  | "NOT_FOUND"
  | "PERMISSION_DENIED"
  | "RESOURCE_EXHAUSTED"
  | "UNAUTHENTICATED"
  | "UNKNOWN";

export type FailureOrigin = "DEPENDENCY" | "DOMAIN" | "INPUT" | "SYSTEM" | "TRANSPORT";

export interface FailureInput {
  readonly cause?: unknown;
  readonly code: FailureCode;
  readonly details?: unknown;
  readonly expose?: boolean;
  readonly message: string;
  readonly origin: FailureOrigin;
}

export class Failure extends Error {
  readonly code: FailureCode;
  readonly details?: unknown;
  readonly expose: boolean;
  readonly origin: FailureOrigin;

  constructor(input: FailureInput) {
    super(input.message, { cause: input.cause });

    this.name = "Failure";
    this.code = input.code;
    this.expose = input.expose ?? false;
    this.origin = input.origin;

    if (input.details !== undefined) {
      this.details = input.details;
    }
  }
}

export type Result<Success> = [Success, null] | [null, Failure];

export function ok<Success>(value: Success): Result<Success> {
  return [value, null];
}

export function err(input: Failure | FailureInput): Result<never> {
  if (input instanceof Failure) {
    return [null, input];
  }

  return [null, failure(input)];
}

export function failure(input: FailureInput): Failure {
  return new Failure(input);
}

export function isFailure(error: unknown): error is Failure {
  return error instanceof Failure;
}
