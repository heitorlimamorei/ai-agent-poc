import { sql } from "drizzle-orm";
import {
  char,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
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

export const orders = pgTable("orders", {
  id: uuid("id").defaultRandom().primaryKey(),
  customerName: varchar("customer_name", { length: 255 }).notNull(),
  productId: uuid("product_id")
    .notNull()
    .references(() => products.id),
  createdAt: timestamp("created_at", {
    mode: "string",
    withTimezone: true,
  })
    .defaultNow()
    .notNull(),
});

export const saleSessions = pgTable("sale_sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  startedAt: timestamp("started_at", {
    mode: "string",
    withTimezone: true,
  })
    .defaultNow()
    .notNull(),
  endedAt: timestamp("ended_at", {
    mode: "string",
    withTimezone: true,
  }),
  orderId: uuid("order_id").references(() => orders.id),
});

export const saleMessages = pgTable(
  "sale_messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => saleSessions.id),
    sequence: integer("sequence").notNull(),
    message: jsonb("message").notNull(),
    createdAt: timestamp("created_at", {
      mode: "string",
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("sale_messages_session_sequence_idx").on(table.sessionId, table.sequence)],
);

export const saleMemoryEpisodes = pgTable(
  "sale_memory_episodes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => saleSessions.id),
    userMessage: text("user_message").notNull(),
    assistantResponse: text("assistant_response").notNull(),
    orderId: uuid("order_id").references(() => orders.id),
    toolCalls: jsonb("tool_calls").notNull(),
    embedding: vector("embedding", { dimensions: 1536 }).notNull(),
    createdAt: timestamp("created_at", {
      mode: "string",
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("sale_memory_episodes_embedding_idx").using(
      "hnsw",
      table.embedding.op("vector_cosine_ops"),
    ),
    index("sale_memory_episodes_session_idx").on(table.sessionId),
  ],
);
