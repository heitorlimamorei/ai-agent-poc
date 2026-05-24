import type { SaleService, SaleServiceRequest, SaleServiceResponse } from "../services/index.ts";
import { ok, type Result } from "../utils/result.ts";

export class FakeSaleService implements SaleService {
  async continueSession(
    sessionId: string,
    request: SaleServiceRequest,
  ): Promise<Result<SaleServiceResponse>> {
    void request;
    await Promise.resolve();

    return ok({
      endedAt: null,
      orderId: null,
      response: "Fake sale response",
      sessionId,
    });
  }

  async startSession(request: SaleServiceRequest): Promise<Result<SaleServiceResponse>> {
    void request;
    await Promise.resolve();

    return ok({
      endedAt: null,
      orderId: null,
      response: "Fake sale response",
      sessionId: crypto.randomUUID(),
    });
  }
}
