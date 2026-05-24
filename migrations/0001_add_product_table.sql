CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"url" varchar(2048) NOT NULL,
	"country" char(2) NOT NULL,
	"ad_value" real NOT NULL,
	"description" text NOT NULL,
	"photo_url" varchar(2048) NOT NULL,
	CONSTRAINT "products_country_iso_alpha_2_check" CHECK ("products"."country" ~ '^[A-Z]{2}$')
);
