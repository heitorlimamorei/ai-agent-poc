import type { Context } from "hono";

import type { HealthResponse } from "../dtos/index.ts";

export function NewHealthHandler() {
  return (context: Context): Response => {
    const body: HealthResponse = {
      status: "ok",
      timestamp: new Date().toISOString(),
    };

    return context.json(body);
  };
}
