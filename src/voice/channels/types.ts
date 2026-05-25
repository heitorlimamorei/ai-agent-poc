export type VoiceAudioFormat = "audio/pcm" | "audio/pcma" | "audio/pcmu";
export type VoiceTranscriptRole = "assistant" | "user";

export interface VoiceAudioChunk {
  readonly format: VoiceAudioFormat;
  readonly payload: string;
}

export type VoiceInboundControlEvent =
  | {
      readonly type: "commit";
    }
  | {
      readonly type: "interrupt";
    }
  | {
      readonly type: "mark";
      readonly name: string;
    }
  | {
      readonly type: "start";
      readonly metadata?: Record<string, unknown> | undefined;
    }
  | {
      readonly reason?: string | undefined;
      readonly type: "stop";
    };

export type VoiceOutboundControlEvent =
  | {
      readonly type: "error";
      readonly message: string;
    }
  | {
      readonly type: "mark";
      readonly name: string;
    }
  | {
      readonly type: "ready";
      readonly sessionId: string;
    }
  | {
      readonly reason?: string | undefined;
      readonly type: "stop";
    };

export interface VoiceTranscript {
  readonly partial?: boolean | undefined;
  readonly role: VoiceTranscriptRole;
  readonly text: string;
}

export type VoiceAudioHandler = (audio: VoiceAudioChunk) => Promise<void> | void;
export type VoiceCloseHandler = () => Promise<void> | void;
export type VoiceControlHandler = (event: VoiceInboundControlEvent) => Promise<void> | void;

export interface VoiceChannel {
  readonly id: string;
  close(reason?: string): void;
  onAudio(handler: VoiceAudioHandler): void;
  onClose(handler: VoiceCloseHandler): void;
  onControl(handler: VoiceControlHandler): void;
  sendAudio(audio: VoiceAudioChunk): void;
  sendControl(event: VoiceOutboundControlEvent): void;
  sendTranscript(transcript: VoiceTranscript): void;
}
