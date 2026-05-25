import type { ModelMessage } from "ai";

import type { SaleMessage, SaleSession } from "../entities/index.ts";
import type { SaleMessageRepository, SaleSessionRepository } from "../repositories/index.ts";
import type { Result } from "../utils/result.ts";

export interface SaleSessionService {
  appendMessages: (
    sessionId: string,
    messages: readonly ModelMessage[],
  ) => Promise<Result<SaleMessage[]>>;
  closeSession: (id: string) => Promise<Result<SaleSession>>;
  createSession: () => Promise<Result<SaleSession>>;
  endSessionWithOrder: (id: string, orderId: string) => Promise<Result<SaleSession>>;
}

export interface SaleSessionServiceDependencies {
  readonly saleMessageRepository: SaleMessageRepository;
  readonly saleSessionRepository: SaleSessionRepository;
}

export function NewSaleSessionService(
  dependencies: SaleSessionServiceDependencies,
): SaleSessionService {
  return {
    appendMessages: dependencies.saleMessageRepository.appendMessages,
    closeSession: dependencies.saleSessionRepository.closeSession,
    createSession: dependencies.saleSessionRepository.createSession,
    endSessionWithOrder: dependencies.saleSessionRepository.endSession,
  };
}
