import { defineConfig } from "drizzle-kit";

const { DATABASE_URL } = process.env;

export default defineConfig({
  dbCredentials: {
    url: DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/ai_agent_poc",
  },
  dialect: "postgresql",
  out: "./migrations",
  schema: "./src/database/schema.ts",
  strict: true,
  verbose: true,
});
