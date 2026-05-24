import { z } from "zod";

const portSchema = z.coerce.number().int().min(1).max(65_535).default(3000);
const positiveIntSchema = z.coerce.number().int().min(1);
const durationPattern = /^(\d+)(ms|s|m|h)$/u;

function durationToSeconds(value: string): number {
  const match = durationPattern.exec(value);

  if (match === null) {
    throw new Error(`Invalid duration: ${value}`);
  }

  const amountText = match[1];
  const unit = match[2];

  if (amountText === undefined || unit === undefined) {
    throw new Error(`Invalid duration: ${value}`);
  }

  const amount = Number.parseInt(amountText, 10);

  switch (unit) {
    case "ms":
      return Math.ceil(amount / 1000);
    case "s":
      return amount;
    case "m":
      return amount * 60;
    case "h":
      return amount * 60 * 60;
  }

  throw new Error(`Invalid duration unit: ${unit}`);
}

const durationSecondsSchema = z
  .string()
  .regex(durationPattern, "Duration must use ms, s, m, or h suffix")
  .transform(durationToSeconds);
const defaultConnectionMaxLifetimeSeconds = durationToSeconds("5m");

export const AppConfig = z.object({
  DATABASE_URL: z.url().startsWith("postgres://"),
  DB_CONNECTION_MAX_LIFETIME: durationSecondsSchema.default(defaultConnectionMaxLifetimeSeconds),
  DB_MAX_CONNECTIONS: positiveIntSchema.default(25),
  DB_MAX_IDLE_CONNECTIONS: positiveIntSchema.default(5),
  HOSTNAME: z.string().min(1).default("0.0.0.0"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: portSchema,
  VERTEXAI_API_KEY: z.string().min(1),
});

export type AppConfig = z.infer<typeof AppConfig>;
export type Env = Record<string, string | undefined>;

export function NewAppConfig(env: Env): AppConfig {
  return AppConfig.parse(env);
}
