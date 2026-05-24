import { sql } from "drizzle-orm";
import {
  char,
  check,
  index,
  pgTable,
  real,
  text,
  uuid,
  varchar,
  vector,
} from "drizzle-orm/pg-core";

export const products = pgTable(
  "products",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    url: varchar("url", { length: 2048 }).notNull(),
    country: char("country", { length: 2 }).notNull(),
    adValue: real("ad_value").notNull(),
    description: text("description").notNull(),
    photoUrl: varchar("photo_url", { length: 2048 }).notNull(),
    embedding: vector("embedding", { dimensions: 1536 }),
  },
  (table) => [
    check("products_country_iso_alpha_2_check", sql`${table.country} ~ '^[A-Z]{2}$'`),
    index("products_embedding_idx")
      .using("hnsw", table.embedding.op("vector_cosine_ops"))
      .where(sql`${table.embedding} is not null`),
  ],
);
