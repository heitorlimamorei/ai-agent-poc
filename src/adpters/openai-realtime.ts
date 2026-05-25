import type { AiToolKit } from "../ai/toolkit/index.ts";
import { toRealtimeTools } from "../ai/tools/index.ts";
import type { AppConfig } from "../config/index.ts";
import type {
  NewVoiceRealtimeAgentOptions,
  VoiceAgent,
  VoiceAgentProfile,
  VoiceModelAdapter,
} from "../voice/agents/index.ts";
import { NewVoiceAgent } from "../voice/agents/index.ts";
import type { VoiceAudioFormat } from "../voice/channels/index.ts";
import {
  OpenAiRealtimeVoiceAgent,
  type RealtimeReasoningEffort,
  type RealtimeTurnDetection,
  type RealtimeTurnDetectionType,
  type RealtimeVoiceAgent,
} from "../voice/realtime/index.ts";

const defaultReasoningEffort: RealtimeReasoningEffort = "low";

const defaultTurnDetection: RealtimeTurnDetection = {
  eagerness: "low",
  type: "semantic_vad",
};

type OpenAiRealtimeTurnDetectionOption = RealtimeTurnDetection | RealtimeTurnDetectionType;

export interface NewOpenAiRealtimeAgentOptions extends VoiceAgentProfile {
  readonly reasoningEffort?: RealtimeReasoningEffort;
  readonly turnDetection?: OpenAiRealtimeTurnDetectionOption;
}

export interface NewOpenAiRealtimeVoiceAgentOptions extends NewVoiceRealtimeAgentOptions {
  readonly inputAudioFormat?: VoiceAudioFormat;
  readonly outputAudioFormat?: VoiceAudioFormat;
  readonly instructions?: string;
  readonly model?: string;
  readonly reasoningEffort?: RealtimeReasoningEffort;
  readonly tools?: AiToolKit;
  readonly turnDetection?: OpenAiRealtimeTurnDetectionOption;
  readonly voice?: string;
}

export type OpenAiRealtimeAgent = VoiceAgent;

export interface OpenAiRealtimeAdapter {
  newAgent(options: NewOpenAiRealtimeAgentOptions): OpenAiRealtimeAgent;
  newModel(options?: {
    readonly reasoningEffort?: RealtimeReasoningEffort;
    readonly turnDetection?: OpenAiRealtimeTurnDetectionOption;
  }): VoiceModelAdapter;
}

function normalizeTurnDetection(
  turnDetection: OpenAiRealtimeTurnDetectionOption | undefined,
): RealtimeTurnDetection | undefined {
  if (typeof turnDetection === "string") {
    return {
      type: turnDetection,
    };
  }

  return turnDetection;
}

export function NewOpenAiRealtimeAdapter(config: AppConfig): OpenAiRealtimeAdapter {
  function newVoiceAgent(
    agentOptions: NewOpenAiRealtimeAgentOptions,
    realtimeOptions: NewOpenAiRealtimeVoiceAgentOptions,
  ): RealtimeVoiceAgent {
    const inputAudioFormat = realtimeOptions.inputAudioFormat ?? realtimeOptions.audioFormat;
    const outputAudioFormat = realtimeOptions.outputAudioFormat ?? realtimeOptions.audioFormat;
    const tools = realtimeOptions.tools ?? agentOptions.tools ?? {};

    return new OpenAiRealtimeVoiceAgent({
      apiKey: config.OPENAI_API_KEY,
      session: {
        inputAudioFormat,
        instructions: realtimeOptions.instructions ?? agentOptions.instructions,
        model: realtimeOptions.model ?? agentOptions.model ?? config.OPENAI_REALTIME_MODEL,
        outputAudioFormat,
        reasoning: {
          effort:
            realtimeOptions.reasoningEffort ??
            agentOptions.reasoningEffort ??
            defaultReasoningEffort,
        },
        tools: toRealtimeTools(tools),
        turnDetection:
          normalizeTurnDetection(realtimeOptions.turnDetection) ??
          normalizeTurnDetection(agentOptions.turnDetection) ??
          defaultTurnDetection,
        voice: realtimeOptions.voice ?? agentOptions.voice ?? config.OPENAI_REALTIME_VOICE,
      },
    });
  }

  return {
    newAgent(options): OpenAiRealtimeAgent {
      const profile: VoiceAgentProfile = {
        id: options.id,
        instructions: options.instructions,
        tools: options.tools ?? {},
      };

      if (options.model !== undefined) {
        Object.assign(profile, { model: options.model });
      }

      if (options.reasoningEffort !== undefined) {
        Object.assign(profile, { reasoningEffort: options.reasoningEffort });
      }

      if (options.voice !== undefined) {
        Object.assign(profile, { voice: options.voice });
      }

      return NewVoiceAgent({
        model: {
          newRealtimeAgent(_profile, realtimeOptions): RealtimeVoiceAgent {
            return newVoiceAgent(options, realtimeOptions);
          },
        },
        profile,
      });
    },
    newModel(options = {}): VoiceModelAdapter {
      return {
        newRealtimeAgent(profile, realtimeOptions): RealtimeVoiceAgent {
          const agentOptions: NewOpenAiRealtimeAgentOptions = { ...profile };

          if (options.turnDetection !== undefined) {
            Object.assign(agentOptions, { turnDetection: options.turnDetection });
          }

          if (options.reasoningEffort !== undefined) {
            Object.assign(agentOptions, { reasoningEffort: options.reasoningEffort });
          }

          return newVoiceAgent(agentOptions, realtimeOptions);
        },
      };
    },
  };
}
