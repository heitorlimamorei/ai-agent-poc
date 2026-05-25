export interface WebSocketRouteDefinition<Data> {
  readonly path: string;
  createData(request: Request): Data;
  handler: Bun.WebSocketHandler<WebSocketConnectionData>;
}

export interface WebSocketConnectionData {
  readonly routeIndex: number;
  readonly routeState: unknown;
}

export interface WebSocketRouter {
  readonly handler: Bun.WebSocketHandler<WebSocketConnectionData>;
  matches(request: Request): boolean;
  upgrade(request: Request, server: Bun.Server<WebSocketConnectionData>): Response | undefined;
}
