import type { DrizzleDatabase } from "../adpters/drizzle.ts";
import { NewSaleMessageRepository, type SaleMessageRepository } from "./sale-message.ts";
import { NewSaleSessionRepository, type SaleSessionRepository } from "./sale-session.ts";

export interface SaleRepository extends SaleSessionRepository, SaleMessageRepository {}

export function NewSaleRepository(db: DrizzleDatabase): SaleRepository {
  return {
    ...NewSaleSessionRepository(db),
    ...NewSaleMessageRepository(db),
  };
}
