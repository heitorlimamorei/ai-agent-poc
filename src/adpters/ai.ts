import { createOpenAI, type OpenAIProvider } from "@ai-sdk/openai";
import {
  type Agent,
  type Embedding,
  type EmbeddingModel,
  embed,
  generateText,
  type LanguageModel,
  streamText,
  ToolLoopAgent,
  type ToolLoopAgentSettings,
  type ToolSet,
} from "ai";

import type { AppConfig } from "../config/index.ts";
import { err, ok, type Result } from "../utils/result.ts";

const openAiChatModelId = "gpt-4.1-mini";
const openAiEmbeddingModelId = "text-embedding-3-small";

type EmptyTools = Record<string, never>;

export type NewAgentOptions<CALL_OPTIONS = never, TOOLS extends ToolSet = EmptyTools> = Omit<
  ToolLoopAgentSettings<CALL_OPTIONS, TOOLS>,
  "model"
> & {
  readonly model?: LanguageModel;
};

export type NewAgent = <CALL_OPTIONS = never, TOOLS extends ToolSet = EmptyTools>(
  options?: NewAgentOptions<CALL_OPTIONS, TOOLS>,
) => Agent<CALL_OPTIONS, TOOLS>;

export type CreateEmbedding = (input: string) => Promise<Result<Embedding>>;

export interface VercelAiModels {
  readonly embedding: EmbeddingModel;
  readonly chat: LanguageModel;
}

export interface VercelAiAdapter {
  readonly createEmbedding: CreateEmbedding;
  readonly generateText: typeof generateText;
  readonly models: VercelAiModels;
  readonly newAgent: NewAgent;
  readonly provider: OpenAIProvider;
  readonly streamText: typeof streamText;
}

export function NewVercelAiAdapter(config: AppConfig): VercelAiAdapter {
  const provider = createOpenAI({
    apiKey: config.OPENAI_API_KEY,
  });

  const models = {
    chat: provider.chat(openAiChatModelId),
    embedding: provider.embeddingModel(openAiEmbeddingModelId),
  } satisfies VercelAiAdapter["models"];

  return {
    async createEmbedding(input: string): Promise<Result<Embedding>> {
      try {
        const { embedding } = await embed({
          model: models.embedding,
          value: input,
        });

        return ok(embedding);
      } catch (error) {
        return err({
          cause: error,
          code: "DEPENDENCY_FAILURE",
          message: "Failed to create embedding",
          origin: "DEPENDENCY",
        });
      }
    },
    generateText,
    models,
    newAgent<CALL_OPTIONS = never, TOOLS extends ToolSet = EmptyTools>(
      options: NewAgentOptions<CALL_OPTIONS, TOOLS> = {},
    ): Agent<CALL_OPTIONS, TOOLS> {
      const { model = models.chat, ...settings } = options;

      return new ToolLoopAgent({
        ...settings,
        model,
      });
    },
    provider,
    streamText,
  };
}
