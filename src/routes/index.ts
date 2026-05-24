import { Hono } from "hono";
import { logger } from "hono/logger";

import {
  errorHandler,
  NewHealthHandler,
  NewOrderController,
  NewProductController,
  NewSaleController,
  notFoundHandler,
} from "../controllers/index.ts";
import type { OrderService, ProductService, SaleService } from "../services/index.ts";
import { NewOpenApiRouter } from "./openapi.ts";
import { NewOrderRouter } from "./order.ts";
import { NewProductRouter } from "./product.ts";
import { NewSaleRouter } from "./sale.ts";

export function NewRoutes(
  productService: ProductService,
  orderService: OrderService,
  saleService: SaleService,
): Hono {
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
  const orderController = NewOrderController(orderService);
  const saleController = NewSaleController(saleService);

  app.route("/", NewOpenApiRouter());
  app.get("/health", NewHealthHandler());
  app.route("/products", NewProductRouter(productController));
  app.route("/orders", NewOrderRouter(orderController));
  app.route("/sales", NewSaleRouter(saleController));

  return app;
}
