import { err, type Result } from "../utils/result.ts";

export function saleDependencyFailure(error: unknown, message: string): Result<never> {
  return err({
    cause: error,
    code: "DEPENDENCY_FAILURE",
    message,
    origin: "DEPENDENCY",
  });
}
