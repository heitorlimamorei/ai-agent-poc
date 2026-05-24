import { swaggerUI } from "@hono/swagger-ui";
import { Hono } from "hono";
import { z } from "zod";

import {
  createOrderRequestSchema,
  createProductRequestSchema,
  errorResponseSchema,
  healthResponseSchema,
  listOrdersResponseSchema,
  listProductsResponseSchema,
  orderResponseSchema,
  productResponseSchema,
  saleMessageRequestSchema,
  saleMessageResponseSchema,
  updateOrderRequestSchema,
} from "../dtos/index.ts";

const openApiSchemaOptions = { target: "openapi-3.0" } as const;

const openApiDocument = {
  openapi: "3.0.3",
  info: {
    title: "AI Agent POC API",
    version: "1.0.0",
  },
  paths: {
    "/health": {
      get: {
        operationId: "getHealth",
        responses: {
          "200": {
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/HealthResponse",
                },
              },
            },
            description: "Service health status",
          },
        },
        summary: "Health check",
        tags: ["Health"],
      },
    },
    "/products": {
      get: {
        operationId: "listProducts",
        parameters: [
          {
            description:
              "Semantic search query. When present, returns the top 5 most similar products.",
            in: "query",
            name: "search",
            required: false,
            schema: {
              type: "string",
            },
          },
        ],
        responses: {
          "200": {
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ListProductsResponse",
                },
              },
            },
            description: "Products list",
          },
          "400": {
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
            description: "Invalid query",
          },
          "502": {
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
            description: "Dependency failure",
          },
        },
        summary: "List or search products",
        tags: ["Products"],
      },
      post: {
        operationId: "createProduct",
        requestBody: {
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/CreateProductRequest",
              },
            },
          },
          required: true,
        },
        responses: {
          "201": {
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/Product",
                },
              },
            },
            description: "Product created",
          },
          "400": {
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
            description: "Invalid request body",
          },
          "502": {
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
            description: "Dependency failure",
          },
        },
        summary: "Create product",
        tags: ["Products"],
      },
    },
    "/orders": {
      get: {
        operationId: "listOrders",
        responses: {
          "200": {
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ListOrdersResponse",
                },
              },
            },
            description: "Orders list",
          },
          "502": {
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
            description: "Dependency failure",
          },
        },
        summary: "List orders",
        tags: ["Orders"],
      },
      post: {
        operationId: "createOrder",
        requestBody: {
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/CreateOrderRequest",
              },
            },
          },
          required: true,
        },
        responses: {
          "201": {
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/Order",
                },
              },
            },
            description: "Order created",
          },
          "400": {
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
            description: "Invalid request body",
          },
          "502": {
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
            description: "Dependency failure",
          },
        },
        summary: "Create order",
        tags: ["Orders"],
      },
    },
    "/orders/{id}": {
      delete: {
        operationId: "deleteOrder",
        parameters: [
          {
            in: "path",
            name: "id",
            required: true,
            schema: {
              format: "uuid",
              type: "string",
            },
          },
        ],
        responses: {
          "200": {
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/Order",
                },
              },
            },
            description: "Order deleted",
          },
          "404": {
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
            description: "Order not found",
          },
        },
        summary: "Delete order",
        tags: ["Orders"],
      },
      get: {
        operationId: "getOrder",
        parameters: [
          {
            in: "path",
            name: "id",
            required: true,
            schema: {
              format: "uuid",
              type: "string",
            },
          },
        ],
        responses: {
          "200": {
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/Order",
                },
              },
            },
            description: "Order",
          },
          "404": {
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
            description: "Order not found",
          },
        },
        summary: "Get order",
        tags: ["Orders"],
      },
      patch: {
        operationId: "updateOrder",
        parameters: [
          {
            in: "path",
            name: "id",
            required: true,
            schema: {
              format: "uuid",
              type: "string",
            },
          },
        ],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/UpdateOrderRequest",
              },
            },
          },
          required: true,
        },
        responses: {
          "200": {
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/Order",
                },
              },
            },
            description: "Order updated",
          },
          "400": {
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
            description: "Invalid request body",
          },
          "404": {
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
            description: "Order not found",
          },
        },
        summary: "Update order",
        tags: ["Orders"],
      },
    },
    "/sales": {
      post: {
        operationId: "startSaleSession",
        requestBody: {
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/SaleMessageRequest",
              },
            },
          },
          required: true,
        },
        responses: {
          "201": {
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/SaleMessageResponse",
                },
              },
            },
            description: "Sale session started with an agent response",
          },
          "400": {
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
            description: "Invalid request body",
          },
          "502": {
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
            description: "Dependency failure",
          },
        },
        summary: "Start sale session",
        tags: ["Sales"],
      },
    },
    "/sales/{sessionId}/messages": {
      post: {
        operationId: "continueSaleSession",
        parameters: [
          {
            in: "path",
            name: "sessionId",
            required: true,
            schema: {
              format: "uuid",
              type: "string",
            },
          },
        ],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/SaleMessageRequest",
              },
            },
          },
          required: true,
        },
        responses: {
          "200": {
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/SaleMessageResponse",
                },
              },
            },
            description: "Agent response",
          },
          "400": {
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
            description: "Invalid request body",
          },
          "404": {
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
            description: "Sale session not found",
          },
          "412": {
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
            description: "Sale session already ended",
          },
          "502": {
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse",
                },
              },
            },
            description: "Dependency failure",
          },
        },
        summary: "Continue sale session",
        tags: ["Sales"],
      },
    },
  },
  components: {
    schemas: {
      CreateOrderRequest: z.toJSONSchema(createOrderRequestSchema, openApiSchemaOptions),
      CreateProductRequest: z.toJSONSchema(createProductRequestSchema, openApiSchemaOptions),
      ErrorResponse: z.toJSONSchema(errorResponseSchema, openApiSchemaOptions),
      HealthResponse: z.toJSONSchema(healthResponseSchema, openApiSchemaOptions),
      ListOrdersResponse: z.toJSONSchema(listOrdersResponseSchema, openApiSchemaOptions),
      ListProductsResponse: z.toJSONSchema(listProductsResponseSchema, openApiSchemaOptions),
      Order: z.toJSONSchema(orderResponseSchema, openApiSchemaOptions),
      Product: z.toJSONSchema(productResponseSchema, openApiSchemaOptions),
      SaleMessageRequest: z.toJSONSchema(saleMessageRequestSchema, openApiSchemaOptions),
      SaleMessageResponse: z.toJSONSchema(saleMessageResponseSchema, openApiSchemaOptions),
      UpdateOrderRequest: z.toJSONSchema(updateOrderRequestSchema, openApiSchemaOptions),
    },
  },
} as const;

export function NewOpenApiRouter(): Hono {
  const app = new Hono();

  app.get("/openapi.json", (context) => context.json(openApiDocument));
  app.get("/docs", swaggerUI({ title: "AI Agent POC API Docs", url: "/openapi.json" }));

  return app;
}
