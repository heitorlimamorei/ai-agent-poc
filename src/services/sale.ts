import type { ModelMessage } from "ai";

import type { CreateEmbedding } from "../adpters/ai.ts";
import type { SellerAgent } from "../ai/agents/index.ts";
import { createOrderToolOutputSchema } from "../ai/tools/index.ts";
import {
  type SaleMemoryEpisodeSearchResult,
  type SaleMemoryToolCall,
  type SaleSession,
  saleMemoryEpisodeEmbeddingText,
  saleMemorySearchEmbeddingText,
} from "../entities/index.ts";
import type { SaleRepository } from "../repositories/index.ts";
import { err, ok, type Result } from "../utils/result.ts";

export interface SaleServiceRequest {
  readonly message: string;
}

export interface SaleServiceResponse {
  readonly endedAt: string | null;
  readonly orderId: string | null;
  readonly response: string;
  readonly sessionId: string;
}

export interface SaleService {
  continueSession: (
    sessionId: string,
    request: SaleServiceRequest,
  ) => Promise<Result<SaleServiceResponse>>;
  startSession: (request: SaleServiceRequest) => Promise<Result<SaleServiceResponse>>;
}

export interface SaleAi {
  readonly createEmbedding: CreateEmbedding;
}

export interface SaleServiceDependencies {
  readonly ai: SaleAi;
  readonly saleRepository: SaleRepository;
  readonly sellerAgent: SellerAgent;
}

function userMessage(content: string): ModelMessage {
  return {
    content,
    role: "user",
  };
}

function createdOrderIdFromResult(
  result: Awaited<ReturnType<SellerAgent["generate"]>>,
): string | null {
  for (const step of result.steps) {
    for (const toolResult of step.toolResults) {
      if (toolResult.toolName !== "createOrder") {
        continue;
      }

      const parsedOutput = createOrderToolOutputSchema.safeParse(toolResult.output);

      if (parsedOutput.success && parsedOutput.data.ok) {
        return parsedOutput.data.order.id;
      }
    }
  }

  return null;
}

function validateRequest(request: SaleServiceRequest): Result<SaleServiceRequest> {
  const message = request.message.trim();

  if (message.length === 0) {
    return err({
      code: "INVALID_ARGUMENT",
      expose: true,
      message: "Sale message is required",
      origin: "INPUT",
    });
  }

  return ok({ message });
}

function compactMemoryText(text: string, maxLength = 500): string {
  const compacted = text.trim().replaceAll(/\s+/g, " ");

  if (compacted.length <= maxLength) {
    return compacted;
  }

  return `${compacted.slice(0, maxLength - 3)}...`;
}

function jsonSafeValue(value: unknown): unknown {
  if (value === undefined) {
    return null;
  }

  try {
    return JSON.parse(JSON.stringify(value)) as unknown;
  } catch {
    return null;
  }
}

function toolCallsFromResult(
  result: Awaited<ReturnType<SellerAgent["generate"]>>,
): SaleMemoryToolCall[] {
  const toolCalls: SaleMemoryToolCall[] = [];

  result.steps.forEach((step, index) => {
    for (const toolResult of step.toolResults) {
      toolCalls.push({
        input: null,
        output: jsonSafeValue(toolResult.output),
        step: index,
        toolName: toolResult.toolName,
      });
    }
  });

  return toolCalls;
}

function memorySystemMessage(episodes: readonly SaleMemoryEpisodeSearchResult[]): ModelMessage {
  const memoryLines = episodes.map((episode, index) => {
    const orderStatus =
      episode.orderId === null ? "sem pedido criado" : `pedido ${episode.orderId}`;
    const episodeNumber = (index + 1).toString();
    const toolNames = [...new Set(episode.toolCalls.map((toolCall) => toolCall.toolName))];

    return [
      `Episodio ${episodeNumber} - similaridade ${episode.score.toFixed(2)} (${orderStatus})`,
      `Cliente: ${compactMemoryText(episode.userMessage)}`,
      `Agente: ${compactMemoryText(episode.assistantResponse)}`,
      `Ferramentas: ${toolNames.length === 0 ? "nenhuma" : toolNames.join(", ")}`,
    ].join("\n");
  });

  return {
    content: [
      "Memorias episodicas recuperadas de atendimentos anteriores semanticamente parecidos.",
      "Use como contexto de estrategia, preferencias recorrentes e continuidade comercial quando fizer sentido.",
      "Nao trate nomes, confirmacoes, promessas, estoque ou dados pessoais de outros atendimentos como fatos do cliente atual.",
      "",
      ...memoryLines,
    ].join("\n"),
    role: "system",
  };
}

export function NewSaleService(dependencies: SaleServiceDependencies): SaleService {
  const { ai, saleRepository, sellerAgent } = dependencies;

  async function retrievedMemoryMessage(
    sessionId: string,
    currentUserMessage: string,
  ): Promise<ModelMessage | null> {
    const [embedding, embeddingFailure] = await ai.createEmbedding(
      saleMemorySearchEmbeddingText(currentUserMessage),
    );

    if (embeddingFailure !== null) {
      return null;
    }

    const [episodes, searchFailure] = await saleRepository.searchMemoryEpisodes(embedding, {
      excludeSessionId: sessionId,
      limit: 4,
    });

    if (searchFailure !== null || episodes.length === 0) {
      return null;
    }

    return memorySystemMessage(episodes);
  }

  async function rememberEpisode(
    sessionId: string,
    userText: string,
    assistantText: string,
    orderId: string | null,
    toolCalls: readonly SaleMemoryToolCall[],
  ): Promise<void> {
    const episode = {
      assistantResponse: assistantText,
      orderId,
      sessionId,
      toolCalls: [...toolCalls],
      userMessage: userText,
    };

    const [embedding, embeddingFailure] = await ai.createEmbedding(
      saleMemoryEpisodeEmbeddingText(episode),
    );

    if (embeddingFailure !== null) {
      return;
    }

    const [, memoryFailure] = await saleRepository.createMemoryEpisode({
      ...episode,
      embedding,
    });

    void memoryFailure;
  }

  async function runAgent(
    session: SaleSession,
    messages: ModelMessage[],
    currentUserMessage: string,
  ): Promise<Result<SaleServiceResponse>> {
    let result: Awaited<ReturnType<SellerAgent["generate"]>>;

    try {
      const memoryMessage = await retrievedMemoryMessage(session.id, currentUserMessage);
      const agentMessages = memoryMessage === null ? messages : [memoryMessage, ...messages];

      result = await sellerAgent.generate({ messages: agentMessages });
    } catch (error) {
      return err({
        cause: error,
        code: "DEPENDENCY_FAILURE",
        message: "Failed to generate sale response",
        origin: "DEPENDENCY",
      });
    }

    const [, appendFailure] = await saleRepository.appendMessages(
      session.id,
      result.response.messages,
    );

    if (appendFailure !== null) {
      return err(appendFailure);
    }

    const createdOrderId = createdOrderIdFromResult(result);
    let finalSession = session;

    if (createdOrderId !== null) {
      const [endedSession, endFailure] = await saleRepository.endSession(
        session.id,
        createdOrderId,
      );

      if (endFailure !== null) {
        return err(endFailure);
      }

      finalSession = endedSession;
    }

    await rememberEpisode(
      session.id,
      currentUserMessage,
      result.text,
      createdOrderId,
      toolCallsFromResult(result),
    );

    return ok({
      endedAt: finalSession.endedAt,
      orderId: finalSession.orderId,
      response: result.text,
      sessionId: finalSession.id,
    });
  }

  async function startSession(request: SaleServiceRequest): Promise<Result<SaleServiceResponse>> {
    const [validRequest, invalidRequestFailure] = validateRequest(request);

    if (invalidRequestFailure !== null) {
      return err(invalidRequestFailure);
    }

    const [session, sessionFailure] = await saleRepository.createSession();

    if (sessionFailure !== null) {
      return err(sessionFailure);
    }

    const messages = [userMessage(validRequest.message)];
    const [, appendFailure] = await saleRepository.appendMessages(session.id, messages);

    if (appendFailure !== null) {
      return err(appendFailure);
    }

    return runAgent(session, messages, validRequest.message);
  }

  async function continueSession(
    sessionId: string,
    request: SaleServiceRequest,
  ): Promise<Result<SaleServiceResponse>> {
    const [validRequest, invalidRequestFailure] = validateRequest(request);

    if (invalidRequestFailure !== null) {
      return err(invalidRequestFailure);
    }

    const [session, sessionFailure] = await saleRepository.getSession(sessionId);

    if (sessionFailure !== null) {
      return err(sessionFailure);
    }

    if (session.endedAt !== null) {
      return err({
        code: "FAILED_PRECONDITION",
        expose: true,
        message: "Sale session is already ended",
        origin: "DOMAIN",
      });
    }

    const [history, historyFailure] = await saleRepository.listMessages(session.id);

    if (historyFailure !== null) {
      return err(historyFailure);
    }

    const newUserMessage = userMessage(validRequest.message);
    const [, appendFailure] = await saleRepository.appendMessages(session.id, [newUserMessage]);

    if (appendFailure !== null) {
      return err(appendFailure);
    }

    return runAgent(session, [...history, newUserMessage], validRequest.message);
  }

  return { continueSession, startSession };
}
