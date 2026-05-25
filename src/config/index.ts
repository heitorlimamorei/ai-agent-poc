import { z } from "zod";

import { durationPattern, durationToSeconds } from "../utils/duration.ts";

const portSchema = z.coerce.number().int().min(1).max(65_535).default(3000);
const positiveIntSchema = z.coerce.number().int().min(1);
const voiceAudioFormatSchema = z.enum([
  "audio/pcm",
  "audio/pcma",
  "audio/pcmu",
]);

const durationSecondsSchema = z
  .string()
  .regex(durationPattern, "Duration must use ms, s, m, or h suffix")
  .transform(durationToSeconds);
const defaultConnectionMaxLifetimeSeconds = durationToSeconds("5m");

export const AppConfig = z.object({
  DATABASE_URL: z.url().startsWith("postgres://"),
  DB_CONNECTION_MAX_LIFETIME: durationSecondsSchema.default(
    defaultConnectionMaxLifetimeSeconds,
  ),
  DB_MAX_CONNECTIONS: positiveIntSchema.default(25),
  DB_MAX_IDLE_CONNECTIONS: positiveIntSchema.default(5),
  HOSTNAME: z.string().min(1).default("0.0.0.0"),
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  OPENAI_API_KEY: z.string().min(1),
  OPENAI_REALTIME_MODEL: z.string().min(1).default("gpt-realtime-2"),
  OPENAI_REALTIME_VOICE: z.string().min(1).default("marin"),
  PORT: portSchema,
  VOICE_AUDIO_FORMAT: voiceAudioFormatSchema.default("audio/pcmu"),
});

export type AppConfig = z.infer<typeof AppConfig>;
export type Env = Record<string, string | undefined>;

export function NewAppConfig(env: Env): AppConfig {
  return AppConfig.parse(env);
}
