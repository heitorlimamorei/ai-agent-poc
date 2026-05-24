import { Hono } from "hono";

import type { ProductController } from "../controllers/product.ts";

export function NewProductRouter(productController: ProductController): Hono {
  const app = new Hono();

  app.get("/", productController.list);
  app.post("/", productController.create);

  return app;
}
