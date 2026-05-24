import { describe, expect, test } from "bun:test";

import {
  errorResponseSchema,
  listProductsResponseSchema,
  productResponseSchema,
  productSearchResultResponseSchema,
} from "../dtos/index.ts";
import {
  createProductPayload,
  NewProductRouteTestSuite,
  newEmbeddingWithFirstValues,
} from "../test/product-suite.ts";
import { ok } from "../utils/result.ts";

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

  test("lists all products without creating a search embedding", async () => {
    await productSuite.postCreateProduct({
      ...createProductPayload,
      description: "Tenis leve para corrida de rua",
      url: "https://example.com/products/tenis-corrida",
    });
    await productSuite.postCreateProduct({
      ...createProductPayload,
      description: "Cafeteira compacta para preparar cafe",
      url: "https://example.com/products/cafeteira",
    });

    const response = await productSuite.getProducts();

    expect(response.status).toBe(200);

    const body = listProductsResponseSchema.parse(await response.json());

    expect(body).toHaveLength(2);
    expect(body.map((product) => product.url).sort()).toEqual([
      "https://example.com/products/cafeteira",
      "https://example.com/products/tenis-corrida",
    ]);
    expect(productSuite.ai().inputs).toHaveLength(2);
  });

  test("searches products by semantic similarity", async () => {
    productSuite.ai().setEmbeddingResult(ok(newEmbeddingWithFirstValues([1, 0])));
    await productSuite.postCreateProduct({
      ...createProductPayload,
      description: "Tenis leve para corrida de rua e caminhada",
      url: "https://example.com/products/tenis-corrida",
    });

    productSuite.ai().setEmbeddingResult(ok(newEmbeddingWithFirstValues([0, 1])));
    await productSuite.postCreateProduct({
      ...createProductPayload,
      description: "Cafeteira compacta para preparar cafe",
      url: "https://example.com/products/cafeteira",
    });

    productSuite.ai().setEmbeddingResult(ok(newEmbeddingWithFirstValues([0.5, 0.5])));
    await productSuite.postCreateProduct({
      ...createProductPayload,
      description: "Cadeira ergonomica para escritorio e home office",
      url: "https://example.com/products/cadeira-ergonomica",
    });

    productSuite.ai().setEmbeddingResult(ok(newEmbeddingWithFirstValues([1, 0])));

    const response = await productSuite.getProductsSearch("calcado para correr na rua");

    expect(response.status).toBe(200);

    const body = productSearchResultResponseSchema.array().parse(await response.json());

    expect(body.map((product) => product.url)).toEqual([
      "https://example.com/products/tenis-corrida",
      "https://example.com/products/cadeira-ergonomica",
      "https://example.com/products/cafeteira",
    ]);
    expect(body[0]?.score).toBeGreaterThan(body[1]?.score ?? 0);
    expect(body[1]?.score).toBeGreaterThan(body[2]?.score ?? 0);
    expect(productSuite.ai().inputs.at(-1)).toBe(
      ["type: product", "query: calcado para correr na rua"].join("\n"),
    );
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
