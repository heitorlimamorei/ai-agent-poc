import type { ModelMessage } from "ai";
import { desc, eq } from "drizzle-orm";

import type { DrizzleDatabase } from "../adpters/drizzle.ts";
import { saleMessages, saleSessions } from "../database/schema.ts";
import {
  newSaleMessageToRecord,
  type SaleMessage,
  type SaleSession,
  saleMessageFromRecord,
  saleSessionFromRecord,
} from "../entities/index.ts";
import { err, ok, type Result } from "../utils/result.ts";

export interface SaleRepository {
  appendMessages: (
    sessionId: string,
    messages: readonly ModelMessage[],
  ) => Promise<Result<SaleMessage[]>>;
  createSession: () => Promise<Result<SaleSession>>;
  endSession: (id: string, orderId: string) => Promise<Result<SaleSession>>;
  getSession: (id: string) => Promise<Result<SaleSession>>;
  listMessages: (sessionId: string) => Promise<Result<ModelMessage[]>>;
}

function dependencyFailure(error: unknown, message: string): Result<never> {
  return err({
    cause: error,
    code: "DEPENDENCY_FAILURE",
    message,
    origin: "DEPENDENCY",
  });
}

export function NewSaleRepository(db: DrizzleDatabase): SaleRepository {
  const saleSessionColumns = {
    endedAt: saleSessions.endedAt,
    id: saleSessions.id,
    orderId: saleSessions.orderId,
    startedAt: saleSessions.startedAt,
  };

  const saleMessageColumns = {
    createdAt: saleMessages.createdAt,
    id: saleMessages.id,
    message: saleMessages.message,
    sequence: saleMessages.sequence,
    sessionId: saleMessages.sessionId,
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
      return dependencyFailure(error, "Failed to create sale session");
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
      return dependencyFailure(error, "Failed to get sale session");
    }

    return saleSessionFromRecord(sessionRecord);
  }

  async function lastSequence(sessionId: string): Promise<Result<number>> {
    try {
      const [lastMessageRecord] = await db
        .select({
          sequence: saleMessages.sequence,
        })
        .from(saleMessages)
        .where(eq(saleMessages.sessionId, sessionId))
        .orderBy(desc(saleMessages.sequence))
        .limit(1);

      return ok(lastMessageRecord?.sequence ?? -1);
    } catch (error) {
      return dependencyFailure(error, "Failed to get sale message sequence");
    }
  }

  async function appendMessages(
    sessionId: string,
    messages: readonly ModelMessage[],
  ): Promise<Result<SaleMessage[]>> {
    if (messages.length === 0) {
      return ok([]);
    }

    const [sequence, sequenceFailure] = await lastSequence(sessionId);

    if (sequenceFailure !== null) {
      return err(sequenceFailure);
    }

    const messageRecords = messages.map((message, index) =>
      newSaleMessageToRecord({
        message,
        sequence: sequence + index + 1,
        sessionId,
      }),
    );

    const validMessageRecords = [];

    for (const [messageRecord, messageFailure] of messageRecords) {
      if (messageFailure !== null) {
        return err(messageFailure);
      }

      validMessageRecords.push(messageRecord);
    }

    let insertedMessageRecords: unknown[];

    try {
      insertedMessageRecords = await db
        .insert(saleMessages)
        .values(validMessageRecords)
        .returning(saleMessageColumns);
    } catch (error) {
      return dependencyFailure(error, "Failed to append sale messages");
    }

    const parsedMessages: SaleMessage[] = [];

    for (const messageRecord of insertedMessageRecords) {
      const [message, messageFailure] = saleMessageFromRecord(messageRecord);

      if (messageFailure !== null) {
        return err(messageFailure);
      }

      parsedMessages.push(message);
    }

    return ok(parsedMessages);
  }

  async function listMessages(sessionId: string): Promise<Result<ModelMessage[]>> {
    let messageRecords: unknown[];

    try {
      messageRecords = await db
        .select(saleMessageColumns)
        .from(saleMessages)
        .where(eq(saleMessages.sessionId, sessionId))
        .orderBy(saleMessages.sequence);
    } catch (error) {
      return dependencyFailure(error, "Failed to list sale messages");
    }

    const messages: ModelMessage[] = [];

    for (const messageRecord of messageRecords) {
      const [message, messageFailure] = saleMessageFromRecord(messageRecord);

      if (messageFailure !== null) {
        return err(messageFailure);
      }

      messages.push(message.message);
    }

    return ok(messages);
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
      return dependencyFailure(error, "Failed to end sale session");
    }

    return saleSessionFromRecord(sessionRecord);
  }

  return { appendMessages, createSession, endSession, getSession, listMessages };
}
