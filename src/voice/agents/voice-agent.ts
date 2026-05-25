import type {
  NewVoiceRealtimeAgentOptions,
  VoiceAgent,
  VoiceAgentProfile,
  VoiceModelAdapter,
} from "./types.ts";

export interface NewVoiceAgentDependencies {
  readonly model: VoiceModelAdapter;
  readonly profile: VoiceAgentProfile;
}

export function NewVoiceAgent(dependencies: NewVoiceAgentDependencies): VoiceAgent {
  return {
    profile: dependencies.profile,
    newRealtimeAgent(options: NewVoiceRealtimeAgentOptions) {
      return dependencies.model.newRealtimeAgent(dependencies.profile, options);
    },
  };
}
