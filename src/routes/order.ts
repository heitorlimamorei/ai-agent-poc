import { Hono } from "hono";

import type { OrderController } from "../controllers/order.ts";

export function NewOrderRouter(orderController: OrderController): Hono {
  const app = new Hono();

  app.get("/", orderController.list);
  app.post("/", orderController.create);
  app.get("/:id", orderController.get);
  app.patch("/:id", orderController.update);
  app.delete("/:id", orderController.delete);

  return app;
}
