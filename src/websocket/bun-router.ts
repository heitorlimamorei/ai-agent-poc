import type {
  WebSocketConnectionData,
  WebSocketRouteDefinition,
  WebSocketRouter,
} from "./types.ts";

function routeDefinitionAt(
  routes: readonly WebSocketRouteDefinition<unknown>[],
  index: number,
): WebSocketRouteDefinition<unknown> | undefined {
  return routes[index];
}

export function NewBunWebSocketRouter(
  routes: readonly WebSocketRouteDefinition<unknown>[],
): WebSocketRouter {
  function findRoute(request: Request): {
    readonly index: number;
    readonly route: WebSocketRouteDefinition<unknown>;
  } | null {
    const url = new URL(request.url);
    const routeIndex = routes.findIndex((route) => route.path === url.pathname);

    if (routeIndex < 0) {
      return null;
    }

    const route = routes[routeIndex];

    if (route === undefined) {
      return null;
    }

    return {
      index: routeIndex,
      route,
    };
  }

  return {
    handler: {
      async close(ws, code, reason): Promise<void> {
        const route = routeDefinitionAt(routes, ws.data.routeIndex);

        await route?.handler.close?.(ws, code, reason);
      },
      data: {} as WebSocketConnectionData,
      async message(ws, message): Promise<void> {
        const route = routeDefinitionAt(routes, ws.data.routeIndex);

        await route?.handler.message(ws, message);
      },
      async open(ws): Promise<void> {
        const route = routeDefinitionAt(routes, ws.data.routeIndex);

        await route?.handler.open?.(ws);
      },
    },
    matches(request): boolean {
      return findRoute(request) !== null;
    },
    upgrade(request, server): Response | undefined {
      const matchedRoute = findRoute(request);

      if (matchedRoute === null) {
        return undefined;
      }

      const upgraded = server.upgrade(request, {
        data: {
          routeIndex: matchedRoute.index,
          routeState: matchedRoute.route.createData(request),
        },
      });

      if (upgraded) {
        return undefined;
      }

      return new Response("WebSocket upgrade failed", { status: 400 });
    },
  };
}
