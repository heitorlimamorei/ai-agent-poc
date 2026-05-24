import { swaggerUI } from "@hono/swagger-ui";
import { Hono } from "hono";
import { z } from "zod";

import {
  createProductRequestSchema,
  errorResponseSchema,
  healthResponseSchema,
  listProductsResponseSchema,
  productResponseSchema,
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
  },
  components: {
    schemas: {
      CreateProductRequest: z.toJSONSchema(createProductRequestSchema, openApiSchemaOptions),
      ErrorResponse: z.toJSONSchema(errorResponseSchema, openApiSchemaOptions),
      HealthResponse: z.toJSONSchema(healthResponseSchema, openApiSchemaOptions),
      ListProductsResponse: z.toJSONSchema(listProductsResponseSchema, openApiSchemaOptions),
      Product: z.toJSONSchema(productResponseSchema, openApiSchemaOptions),
    },
  },
} as const;

export function NewOpenApiRouter(): Hono {
  const app = new Hono();

  app.get("/openapi.json", (context) => context.json(openApiDocument));
  app.get("/docs", swaggerUI({ title: "AI Agent POC API Docs", url: "/openapi.json" }));

  return app;
}
