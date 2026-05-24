import { Hono } from "hono";

import type { SaleController } from "../controllers/sale.ts";

export function NewSaleRouter(saleController: SaleController): Hono {
  const app = new Hono();

  app.post("/", saleController.startSession);
  app.post("/:sessionId/messages", saleController.continueSession);

  return app;
}
