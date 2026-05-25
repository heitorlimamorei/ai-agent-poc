CREATE TABLE "sale_memory_episodes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"user_message" text NOT NULL,
	"assistant_response" text NOT NULL,
	"order_id" uuid,
	"tool_calls" jsonb NOT NULL,
	"embedding" vector(1536) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sale_memory_episodes" ADD CONSTRAINT "sale_memory_episodes_session_id_sale_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sale_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_memory_episodes" ADD CONSTRAINT "sale_memory_episodes_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sale_memory_episodes_embedding_idx" ON "sale_memory_episodes" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "sale_memory_episodes_session_idx" ON "sale_memory_episodes" USING btree ("session_id");
