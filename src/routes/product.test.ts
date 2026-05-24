import { describe, expect, test } from "bun:test";

import { errorResponseSchema, productResponseSchema } from "../dtos/index.ts";
import { createProductPayload, NewProductRouteTestSuite } from "../test/product-suite.ts";

describe("product routes", () => {
  const productSuite = NewProductRouteTestSuite();

  test("creates a product with an embedding", async () => {
    const response = await productSuite.postCreateProduct(createProductPayload);

    expect(response.status).toBe(201);

    const rawBody = (await response.json()) as Record<string, unknown>;
    const body = productResponseSchema.parse(rawBody);

    expect(body.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u,
    );
    expect(body.url).toBe(createProductPayload.url);
    expect(body.country).toBe(createProductPayload.country);
    expect(body.adValue).toBe(createProductPayload.adValue);
    expect(body.description).toBe(createProductPayload.description);
    expect(body.photoUrl).toBe(createProductPayload.photoUrl);
    expect(rawBody).not.toHaveProperty("embedding");
    expect(productSuite.ai().inputs).toEqual([
      [
        "type: product",
        `country: ${createProductPayload.country}`,
        `description: ${createProductPayload.description}`,
      ].join("\n"),
    ]);
    expect(await productSuite.countProducts()).toBe(1);
    expect(await productSuite.countProductsWithEmbedding()).toBe(1);
  });

  test("rejects malformed JSON", async () => {
    const response = await productSuite.postCreateProductJson("{");

    expect(response.status).toBe(400);

    const body = errorResponseSchema.parse(await response.json());

    expect(body.error.code).toBe("INVALID_ARGUMENT");
    expect(body.error.message).toBe("Invalid JSON body");
    expect(productSuite.ai().inputs).toEqual([]);
    expect(await productSuite.countProducts()).toBe(0);
  });

  test("rejects invalid product body before creating an embedding", async () => {
    const response = await productSuite.postCreateProduct({
      ...createProductPayload,
      country: "BRA",
      description: "",
    });

    expect(response.status).toBe(400);

    const body = errorResponseSchema.parse(await response.json());

    expect(body.error.code).toBe("INVALID_ARGUMENT");
    expect(body.error.message).toBe("Invalid product body");
    expect(productSuite.ai().inputs).toEqual([]);
    expect(await productSuite.countProducts()).toBe(0);
  });

  test("does not insert a product when embedding creation fails", async () => {
    productSuite.ai().failEmbeddingCreation();

    const response = await productSuite.postCreateProductSilencingErrors(createProductPayload);

    expect(response.status).toBe(502);

    const body = errorResponseSchema.parse(await response.json());

    expect(body.error.code).toBe("DEPENDENCY_FAILURE");
    expect(body.error.message).toBe("Internal server error");
    expect(productSuite.ai().inputs).toHaveLength(1);
    expect(await productSuite.countProducts()).toBe(0);
  });
});
