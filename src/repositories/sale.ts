import type { DrizzleDatabase } from "../adpters/drizzle.ts";
import { NewSaleMemoryRepository, type SaleMemoryRepository } from "./sale-memory.ts";
import { NewSaleMessageRepository, type SaleMessageRepository } from "./sale-message.ts";
import { NewSaleSessionRepository, type SaleSessionRepository } from "./sale-session.ts";

export interface SaleRepository
  extends SaleSessionRepository,
    SaleMessageRepository,
    SaleMemoryRepository {}

export function NewSaleRepository(db: DrizzleDatabase): SaleRepository {
  return {
    ...NewSaleMemoryRepository(db),
    ...NewSaleSessionRepository(db),
    ...NewSaleMessageRepository(db),
  };
}
