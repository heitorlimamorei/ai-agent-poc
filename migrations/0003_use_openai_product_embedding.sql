DROP INDEX IF EXISTS "products_embedding_idx";--> statement-breakpoint
ALTER TABLE "products" DROP COLUMN "embedding";--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "embedding" vector(1536);--> statement-breakpoint
CREATE INDEX "products_embedding_idx" ON "products" USING hnsw ("embedding" vector_cosine_ops) WHERE "products"."embedding" is not null;
