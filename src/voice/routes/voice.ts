import type { WebSocketConnectionData, WebSocketRouteDefinition } from "../../websocket/index.ts";
import type { VoiceAgent } from "../agents/index.ts";
import { BunWebSocketVoiceChannel, type VoiceAudioFormat } from "../channels/index.ts";
import {
  VoiceRealtimeSession,
  type VoiceRealtimeSessionHooks,
  type VoiceSession,
} from "../sessions/index.ts";

export const sellerVoiceWebSocketPath = "/voice/seller/ws";

export interface VoiceWebSocketRouteDependencies {
  readonly agent: VoiceAgent;
  readonly defaultAudioFormat: VoiceAudioFormat;
  readonly hooks?: VoiceRealtimeSessionHooks;
  readonly path: string;
}

export interface VoiceWebSocketData {
  readonly dependencies: VoiceWebSocketRouteDependencies;
  readonly requestUrl: string;
  channel?: BunWebSocketVoiceChannel;
  session?: VoiceSession;
}

function parseVoiceAudioFormat(value: string): VoiceAudioFormat {
  if (value === "audio/pcm" || value === "audio/pcma" || value === "audio/pcmu") {
    return value;
  }

  return "audio/pcmu";
}

function voiceWebSocketDataFromConnection(data: WebSocketConnectionData): VoiceWebSocketData {
  return data.routeState as VoiceWebSocketData;
}

export function NewVoiceWebSocketRoute(
  dependencies: VoiceWebSocketRouteDependencies,
): WebSocketRouteDefinition<VoiceWebSocketData> {
  return {
    createData(request): VoiceWebSocketData {
      return {
        dependencies,
        requestUrl: request.url,
      };
    },
    handler: {
      async close(ws): Promise<void> {
        const routeData = voiceWebSocketDataFromConnection(ws.data);

        await routeData.channel?.closed();
      },
      data: {} as WebSocketConnectionData,
      async message(ws, message): Promise<void> {
        const routeData = voiceWebSocketDataFromConnection(ws.data);

        try {
          await routeData.channel?.acceptMessage(message);
        } catch (error) {
          routeData.channel?.sendError(error);
        }
      },
      async open(ws): Promise<void> {
        const routeData = voiceWebSocketDataFromConnection(ws.data);
        const url = new URL(routeData.requestUrl);
        const audioFormat = parseVoiceAudioFormat(
          url.searchParams.get("format") ?? routeData.dependencies.defaultAudioFormat,
        );
        const channel = new BunWebSocketVoiceChannel(ws, {
          defaultAudioFormat: audioFormat,
        });
        const realtime = routeData.dependencies.agent.newRealtimeAgent({
          audioFormat,
        });
        const sessionDependencies = {
          agent: routeData.dependencies.agent,
          channel,
          realtime,
        };
        const session = new VoiceRealtimeSession(
          routeData.dependencies.hooks === undefined
            ? sessionDependencies
            : {
                ...sessionDependencies,
                hooks: routeData.dependencies.hooks,
              },
        );

        routeData.channel = channel;
        routeData.session = session;

        try {
          await session.start();
        } catch (error) {
          channel.sendError(error);
          channel.close("Failed to start voice session");
        }
      },
    },
    path: dependencies.path,
  };
}
