import type { AiToolKit } from "../../ai/toolkit/index.ts";
import type { VoiceAudioFormat } from "../channels/index.ts";
import type { RealtimeVoiceAgent } from "../realtime/index.ts";

export interface VoiceAgentProfile {
  readonly id: string;
  readonly instructions: string;
  readonly model?: string;
  readonly tools?: AiToolKit;
  readonly voice?: string;
}

export interface NewVoiceRealtimeAgentOptions {
  readonly audioFormat: VoiceAudioFormat;
}

export interface VoiceModelAdapter {
  newRealtimeAgent(
    profile: VoiceAgentProfile,
    options: NewVoiceRealtimeAgentOptions,
  ): RealtimeVoiceAgent;
}

export interface VoiceAgent {
  readonly profile: VoiceAgentProfile;
  newRealtimeAgent(options: NewVoiceRealtimeAgentOptions): RealtimeVoiceAgent;
}
