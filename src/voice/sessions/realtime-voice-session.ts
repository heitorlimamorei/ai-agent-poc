import type { AiToolExecutionResult } from "../../ai/toolkit/index.ts";
import { executeRealtimeToolCall } from "../../ai/tools/index.ts";
import type { VoiceAgent } from "../agents/index.ts";
import type { VoiceChannel, VoiceTranscript } from "../channels/index.ts";
import type { RealtimeToolCall, RealtimeVoiceAgent } from "../realtime/index.ts";

export interface VoiceSession {
  readonly sessionId: string | null;
  close(): void;
  start(): Promise<void>;
}

export interface VoiceSessionContext {
  readonly agentId: string;
  readonly channelId: string;
  readonly sessionId: string | null;
}

export type VoiceSessionAction =
  | {
      readonly type: "close";
      readonly closeChannelAfterResponse?: boolean;
      readonly reason: string;
    }
  | {
      readonly type: "none";
    };

export interface VoiceSessionStartResult {
  readonly sessionId?: string;
}

export interface VoiceRealtimeSessionHooks {
  onClose?(context: VoiceSessionContext, reason: string): Promise<void>;
  onStart?(context: VoiceSessionContext): Promise<VoiceSessionStartResult | undefined>;
  onToolResult?(
    result: AiToolExecutionResult,
    context: VoiceSessionContext,
  ): Promise<VoiceSessionAction | undefined>;
  onTranscript?(transcript: VoiceTranscript, context: VoiceSessionContext): Promise<void>;
}

export interface VoiceRealtimeSessionDependencies {
  readonly agent: VoiceAgent;
  readonly channel: VoiceChannel;
  readonly hooks?: VoiceRealtimeSessionHooks;
  readonly realtime: RealtimeVoiceAgent;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Voice session operation failed";
}

export class VoiceRealtimeSession implements VoiceSession {
  private readonly agent: VoiceAgent;
  private readonly channel: VoiceChannel;
  private readonly hooks: VoiceRealtimeSessionHooks;
  private readonly realtime: RealtimeVoiceAgent;
  private activeSessionId: string | null = null;
  private closed = false;
  private pendingCloseReason: string | null = null;

  constructor(dependencies: VoiceRealtimeSessionDependencies) {
    this.agent = dependencies.agent;
    this.channel = dependencies.channel;
    this.hooks = dependencies.hooks ?? {};
    this.realtime = dependencies.realtime;

    this.channel.onAudio((audio) => {
      this.realtime.appendAudio(audio);
    });
    this.channel.onControl((event) => {
      switch (event.type) {
        case "commit":
          this.realtime.commitAudio();
          this.realtime.createResponse();
          return;
        case "interrupt":
          this.realtime.interrupt();
          return;
        case "stop":
          this.consume(this.closeSession(event.reason ?? "Voice channel requested stop"));
          return;
        case "mark":
        case "start":
          return;
      }
    });
    this.channel.onClose(() => {
      this.close();
    });

    this.realtime.onAudio((audio) => {
      this.channel.sendAudio(audio);
    });
    this.realtime.onTranscript((transcript) => {
      this.consume(this.handleTranscript(transcript));
    });
    this.realtime.onToolCall((call) => {
      this.consume(this.executeToolCall(call));
    });
    this.realtime.onResponseDone(() => {
      this.handleResponseDone();
    });
    this.realtime.onError((error) => {
      this.channel.sendControl({
        message: error.message,
        type: "error",
      });
    });
    this.realtime.onClose(() => {
      this.close();
    });
  }

  get sessionId(): string | null {
    return this.activeSessionId;
  }

  close(): void {
    if (this.closed) {
      return;
    }

    this.closed = true;
    this.realtime.close();
  }

  async start(): Promise<void> {
    const startResult = await this.hooks.onStart?.(this.context());
    this.activeSessionId = startResult?.sessionId ?? this.channel.id;

    await this.realtime.connect();
    this.channel.sendControl({
      sessionId: this.activeSessionId,
      type: "ready",
    });
    this.realtime.createResponse();
  }

  private async closeSession(reason: string): Promise<void> {
    await this.hooks.onClose?.(this.context(), reason);
    this.realtime.close();
    this.channel.close(reason);
    this.close();
  }

  private consume(promise: Promise<void>): void {
    promise.catch((error: unknown) => {
      this.channel.sendControl({
        message: errorMessage(error),
        type: "error",
      });
    });
  }

  private context(): VoiceSessionContext {
    return {
      agentId: this.agent.profile.id,
      channelId: this.channel.id,
      sessionId: this.activeSessionId,
    };
  }

  private async executeToolCall(call: RealtimeToolCall): Promise<void> {
    const result = await executeRealtimeToolCall(this.agent.profile.tools ?? {}, {
      arguments: call.arguments,
      name: call.name,
    });

    this.realtime.sendToolOutput(call.callId, result.output);

    await this.applyAction(
      (await this.hooks.onToolResult?.(result, this.context())) ?? { type: "none" },
    );
  }

  private async applyAction(action: VoiceSessionAction): Promise<void> {
    switch (action.type) {
      case "close":
        if (action.closeChannelAfterResponse === true) {
          this.pendingCloseReason = action.reason;
          return;
        }

        await this.closeSession(action.reason);
        return;
      case "none":
        return;
    }
  }

  private handleResponseDone(): void {
    if (this.pendingCloseReason === null) {
      return;
    }

    const closeReason = this.pendingCloseReason;
    this.pendingCloseReason = null;
    this.channel.sendControl({
      reason: closeReason,
      type: "stop",
    });
    this.consume(this.closeSession(closeReason));
  }

  private async handleTranscript(transcript: VoiceTranscript): Promise<void> {
    this.channel.sendTranscript(transcript);
    await this.hooks.onTranscript?.(transcript, this.context());
  }
}
