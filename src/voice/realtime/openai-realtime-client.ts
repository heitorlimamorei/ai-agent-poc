import { z } from "zod";
import type { RealtimeFunctionTool } from "../../ai/tools/index.ts";
import type { VoiceAudioChunk, VoiceAudioFormat } from "../channels/index.ts";
import type {
  RealtimeAudioHandler,
  RealtimeCloseHandler,
  RealtimeErrorHandler,
  RealtimeResponseDoneHandler,
  RealtimeToolCall,
  RealtimeToolCallHandler,
  RealtimeTranscriptHandler,
  RealtimeVoiceAgent,
} from "./types.ts";

const realtimeEventSchema = z.object({
  type: z.string(),
});

const realtimeErrorEventSchema = z.object({
  error: z.object({
    code: z.string().nullable().optional(),
    message: z.string(),
    param: z.string().nullable().optional(),
    type: z.string(),
  }),
  type: z.literal("error"),
});

const sessionUpdatedEventSchema = z.object({
  type: z.literal("session.updated"),
});

const outputAudioDeltaEventSchema = z.object({
  delta: z.string(),
  type: z.string(),
});

const transcriptDeltaEventSchema = z.object({
  delta: z.string(),
  type: z.string(),
});

const transcriptDoneEventSchema = z.object({
  item_id: z.string().optional(),
  transcript: z.string(),
  type: z.string(),
});

const outputTextDoneEventSchema = z.object({
  item_id: z.string().optional(),
  text: z.string(),
  type: z.string(),
});

const functionCallArgumentsDoneEventSchema = z.object({
  arguments: z.string(),
  call_id: z.string(),
  name: z.string(),
  type: z.string(),
});

const responseDoneEventSchema = z.object({
  response: z.object({
    output: z.array(
      z.object({
        arguments: z.string().optional(),
        call_id: z.string().optional(),
        name: z.string().optional(),
        type: z.string(),
      }),
    ),
  }),
  type: z.literal("response.done"),
});

const outputItemDoneEventSchema = z.object({
  item: z.object({
    arguments: z.string().optional(),
    call_id: z.string().optional(),
    name: z.string().optional(),
    type: z.string(),
  }),
  type: z.string(),
});

export type RealtimeTurnDetection =
  | {
      readonly createResponse?: boolean;
      readonly interruptResponse?: boolean;
      readonly prefixPaddingMs?: number;
      readonly silenceDurationMs?: number;
      readonly threshold?: number;
      readonly type: "server_vad";
    }
  | {
      readonly createResponse?: boolean;
      readonly eagerness?: "auto" | "high" | "low" | "medium";
      readonly interruptResponse?: boolean;
      readonly type: "semantic_vad";
    };

export type RealtimeTurnDetectionType = RealtimeTurnDetection["type"];

export type RealtimeReasoningEffort = "high" | "low" | "medium" | "minimal" | "xhigh";

export interface OpenAiRealtimeSessionConfig {
  readonly inputAudioFormat: VoiceAudioFormat;
  readonly instructions: string;
  readonly model: string;
  readonly outputAudioFormat: VoiceAudioFormat;
  readonly reasoning?: {
    readonly effort: RealtimeReasoningEffort;
  };
  readonly tools: readonly RealtimeFunctionTool[];
  readonly turnDetection: RealtimeTurnDetection;
  readonly voice: string;
}

export interface OpenAiRealtimeVoiceClientOptions {
  readonly apiKey: string;
  readonly session: OpenAiRealtimeSessionConfig;
}

function errorFromUnknown(error: unknown, fallbackMessage: string): Error {
  if (error instanceof Error) {
    return error;
  }

  return new Error(fallbackMessage, { cause: error });
}

function audioFormatRate(format: VoiceAudioChunk["format"]): number {
  switch (format) {
    case "audio/pcm":
      return 24_000;
    case "audio/pcma":
    case "audio/pcmu":
      return 8_000;
  }
}

function toOpenAiTurnDetection(turnDetection: RealtimeTurnDetection): Record<string, unknown> {
  if (turnDetection.type === "semantic_vad") {
    return {
      create_response: turnDetection.createResponse,
      eagerness: turnDetection.eagerness,
      interrupt_response: turnDetection.interruptResponse,
      type: turnDetection.type,
    };
  }

  return {
    create_response: turnDetection.createResponse,
    interrupt_response: turnDetection.interruptResponse,
    prefix_padding_ms: turnDetection.prefixPaddingMs,
    silence_duration_ms: turnDetection.silenceDurationMs,
    threshold: turnDetection.threshold,
    type: turnDetection.type,
  };
}

export class OpenAiRealtimeVoiceAgent implements RealtimeVoiceAgent {
  private readonly audioHandlers: RealtimeAudioHandler[] = [];
  private readonly closeHandlers: RealtimeCloseHandler[] = [];
  private readonly emittedFinalAssistantTranscriptKeys = new Set<string>();
  private readonly errorHandlers: RealtimeErrorHandler[] = [];
  private readonly handledToolCallIds = new Set<string>();
  private readonly options: OpenAiRealtimeVoiceClientOptions;
  private readonly pendingEvents: unknown[] = [];
  private readonly responseDoneHandlers: RealtimeResponseDoneHandler[] = [];
  private readonly toolCallHandlers: RealtimeToolCallHandler[] = [];
  private readonly transcriptHandlers: RealtimeTranscriptHandler[] = [];
  private socket: WebSocket | undefined;

  constructor(options: OpenAiRealtimeVoiceClientOptions) {
    this.options = options;
  }

  appendAudio(audio: VoiceAudioChunk): void {
    this.sendEvent({
      audio: audio.payload,
      type: "input_audio_buffer.append",
    });
  }

  clearAudio(): void {
    this.sendEvent({
      type: "input_audio_buffer.clear",
    });
  }

  close(): void {
    this.socket?.close();
  }

  commitAudio(): void {
    this.sendEvent({
      type: "input_audio_buffer.commit",
    });
  }

  async connect(): Promise<void> {
    if (this.socket !== undefined) {
      return;
    }

    const url = new URL("wss://api.openai.com/v1/realtime");
    url.searchParams.set("model", this.options.session.model);

    await new Promise<void>((resolve, reject) => {
      let opened = false;
      const socket = new WebSocket(url.toString(), {
        headers: {
          Authorization: `Bearer ${this.options.apiKey}`,
        },
      });

      this.socket = socket;

      socket.addEventListener("open", () => {
        opened = true;
        this.configureSession();
        this.flushPendingEvents();
      });

      socket.addEventListener("message", (event: MessageEvent<unknown>) => {
        const text = typeof event.data === "string" ? event.data : String(event.data);
        const parsedJson = JSON.parse(text) as unknown;
        const parsedEvent = realtimeEventSchema.parse(parsedJson);

        if (parsedEvent.type === "session.updated") {
          sessionUpdatedEventSchema.parse(parsedJson);
          resolve();
        }

        if (parsedEvent.type === "error") {
          const errorEvent = realtimeErrorEventSchema.parse(parsedJson);
          const error = new Error(errorEvent.error.message);

          this.emitError(error);
          reject(error);
          return;
        }

        this.consume(this.handleRawMessage(event.data));
      });

      socket.addEventListener("close", () => {
        if (!opened) {
          reject(new Error("OpenAI Realtime WebSocket closed before opening"));
          return;
        }

        this.consume(this.emitClose());
      });

      socket.addEventListener("error", () => {
        const error = new Error("OpenAI Realtime WebSocket error");
        this.emitError(error);
        reject(error);
      });
    });
  }

  createResponse(): void {
    this.emittedFinalAssistantTranscriptKeys.clear();
    this.sendEvent({
      response: {
        output_modalities: ["audio"],
      },
      type: "response.create",
    });
  }

  interrupt(): void {
    this.clearAudio();
    this.sendEvent({
      type: "response.cancel",
    });
  }

  onAudio(handler: RealtimeAudioHandler): void {
    this.audioHandlers.push(handler);
  }

  onClose(handler: RealtimeCloseHandler): void {
    this.closeHandlers.push(handler);
  }

  onError(handler: RealtimeErrorHandler): void {
    this.errorHandlers.push(handler);
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
    this.sendEvent({
      item: {
        call_id: callId,
        output: JSON.stringify(output),
        type: "function_call_output",
      },
      type: "conversation.item.create",
    });
    this.createResponse();
  }

  private configureSession(): void {
    const session = this.options.session;
    const inputRate = audioFormatRate(session.inputAudioFormat);
    const outputRate = audioFormatRate(session.outputAudioFormat);

    this.sendEvent({
      session: {
        audio: {
          input: {
            format: {
              rate: inputRate,
              type: session.inputAudioFormat,
            },
            noise_reduction: {
              type: "near_field",
            },
            turn_detection: toOpenAiTurnDetection(session.turnDetection),
          },
          output: {
            format: {
              rate: outputRate,
              type: session.outputAudioFormat,
            },
            voice: session.voice,
          },
        },
        instructions: session.instructions,
        model: session.model,
        output_modalities: ["audio"],
        reasoning: session.reasoning,
        tools: session.tools,
        tool_choice: "auto",
        type: "realtime",
      },
      type: "session.update",
    });
  }

  private consume(promise: Promise<void>): void {
    promise.catch((error: unknown) => {
      this.emitError(errorFromUnknown(error, "OpenAI Realtime event handling failed"));
    });
  }

  private async emitAudio(audio: VoiceAudioChunk): Promise<void> {
    for (const handler of this.audioHandlers) {
      await handler(audio);
    }
  }

  private async emitClose(): Promise<void> {
    for (const handler of this.closeHandlers) {
      await handler();
    }
  }

  private emitError(error: Error): void {
    for (const handler of this.errorHandlers) {
      handler(error);
    }
  }

  private async emitResponseDone(): Promise<void> {
    for (const handler of this.responseDoneHandlers) {
      await handler();
    }
  }

  private async emitToolCall(call: RealtimeToolCall): Promise<void> {
    if (this.handledToolCallIds.has(call.callId)) {
      return;
    }

    this.handledToolCallIds.add(call.callId);

    for (const handler of this.toolCallHandlers) {
      await handler(call);
    }
  }

  private async emitTranscript(
    role: "assistant" | "user",
    text: string,
    partial = false,
  ): Promise<void> {
    if (text.trim().length === 0) {
      return;
    }

    for (const handler of this.transcriptHandlers) {
      await handler({
        partial,
        role,
        text,
      });
    }
  }

  private async emitFinalAssistantTranscript(
    itemId: string | undefined,
    text: string,
  ): Promise<void> {
    const normalizedText = text.trim().replaceAll(/\s+/g, " ");
    const key = `${itemId ?? "text"}:${normalizedText}`;

    if (this.emittedFinalAssistantTranscriptKeys.has(key)) {
      return;
    }

    this.emittedFinalAssistantTranscriptKeys.add(key);
    await this.emitTranscript("assistant", text);
  }

  private flushPendingEvents(): void {
    const events = [...this.pendingEvents];
    this.pendingEvents.length = 0;

    for (const event of events) {
      this.sendEvent(event);
    }
  }

  private async handleRawMessage(data: unknown): Promise<void> {
    const text = typeof data === "string" ? data : String(data);
    const parsedJson = JSON.parse(text) as unknown;
    const event = realtimeEventSchema.parse(parsedJson);

    switch (event.type) {
      case "conversation.item.input_audio_transcription.completed": {
        const transcriptEvent = transcriptDoneEventSchema.parse(parsedJson);
        await this.emitTranscript("user", transcriptEvent.transcript);
        return;
      }
      case "response.audio.delta":
      case "response.output_audio.delta": {
        const audioEvent = outputAudioDeltaEventSchema.parse(parsedJson);
        await this.emitAudio({
          format: this.options.session.outputAudioFormat,
          payload: audioEvent.delta,
        });
        return;
      }
      case "response.audio_transcript.delta":
      case "response.output_audio_transcript.delta":
      case "response.output_text.delta": {
        const transcriptEvent = transcriptDeltaEventSchema.parse(parsedJson);
        await this.emitTranscript("assistant", transcriptEvent.delta, true);
        return;
      }
      case "response.audio_transcript.done":
      case "response.output_audio_transcript.done": {
        const transcriptEvent = transcriptDoneEventSchema.parse(parsedJson);
        await this.emitFinalAssistantTranscript(
          transcriptEvent.item_id,
          transcriptEvent.transcript,
        );
        return;
      }
      case "response.output_text.done": {
        const transcriptEvent = outputTextDoneEventSchema.parse(parsedJson);
        await this.emitFinalAssistantTranscript(transcriptEvent.item_id, transcriptEvent.text);
        return;
      }
      case "response.function_call_arguments.done": {
        functionCallArgumentsDoneEventSchema.parse(parsedJson);
        return;
      }
      case "response.output_item.done": {
        outputItemDoneEventSchema.parse(parsedJson);
        return;
      }
      case "response.done": {
        const responseDoneEvent = responseDoneEventSchema.parse(parsedJson);

        for (const item of responseDoneEvent.response.output) {
          if (
            item.type !== "function_call" ||
            item.call_id === undefined ||
            item.name === undefined ||
            item.arguments === undefined
          ) {
            continue;
          }

          await this.emitToolCall({
            arguments: item.arguments,
            callId: item.call_id,
            name: item.name,
          });
        }

        await this.emitResponseDone();

        return;
      }
      default:
        return;
    }
  }

  private isOpen(): boolean {
    return this.socket?.readyState === WebSocket.OPEN;
  }

  private sendEvent(event: unknown): void {
    if (!this.isOpen()) {
      this.pendingEvents.push(event);
      return;
    }

    this.socket?.send(JSON.stringify(event));
  }
}
