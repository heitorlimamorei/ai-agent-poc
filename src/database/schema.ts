import { sql } from "drizzle-orm";
import {
  char,
  check,
  halfvec,
  index,
  pgTable,
  real,
  text,
  uuid,
  varchar,
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
    embedding: halfvec("embedding", { dimensions: 3072 }),
  },
  (table) => [
    check("products_country_iso_alpha_2_check", sql`${table.country} ~ '^[A-Z]{2}$'`),
    index("products_embedding_idx")
      .using("hnsw", table.embedding.op("halfvec_cosine_ops"))
      .where(sql`${table.embedding} is not null`),
  ],
);
