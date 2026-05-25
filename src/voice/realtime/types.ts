import type { VoiceAudioChunk, VoiceTranscript } from "../channels/index.ts";

export interface RealtimeToolCall {
  readonly arguments: string;
  readonly callId: string;
  readonly name: string;
}

export type RealtimeAudioHandler = (audio: VoiceAudioChunk) => Promise<void> | void;
export type RealtimeCloseHandler = () => Promise<void> | void;
export type RealtimeErrorHandler = (error: Error) => void;
export type RealtimeResponseDoneHandler = () => Promise<void> | void;
export type RealtimeToolCallHandler = (call: RealtimeToolCall) => Promise<void> | void;
export type RealtimeTranscriptHandler = (transcript: VoiceTranscript) => Promise<void> | void;

export interface RealtimeVoiceAgent {
  appendAudio(audio: VoiceAudioChunk): void;
  clearAudio(): void;
  close(): void;
  commitAudio(): void;
  connect(): Promise<void>;
  createResponse(): void;
  interrupt(): void;
  onAudio(handler: RealtimeAudioHandler): void;
  onClose(handler: RealtimeCloseHandler): void;
  onError(handler: RealtimeErrorHandler): void;
  onResponseDone(handler: RealtimeResponseDoneHandler): void;
  onToolCall(handler: RealtimeToolCallHandler): void;
  onTranscript(handler: RealtimeTranscriptHandler): void;
  sendToolOutput(callId: string, output: unknown): void;
}
