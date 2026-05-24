ALTER TABLE "products" ADD COLUMN "embedding" halfvec(3072);--> statement-breakpoint
CREATE INDEX "products_embedding_idx" ON "products" USING hnsw ("embedding" halfvec_cosine_ops) WHERE "products"."embedding" is not null;
