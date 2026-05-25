import { afterAll, beforeAll } from "bun:test";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres, { type Sql } from "postgres";
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";

const postgresPort = 5432;
const postgresUser = "postgres";
const postgresPassword = "postgres";
const postgresDatabase = "ai_agent_poc_test";
const migrationFiles = [
  "0000_enable_pgvector.sql",
  "0001_add_product_table.sql",
  "0002_add_product_embedding.sql",
  "0003_use_openai_product_embedding.sql",
  "0004_peaceful_songbird.sql",
  "0005_giant_swordsman.sql",
  "0006_add_sale_memory_episodes.sql",
];

export interface IntegrationSuite {
  readonly countRows: (tableName: string) => Promise<number>;
  readonly db: () => PostgresJsDatabase;
  readonly sql: () => Sql;
  readonly truncateTables: (tableNames: readonly string[]) => Promise<void>;
}

let container: StartedTestContainer | undefined;
let sqlClient: Sql | undefined;
let database: PostgresJsDatabase | undefined;

function buildDatabaseUrl(startedContainer: StartedTestContainer): string {
  return `postgres://${postgresUser}:${postgresPassword}@${startedContainer.getHost()}:${startedContainer
    .getMappedPort(postgresPort)
    .toString()}/${postgresDatabase}`;
}

async function applyMigrations(client: Sql): Promise<void> {
  for (const migrationFile of migrationFiles) {
    const migrationPath = path.join(process.cwd(), "migrations", migrationFile);
    const migration = await readFile(migrationPath, "utf8");
    const statements = migration
      .split("--> statement-breakpoint")
      .map((statement) => statement.trim())
      .filter((statement) => statement.length > 0);

    for (const statement of statements) {
      await client.unsafe(statement);
    }
  }
}

function requireSqlClient(): Sql {
  if (sqlClient === undefined) {
    throw new Error("Integration suite database is not ready");
  }

  return sqlClient;
}

function requireDatabase(): PostgresJsDatabase {
  if (database === undefined) {
    throw new Error("Integration suite database is not ready");
  }

  return database;
}

async function startInfrastructure(): Promise<void> {
  container = await new GenericContainer("pgvector/pgvector:pg16")
    .withEnvironment({
      POSTGRES_DB: postgresDatabase,
      POSTGRES_PASSWORD: postgresPassword,
      POSTGRES_USER: postgresUser,
    })
    .withExposedPorts(postgresPort)
    .withWaitStrategy(Wait.forLogMessage("database system is ready to accept connections", 2))
    .withStartupTimeout(120_000)
    .start();

  sqlClient = postgres(buildDatabaseUrl(container), { max: 5 });
  database = drizzle(sqlClient);

  await applyMigrations(sqlClient);
}

async function stopInfrastructure(): Promise<void> {
  await requireSqlClient().end();
  await container?.stop();

  sqlClient = undefined;
  database = undefined;
  container = undefined;
}

function registerGlobalHooks(): void {
  beforeAll(startInfrastructure);
  afterAll(stopInfrastructure);
}

async function truncateTables(tableNames: readonly string[]): Promise<void> {
  if (tableNames.length === 0) {
    return;
  }

  const tables = tableNames.map((tableName) => `"${tableName}"`).join(", ");

  await requireSqlClient().unsafe(`truncate table ${tables} restart identity cascade`);
}

async function countRows(tableName: string): Promise<number> {
  const client = requireSqlClient();
  const rows = await client<{ count: string }[]>`select count(*)::text as count
    from ${client(tableName)}`;
  const [row] = rows;

  if (row === undefined) {
    throw new Error(`Failed to count rows from ${tableName}`);
  }

  return Number.parseInt(row.count, 10);
}

export function NewIntegrationSuite(): IntegrationSuite {
  registerGlobalHooks();

  return {
    countRows,
    db: requireDatabase,
    sql: requireSqlClient,
    truncateTables,
  };
}
