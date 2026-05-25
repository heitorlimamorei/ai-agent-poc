import { eq } from "drizzle-orm";

import type { DrizzleDatabase } from "../adpters/drizzle.ts";
import { saleSessions } from "../database/schema.ts";
import { type SaleSession, saleSessionFromRecord } from "../entities/index.ts";
import { err, type Result } from "../utils/result.ts";
import { saleDependencyFailure } from "./sale-shared.ts";

export interface SaleSessionRepository {
  closeSession: (id: string) => Promise<Result<SaleSession>>;
  createSession: () => Promise<Result<SaleSession>>;
  endSession: (id: string, orderId: string) => Promise<Result<SaleSession>>;
  getSession: (id: string) => Promise<Result<SaleSession>>;
}

export function NewSaleSessionRepository(db: DrizzleDatabase): SaleSessionRepository {
  const saleSessionColumns = {
    endedAt: saleSessions.endedAt,
    id: saleSessions.id,
    orderId: saleSessions.orderId,
    startedAt: saleSessions.startedAt,
  };

  async function createSession(): Promise<Result<SaleSession>> {
    let sessionRecord: unknown;

    try {
      const [createdSessionRecord] = await db
        .insert(saleSessions)
        .values({})
        .returning(saleSessionColumns);

      if (createdSessionRecord === undefined) {
        return err({
          code: "INTERNAL",
          message: "Failed to create sale session",
          origin: "SYSTEM",
        });
      }

      sessionRecord = createdSessionRecord;
    } catch (error) {
      return saleDependencyFailure(error, "Failed to create sale session");
    }

    return saleSessionFromRecord(sessionRecord);
  }

  async function getSession(id: string): Promise<Result<SaleSession>> {
    let sessionRecord: unknown;

    try {
      const [selectedSessionRecord] = await db
        .select(saleSessionColumns)
        .from(saleSessions)
        .where(eq(saleSessions.id, id))
        .limit(1);

      if (selectedSessionRecord === undefined) {
        return err({
          code: "NOT_FOUND",
          expose: true,
          message: "Sale session not found",
          origin: "DOMAIN",
        });
      }

      sessionRecord = selectedSessionRecord;
    } catch (error) {
      return saleDependencyFailure(error, "Failed to get sale session");
    }

    return saleSessionFromRecord(sessionRecord);
  }

  async function endSession(id: string, orderId: string): Promise<Result<SaleSession>> {
    let sessionRecord: unknown;

    try {
      const [updatedSessionRecord] = await db
        .update(saleSessions)
        .set({
          endedAt: new Date().toISOString(),
          orderId,
        })
        .where(eq(saleSessions.id, id))
        .returning(saleSessionColumns);

      if (updatedSessionRecord === undefined) {
        return err({
          code: "NOT_FOUND",
          expose: true,
          message: "Sale session not found",
          origin: "DOMAIN",
        });
      }

      sessionRecord = updatedSessionRecord;
    } catch (error) {
      return saleDependencyFailure(error, "Failed to end sale session");
    }

    return saleSessionFromRecord(sessionRecord);
  }

  async function closeSession(id: string): Promise<Result<SaleSession>> {
    let sessionRecord: unknown;

    try {
      const [updatedSessionRecord] = await db
        .update(saleSessions)
        .set({
          endedAt: new Date().toISOString(),
        })
        .where(eq(saleSessions.id, id))
        .returning(saleSessionColumns);

      if (updatedSessionRecord === undefined) {
        return err({
          code: "NOT_FOUND",
          expose: true,
          message: "Sale session not found",
          origin: "DOMAIN",
        });
      }

      sessionRecord = updatedSessionRecord;
    } catch (error) {
      return saleDependencyFailure(error, "Failed to close sale session");
    }

    return saleSessionFromRecord(sessionRecord);
  }

  return { closeSession, createSession, endSession, getSession };
}
