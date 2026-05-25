import type { VoiceRealtimeSessionHooks } from "../sessions/index.ts";
import type { VoiceAgent } from "./types.ts";

export interface VoiceAgentRegistration {
  readonly agent: VoiceAgent;
  readonly hooks?: VoiceRealtimeSessionHooks;
  readonly path: string;
}

export interface VoiceAgentRegistry {
  get(id: string): VoiceAgentRegistration | undefined;
  list(): readonly VoiceAgentRegistration[];
}

export function NewVoiceAgentRegistry(
  registrations: readonly VoiceAgentRegistration[],
): VoiceAgentRegistry {
  const registrationsById = new Map(
    registrations.map((registration) => [registration.agent.profile.id, registration]),
  );

  return {
    get(id): VoiceAgentRegistration | undefined {
      return registrationsById.get(id);
    },
    list(): readonly VoiceAgentRegistration[] {
      return registrations;
    },
  };
}
