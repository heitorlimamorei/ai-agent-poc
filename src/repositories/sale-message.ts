import type { ModelMessage } from "ai";
import { desc, eq } from "drizzle-orm";

import type { DrizzleDatabase } from "../adpters/drizzle.ts";
import { saleMessages } from "../database/schema.ts";
import {
  newSaleMessageToRecord,
  type SaleMessage,
  saleMessageFromRecord,
} from "../entities/index.ts";
import { err, ok, type Result } from "../utils/result.ts";
import { saleDependencyFailure } from "./sale-shared.ts";

export interface SaleMessageRepository {
  appendMessages: (
    sessionId: string,
    messages: readonly ModelMessage[],
  ) => Promise<Result<SaleMessage[]>>;
  listMessages: (sessionId: string) => Promise<Result<ModelMessage[]>>;
}

export function NewSaleMessageRepository(db: DrizzleDatabase): SaleMessageRepository {
  const saleMessageColumns = {
    createdAt: saleMessages.createdAt,
    id: saleMessages.id,
    message: saleMessages.message,
    sequence: saleMessages.sequence,
    sessionId: saleMessages.sessionId,
  };

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
      return saleDependencyFailure(error, "Failed to get sale message sequence");
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
      return saleDependencyFailure(error, "Failed to append sale messages");
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
      return saleDependencyFailure(error, "Failed to list sale messages");
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

  return { appendMessages, listMessages };
}
