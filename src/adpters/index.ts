import type { AppConfig } from "../config/index.ts";
import { NewVercelAiAdapter, type VercelAiAdapter } from "./ai.ts";
import { type DrizzleDatabase, NewDrizzleDatabase } from "./drizzle.ts";
import { NewOpenAiRealtimeAdapter, type OpenAiRealtimeAdapter } from "./openai-realtime.ts";

export type { OpenAiRealtimeAdapter, VercelAiAdapter };

export interface Adpters {
  readonly ai: VercelAiAdapter;
  readonly db: DrizzleDatabase;
  readonly openAiRealtime: OpenAiRealtimeAdapter;
}

export async function NewAdpters(config: AppConfig): Promise<Adpters> {
  return {
    ai: NewVercelAiAdapter(config),
    db: await NewDrizzleDatabase(config),
    openAiRealtime: NewOpenAiRealtimeAdapter(config),
  };
}
