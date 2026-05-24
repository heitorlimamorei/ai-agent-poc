import { sql } from "drizzle-orm";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres, { type Sql } from "postgres";

import type { AppConfig } from "../config/index.ts";

export type DrizzleDatabase = PostgresJsDatabase;

export async function NewDrizzleDatabase(config: AppConfig): Promise<DrizzleDatabase> {
  const client: Sql = postgres(config.DATABASE_URL, {
    max: config.DB_MAX_CONNECTIONS,
    max_lifetime: config.DB_CONNECTION_MAX_LIFETIME,
  });
  const db = drizzle(client);

  await db.execute(sql`select 1`);

  return db;
}
