import { z } from "zod";

import type {
  VoiceAudioChunk,
  VoiceAudioFormat,
  VoiceAudioHandler,
  VoiceChannel,
  VoiceCloseHandler,
  VoiceControlHandler,
  VoiceInboundControlEvent,
  VoiceOutboundControlEvent,
  VoiceTranscript,
} from "./types.ts";

const voiceAudioFormatSchema = z.enum(["audio/pcm", "audio/pcma", "audio/pcmu"]);

const incomingVoiceMessageSchema = z.discriminatedUnion("type", [
  z.object({
    format: voiceAudioFormatSchema.optional(),
    payload: z.string().min(1),
    type: z.literal("audio"),
  }),
  z.object({
    event: z.discriminatedUnion("type", [
      z.object({
        type: z.literal("commit"),
      }),
      z.object({
        type: z.literal("interrupt"),
      }),
      z.object({
        name: z.string().min(1),
        type: z.literal("mark"),
      }),
      z.object({
        metadata: z.record(z.string(), z.unknown()).optional(),
        type: z.literal("start"),
      }),
      z.object({
        reason: z.string().min(1).optional(),
        type: z.literal("stop"),
      }),
    ]),
    type: z.literal("control"),
  }),
]);

export interface BunWebSocketVoiceChannelOptions {
  readonly defaultAudioFormat: VoiceAudioFormat;
}

export class BunWebSocketVoiceChannel implements VoiceChannel {
  readonly id = crypto.randomUUID();
  private readonly audioHandlers: VoiceAudioHandler[] = [];
  private readonly closeHandlers: VoiceCloseHandler[] = [];
  private readonly controlHandlers: VoiceControlHandler[] = [];
  private readonly defaultAudioFormat: VoiceAudioFormat;
  private readonly ws: Bun.ServerWebSocket<unknown>;

  constructor(ws: Bun.ServerWebSocket<unknown>, options: BunWebSocketVoiceChannelOptions) {
    this.defaultAudioFormat = options.defaultAudioFormat;
    this.ws = ws;
  }

  async acceptMessage(message: string | Buffer<ArrayBuffer>): Promise<void> {
    if (typeof message !== "string") {
      await this.emitAudio({
        format: this.defaultAudioFormat,
        payload: message.toString("base64"),
      });
      return;
    }

    const parsedJson = JSON.parse(message) as unknown;
    const parsedMessage = incomingVoiceMessageSchema.parse(parsedJson);

    if (parsedMessage.type === "audio") {
      await this.emitAudio({
        format: parsedMessage.format ?? this.defaultAudioFormat,
        payload: parsedMessage.payload,
      });
      return;
    }

    await this.emitControl(parsedMessage.event);
  }

  close(reason = "Voice channel closed"): void {
    this.ws.close(1000, reason);
  }

  async closed(): Promise<void> {
    for (const handler of this.closeHandlers) {
      await handler();
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
    this.sendJson({
      format: audio.format,
      payload: audio.payload,
      type: "audio",
    });
  }

  sendControl(event: VoiceOutboundControlEvent): void {
    this.sendJson({
      event,
      type: "control",
    });
  }

  sendTranscript(transcript: VoiceTranscript): void {
    this.sendJson({
      partial: transcript.partial ?? false,
      role: transcript.role,
      text: transcript.text,
      type: "transcript",
    });
  }

  sendError(error: unknown): void {
    this.sendControl({
      message: error instanceof Error ? error.message : "Voice channel error",
      type: "error",
    });
  }

  private async emitAudio(audio: VoiceAudioChunk): Promise<void> {
    for (const handler of this.audioHandlers) {
      await handler(audio);
    }
  }

  private async emitControl(event: VoiceInboundControlEvent): Promise<void> {
    for (const handler of this.controlHandlers) {
      await handler(event);
    }
  }

  private sendJson(value: unknown): void {
    this.ws.send(JSON.stringify(value));
  }
}
