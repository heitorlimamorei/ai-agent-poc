import type { ModelMessage } from "ai";

import type { SellerAgent } from "../ai/agents/index.ts";
import { createOrderToolOutputSchema } from "../ai/tools/index.ts";
import type { SaleSession } from "../entities/index.ts";
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

export interface SaleServiceDependencies {
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

export function NewSaleService(dependencies: SaleServiceDependencies): SaleService {
  const { saleRepository, sellerAgent } = dependencies;

  async function runAgent(
    session: SaleSession,
    messages: ModelMessage[],
  ): Promise<Result<SaleServiceResponse>> {
    let result: Awaited<ReturnType<SellerAgent["generate"]>>;

    try {
      result = await sellerAgent.generate({ messages });
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

    return runAgent(session, messages);
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

    return runAgent(session, [...history, newUserMessage]);
  }

  return { continueSession, startSession };
}
