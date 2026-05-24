import { Hono } from "hono";
import { logger } from "hono/logger";

import {
  errorHandler,
  NewHealthHandler,
  NewProductController,
  notFoundHandler,
} from "../controllers/index.ts";
import type { ProductService } from "../services/index.ts";
import { NewOpenApiRouter } from "./openapi.ts";
import { NewProductRouter } from "./product.ts";

export function NewRoutes(productService: ProductService): Hono {
  const app = new Hono();

  app.use(
    "*",
    logger((message, ...rest) => {
      console.log(`[http] ${message}`, ...rest);
    }),
  );

  app.onError(errorHandler);

  app.notFound(notFoundHandler);

  const productController = NewProductController(productService);

  app.route("/", NewOpenApiRouter());
  app.get("/health", NewHealthHandler());
  app.route("/products", NewProductRouter(productController));

  return app;
}
