import { NewAdpters } from "./adpters/index.ts";
import { NewSellerAgent } from "./ai/agents/index.ts";
import { NewAppConfig } from "./config/index.ts";
import {
  NewOrderRepository,
  NewProductRepository,
  NewSaleMessageRepository,
  NewSaleRepository,
  NewSaleSessionRepository,
} from "./repositories/index.ts";
import { NewRoutes } from "./routes/index.ts";
import {
  NewOrderService,
  NewProductService,
  NewSaleService,
  NewSaleSessionService,
} from "./services/index.ts";
import {
  NewSellerVoiceAgentProfile,
  NewSellerVoiceSessionHooks,
  NewVoiceAgent,
  NewVoiceAgentRegistry,
  NewVoiceWebSocketRoute,
  sellerVoiceWebSocketPath,
} from "./voice/index.ts";
import { NewBunWebSocketRouter, type WebSocketConnectionData } from "./websocket/index.ts";

export interface App {
  readonly fetch: (
    request: Request,
    server: Bun.Server<WebSocketConnectionData>,
  ) => Response | Promise<Response | undefined> | undefined;
  readonly hostname: string;
  readonly port: number;
  readonly websocket: Bun.WebSocketHandler<WebSocketConnectionData>;
}

export async function NewApp(): Promise<App> {
  const appConfig = NewAppConfig(Bun.env);
  const adpters = await NewAdpters(appConfig);
  const productRepository = NewProductRepository(adpters.db);
  const orderRepository = NewOrderRepository(adpters.db);
  const saleRepository = NewSaleRepository(adpters.db);
  const saleMessageRepository = NewSaleMessageRepository(adpters.db);
  const saleSessionRepository = NewSaleSessionRepository(adpters.db);
  const productService = NewProductService(adpters.ai, productRepository);
  const orderService = NewOrderService(orderRepository);
  const saleSessionService = NewSaleSessionService({
    saleMessageRepository,
    saleSessionRepository,
  });
  const sellerAgent = NewSellerAgent({
    newAgent: adpters.ai.newAgent,
    orderService,
    productService,
  });
  const saleService = NewSaleService({
    ai: adpters.ai,
    saleRepository,
    sellerAgent,
  });
  const routes = NewRoutes(productService, orderService, saleService);

  const voiceModel = adpters.openAiRealtime.newModel({
    reasoningEffort: "low",
    turnDetection: {
      prefixPaddingMs: 250,
      silenceDurationMs: 650,
      threshold: 0.65,
      type: "server_vad",
    },
  });

  const sellerVoiceAgentProfile = NewSellerVoiceAgentProfile({
    orderService,
    productService,
  });

  const sellerVoiceAgent = NewVoiceAgent({
    model: voiceModel,
    profile: sellerVoiceAgentProfile,
  });

  const voiceAgentRegistry = NewVoiceAgentRegistry([
    {
      agent: sellerVoiceAgent,
      hooks: NewSellerVoiceSessionHooks({
        profile: sellerVoiceAgentProfile,
        saleSessionService,
      }),
      path: sellerVoiceWebSocketPath,
    },
  ]);

  const webSocketRouter = NewBunWebSocketRouter(
    voiceAgentRegistry.list().map((registration) => {
      const route = {
        agent: registration.agent,
        defaultAudioFormat: appConfig.VOICE_AUDIO_FORMAT,
        path: registration.path,
      };

      if (registration.hooks === undefined) {
        return NewVoiceWebSocketRoute(route);
      }

      return NewVoiceWebSocketRoute({
        ...route,
        hooks: registration.hooks,
      });
    }),
  );

  return {
    fetch(
      request: Request,
      server: Bun.Server<WebSocketConnectionData>,
    ): Response | Promise<Response | undefined> | undefined {
      const isWebSocketRoute = webSocketRouter.matches(request);
      const webSocketUpgradeResponse = webSocketRouter.upgrade(request, server);

      if (webSocketUpgradeResponse !== undefined) {
        return webSocketUpgradeResponse;
      }

      if (isWebSocketRoute) {
        return undefined;
      }

      return routes.fetch(request);
    },
    hostname: appConfig.HOSTNAME,
    port: appConfig.PORT,
    websocket: webSocketRouter.handler,
  };
}
