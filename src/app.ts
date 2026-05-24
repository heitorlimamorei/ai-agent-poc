import { NewAdpters } from "./adpters/index.ts";
import { NewSellerAgent } from "./ai/agents/index.ts";
import { NewAppConfig } from "./config/index.ts";
import {
  NewOrderRepository,
  NewProductRepository,
  NewSaleRepository,
} from "./repositories/index.ts";
import { NewRoutes } from "./routes/index.ts";
import { NewOrderService, NewProductService, NewSaleService } from "./services/index.ts";

export interface App {
  readonly fetch: (request: Request) => Response | Promise<Response>;
  readonly hostname: string;
  readonly port: number;
}

export async function NewApp(): Promise<App> {
  const appConfig = NewAppConfig(Bun.env);
  const adpters = await NewAdpters(appConfig);
  const productRepository = NewProductRepository(adpters.db);
  const orderRepository = NewOrderRepository(adpters.db);
  const saleRepository = NewSaleRepository(adpters.db);
  const productService = NewProductService(adpters.ai, productRepository);
  const orderService = NewOrderService(orderRepository);
  const sellerAgent = NewSellerAgent({
    newAgent: adpters.ai.newAgent,
    orderService,
    productService,
  });
  const saleService = NewSaleService({
    saleRepository,
    sellerAgent,
  });
  const routes = NewRoutes(productService, orderService, saleService);

  return {
    fetch(request: Request): Response | Promise<Response> {
      return routes.fetch(request);
    },
    hostname: appConfig.HOSTNAME,
    port: appConfig.PORT,
  };
}
