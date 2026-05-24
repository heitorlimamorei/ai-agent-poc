import { NewAdpters } from "./adpters/index.ts";
import { NewAppConfig } from "./config/index.ts";
import { NewProductRepository } from "./repositories/index.ts";
import { NewRoutes } from "./routes/index.ts";
import { NewProductService } from "./services/index.ts";

export interface App {
  readonly fetch: (request: Request) => Response | Promise<Response>;
  readonly hostname: string;
  readonly port: number;
}

export async function NewApp(): Promise<App> {
  const appConfig = NewAppConfig(Bun.env);
  const adpters = await NewAdpters(appConfig);
  const productRepository = NewProductRepository(adpters.db);
  const productService = NewProductService(adpters.ai, productRepository);
  const routes = NewRoutes(productService);

  return {
    fetch(request: Request): Response | Promise<Response> {
      return routes.fetch(request);
    },
    hostname: appConfig.HOSTNAME,
    port: appConfig.PORT,
  };
}
