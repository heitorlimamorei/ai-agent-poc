import type { AppConfig } from "../config/index.ts";
import { NewVercelAiAdapter, type VercelAiAdapter } from "./ai.ts";
import { type DrizzleDatabase, NewDrizzleDatabase } from "./drizzle.ts";

export type { VercelAiAdapter };

export interface Adpters {
  readonly ai: VercelAiAdapter;
  readonly db: DrizzleDatabase;
}

export async function NewAdpters(config: AppConfig): Promise<Adpters> {
  return {
    ai: NewVercelAiAdapter(config),
    db: await NewDrizzleDatabase(config),
  };
}
