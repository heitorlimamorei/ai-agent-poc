import type { ModelMessage } from "ai";

import type { SaleSessionService } from "../../services/index.ts";
import type { VoiceAgent } from "../agents/index.ts";
import type { VoiceChannel, VoiceTranscript } from "../channels/index.ts";
import type { RealtimeVoiceAgent } from "../realtime/index.ts";
import {
  VoiceRealtimeSession,
  type VoiceRealtimeSessionHooks,
  type VoiceSession,
  type VoiceSessionContext,
} from "../sessions/index.ts";
import type { SellerVoiceAgentProfile } from "./seller-voice-profile.ts";

export interface SellerVoiceSessionDependencies {
  readonly agent: VoiceAgent;
  readonly channel: VoiceChannel;
  readonly profile: SellerVoiceAgentProfile;
  readonly realtime: RealtimeVoiceAgent;
  readonly saleSessionService: SaleSessionService;
}

export type SellerVoiceSession = VoiceSession;

function transcriptToMessage(transcript: VoiceTranscript): ModelMessage {
  return {
    content: transcript.text,
    role: transcript.role,
  };
}

function shouldPersistTranscript(transcript: VoiceTranscript): boolean {
  return transcript.partial !== true && transcript.text.trim().length > 0;
}

export function NewSellerVoiceSessionHooks(dependencies: {
  readonly profile: SellerVoiceAgentProfile;
  readonly saleSessionService: SaleSessionService;
}): VoiceRealtimeSessionHooks {
  const closedSessionIds = new Set<string>();

  async function closeSaleSession(sessionId: string): Promise<void> {
    if (closedSessionIds.has(sessionId)) {
      return;
    }

    const [, closeFailure] = await dependencies.saleSessionService.closeSession(sessionId);

    if (closeFailure !== null) {
      throw new Error(closeFailure.message, { cause: closeFailure });
    }

    closedSessionIds.add(sessionId);
  }

  return {
    async onClose(context): Promise<void> {
      if (context.sessionId === null) {
        return;
      }

      await closeSaleSession(context.sessionId);
    },
    async onStart(): Promise<{ sessionId: string }> {
      const [session, sessionFailure] = await dependencies.saleSessionService.createSession();

      if (sessionFailure !== null) {
        throw new Error(sessionFailure.message, { cause: sessionFailure });
      }

      return {
        sessionId: session.id,
      };
    },
    async onToolResult(result, context: VoiceSessionContext) {
      const action = await dependencies.profile.handleToolResult(result);

      if (action.type === "end-session-with-order") {
        if (context.sessionId === null) {
          return { type: "none" };
        }

        const [, endFailure] = await dependencies.saleSessionService.endSessionWithOrder(
          context.sessionId,
          action.orderId,
        );

        if (endFailure !== null) {
          throw new Error(endFailure.message, { cause: endFailure });
        }

        return { type: "none" };
      }

      if (action.type === "close-session") {
        if (context.sessionId !== null) {
          await closeSaleSession(context.sessionId);
        }

        return {
          closeChannelAfterResponse: action.closeChannelAfterResponse,
          reason: action.reason,
          type: "close",
        };
      }

      return { type: "none" };
    },
    async onTranscript(transcript, context): Promise<void> {
      if (context.sessionId === null || !shouldPersistTranscript(transcript)) {
        return;
      }

      const [, appendFailure] = await dependencies.saleSessionService.appendMessages(
        context.sessionId,
        [transcriptToMessage(transcript)],
      );

      if (appendFailure !== null) {
        throw new Error(appendFailure.message, { cause: appendFailure });
      }
    },
  };
}

export class SellerRealtimeVoiceSession implements SellerVoiceSession {
  private readonly session: VoiceRealtimeSession;

  constructor(dependencies: SellerVoiceSessionDependencies) {
    this.session = new VoiceRealtimeSession({
      agent: dependencies.agent,
      channel: dependencies.channel,
      hooks: NewSellerVoiceSessionHooks({
        profile: dependencies.profile,
        saleSessionService: dependencies.saleSessionService,
      }),
      realtime: dependencies.realtime,
    });
  }

  get sessionId(): string | null {
    return this.session.sessionId;
  }

  close(): void {
    this.session.close();
  }

  async start(): Promise<void> {
    await this.session.start();
  }
}
