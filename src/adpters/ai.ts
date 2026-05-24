import { createVertex, type GoogleVertexProvider } from "@ai-sdk/google-vertex";
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

const gemini3FlashModelId = "gemini-3-flash-preview";
const geminiEmbeddingModelId = "gemini-embedding-001";

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
  readonly gemini3Flash: LanguageModel;
}

export interface VercelAiAdapter {
  readonly createEmbedding: CreateEmbedding;
  readonly generateText: typeof generateText;
  readonly models: VercelAiModels;
  readonly newAgent: NewAgent;
  readonly provider: GoogleVertexProvider;
  readonly streamText: typeof streamText;
}

export function NewVercelAiAdapter(config: AppConfig): VercelAiAdapter {
  const provider = createVertex({
    apiKey: config.VERTEXAI_API_KEY,
  });

  const models = {
    embedding: provider.embeddingModel(geminiEmbeddingModelId),
    gemini3Flash: provider(gemini3FlashModelId),
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
      const { model = models.gemini3Flash, ...settings } = options;

      return new ToolLoopAgent({
        ...settings,
        model,
      });
    },
    provider,
    streamText,
  };
}
