import { describe, expect, test } from "bun:test";
import type { ModelMessage } from "ai";
import { z } from "zod";

import type { AiToolDefinition } from "../../ai/toolkit/index.ts";
import type { SaleMessage, SaleSession } from "../../entities/index.ts";
import type { SaleSessionService } from "../../services/index.ts";
import { ok, type Result } from "../../utils/result.ts";
import type { VoiceAgent } from "../agents/index.ts";
import type {
  VoiceAudioChunk,
  VoiceAudioHandler,
  VoiceChannel,
  VoiceCloseHandler,
  VoiceControlHandler,
  VoiceInboundControlEvent,
  VoiceOutboundControlEvent,
  VoiceTranscript,
} from "../channels/index.ts";
import type {
  RealtimeAudioHandler,
  RealtimeCloseHandler,
  RealtimeErrorHandler,
  RealtimeResponseDoneHandler,
  RealtimeToolCall,
  RealtimeToolCallHandler,
  RealtimeTranscriptHandler,
  RealtimeVoiceAgent,
} from "../realtime/index.ts";
import type {
  SellerVoiceAgentProfile,
  SellerVoiceAgentToolAction,
} from "./seller-voice-profile.ts";
import { SellerRealtimeVoiceSession } from "./seller-voice-session.ts";

const toolInputSchema = z.object({});
const toolOutputSchema = z.object({
  ok: z.literal(true),
});

function ignoreHandlerError(error: unknown): void {
  void error;
}

async function flushAsyncHandlers(): Promise<void> {
  for (let index = 0; index < 8; index += 1) {
    await Promise.resolve();
  }
}

function newNoopTool(name: string): AiToolDefinition<Record<string, never>, { ok: true }> {
  return {
    description: `${name} test tool`,
    inputSchema: toolInputSchema,
    name,
    outputSchema: toolOutputSchema,
    async execute(): Promise<{ ok: true }> {
      await Promise.resolve();

      return { ok: true };
    },
  };
}

function newSaleSession(id = crypto.randomUUID()): SaleSession {
  return {
    endedAt: null,
    id,
    orderId: null,
    startedAt: new Date().toISOString(),
  };
}

class FakeVoiceChannel implements VoiceChannel {
  readonly id = crypto.randomUUID();
  readonly sentControls: VoiceOutboundControlEvent[] = [];
  readonly sentTranscripts: VoiceTranscript[] = [];
  closedReason: string | null = null;
  private readonly audioHandlers: VoiceAudioHandler[] = [];
  private readonly closeHandlers: VoiceCloseHandler[] = [];
  private readonly controlHandlers: VoiceControlHandler[] = [];

  close(reason?: string): void {
    this.closedReason = reason ?? null;
  }

  emitControl(event: VoiceInboundControlEvent): void {
    for (const handler of this.controlHandlers) {
      Promise.resolve(handler(event)).catch(ignoreHandlerError);
    }
  }

  emitClose(): void {
    for (const handler of this.closeHandlers) {
      Promise.resolve(handler()).catch(ignoreHandlerError);
    }
  }

  onAudio(handler: VoiceAudioHandler): void {
    this.audioHandlers.push(handler);
  }

  onClose(handler: VoiceCloseHandler): void {
    this.closeHandlers.push(handler);
  }

  onControl(handler: VoiceControlHandler): void {
    this.controlHandlers.push(handler);
  }

  sendAudio(audio: VoiceAudioChunk): void {
    void audio;
  }

  sendControl(event: VoiceOutboundControlEvent): void {
    this.sentControls.push(event);
  }

  sendTranscript(transcript: VoiceTranscript): void {
    this.sentTranscripts.push(transcript);
  }
}

class FakeRealtimeVoiceAgent implements RealtimeVoiceAgent {
  readonly toolOutputs: { callId: string; output: unknown }[] = [];
  closeCount = 0;
  connectCount = 0;
  createResponseCount = 0;
  private readonly responseDoneHandlers: RealtimeResponseDoneHandler[] = [];
  private readonly toolCallHandlers: RealtimeToolCallHandler[] = [];
  private readonly transcriptHandlers: RealtimeTranscriptHandler[] = [];

  appendAudio(audio: VoiceAudioChunk): void {
    void audio;
  }

  clearAudio(): void {
    this.closeCount += 0;
  }

  close(): void {
    this.closeCount += 1;
  }

  commitAudio(): void {
    this.createResponseCount += 0;
  }

  async connect(): Promise<void> {
    await Promise.resolve();
    this.connectCount += 1;
  }

  createResponse(): void {
    this.createResponseCount += 1;
  }

  emitResponseDone(): void {
    for (const handler of this.responseDoneHandlers) {
      Promise.resolve(handler()).catch(ignoreHandlerError);
    }
  }

  emitToolCall(call: RealtimeToolCall): void {
    for (const handler of this.toolCallHandlers) {
      Promise.resolve(handler(call)).catch(ignoreHandlerError);
    }
  }

  emitTranscript(transcript: VoiceTranscript): void {
    for (const handler of this.transcriptHandlers) {
      Promise.resolve(handler(transcript)).catch(ignoreHandlerError);
    }
  }

  interrupt(): void {
    this.closeCount += 0;
  }

  onAudio(handler: RealtimeAudioHandler): void {
    void handler;
  }

  onClose(handler: RealtimeCloseHandler): void {
    void handler;
  }

  onError(handler: RealtimeErrorHandler): void {
    void handler;
  }

  onResponseDone(handler: RealtimeResponseDoneHandler): void {
    this.responseDoneHandlers.push(handler);
  }

  onToolCall(handler: RealtimeToolCallHandler): void {
    this.toolCallHandlers.push(handler);
  }

  onTranscript(handler: RealtimeTranscriptHandler): void {
    this.transcriptHandlers.push(handler);
  }

  sendToolOutput(callId: string, output: unknown): void {
    this.toolOutputs.push({ callId, output });
    this.createResponse();
  }
}

class FakeSaleSessionService implements SaleSessionService {
  readonly appendedMessages: ModelMessage[] = [];
  closeSessionCount = 0;
  endedWithOrderId: string | null = null;
  private readonly session = newSaleSession();

  async appendMessages(
    _sessionId: string,
    messages: readonly ModelMessage[],
  ): Promise<Result<SaleMessage[]>> {
    await Promise.resolve();
    this.appendedMessages.push(...messages);
    return ok([]);
  }

  async closeSession(id: string): Promise<Result<SaleSession>> {
    await Promise.resolve();
    void id;
    this.closeSessionCount += 1;
    return ok({ ...this.session, endedAt: new Date().toISOString() });
  }

  async createSession(): Promise<Result<SaleSession>> {
    await Promise.resolve();
    return ok(this.session);
  }

  async endSessionWithOrder(id: string, orderId: string): Promise<Result<SaleSession>> {
    await Promise.resolve();
    void id;
    this.endedWithOrderId = orderId;
    return ok({
      ...this.session,
      endedAt: new Date().toISOString(),
      orderId,
    });
  }
}

function newProfile(action: SellerVoiceAgentToolAction): SellerVoiceAgentProfile {
  return {
    id: "test-profile",
    instructions: "Test voice profile",
    tools: {
      testTool: newNoopTool("testTool"),
    },
    async handleToolResult(): Promise<SellerVoiceAgentToolAction> {
      await Promise.resolve();
      return action;
    },
  };
}

function newSession(action: SellerVoiceAgentToolAction): {
  channel: FakeVoiceChannel;
  realtime: FakeRealtimeVoiceAgent;
  saleSessionService: FakeSaleSessionService;
  session: SellerRealtimeVoiceSession;
} {
  const channel = new FakeVoiceChannel();
  const realtime = new FakeRealtimeVoiceAgent();
  const saleSessionService = new FakeSaleSessionService();
  const profile = newProfile(action);
  const agent: VoiceAgent = {
    profile,
    newRealtimeAgent() {
      return realtime;
    },
  };
  const session = new SellerRealtimeVoiceSession({
    agent,
    channel,
    profile,
    realtime,
    saleSessionService,
  });

  return { channel, realtime, saleSessionService, session };
}

describe("SellerRealtimeVoiceSession", () => {
  test("ends the sale session when a tool action contains an order", async () => {
    const orderId = crypto.randomUUID();
    const { realtime, saleSessionService, session } = newSession({
      orderId,
      type: "end-session-with-order",
    });

    await session.start();
    realtime.emitToolCall({
      arguments: "{}",
      callId: "call-1",
      name: "testTool",
    });
    await flushAsyncHandlers();

    expect(saleSessionService.endedWithOrderId).toBe(orderId);
    expect(realtime.toolOutputs).toHaveLength(1);
  });

  test("closes the channel only after the assistant follow-up response is done", async () => {
    const reason = "Call ended by profile";
    const { channel, realtime, saleSessionService, session } = newSession({
      closeChannelAfterResponse: true,
      reason,
      type: "close-session",
    });

    await session.start();
    realtime.emitToolCall({
      arguments: "{}",
      callId: "call-1",
      name: "testTool",
    });
    await flushAsyncHandlers();

    expect(saleSessionService.closeSessionCount).toBe(1);
    expect(channel.closedReason).toBeNull();

    realtime.emitResponseDone();
    await flushAsyncHandlers();

    expect(channel.closedReason).toBe(reason);
    expect(channel.sentControls).toContainEqual({
      reason,
      type: "stop",
    });
  });

  test("persists only final transcripts", async () => {
    const { realtime, saleSessionService, session } = newSession({
      type: "none",
    });

    await session.start();
    realtime.emitTranscript({
      partial: true,
      role: "assistant",
      text: "Par",
    });
    realtime.emitTranscript({
      role: "assistant",
      text: "Perfeito, posso ajudar.",
    });
    await flushAsyncHandlers();

    expect(saleSessionService.appendedMessages).toEqual([
      {
        content: "Perfeito, posso ajudar.",
        role: "assistant",
      },
    ]);
  });
});
