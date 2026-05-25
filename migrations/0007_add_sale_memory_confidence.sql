ALTER TABLE "sale_memory_episodes" ADD COLUMN "confidence" real;--> statement-breakpoint
UPDATE "sale_memory_episodes"
SET "confidence" = CASE
	WHEN "order_id" IS NOT NULL THEN 0.8
	WHEN jsonb_array_length("tool_calls") > 0 THEN 0.55
	ELSE 0.35
END;--> statement-breakpoint
ALTER TABLE "sale_memory_episodes" ALTER COLUMN "confidence" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "sale_memory_episodes" ADD CONSTRAINT "sale_memory_episodes_confidence_check" CHECK ("sale_memory_episodes"."confidence" >= 0 and "sale_memory_episodes"."confidence" <= 1);
