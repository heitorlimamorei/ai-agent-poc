import { and, gte, ne } from "drizzle-orm";
import { cosineDistance } from "drizzle-orm/sql/functions/vector";

import type { DrizzleDatabase } from "../adpters/drizzle.ts";
import { saleMemoryEpisodes } from "../database/schema.ts";
import {
  type NewSaleMemoryEpisode,
  newSaleMemoryEpisodeToRecord,
  type SaleMemoryEpisode,
  type SaleMemoryEpisodeSearchResult,
  saleMemoryEpisodeFromRecord,
  saleMemoryEpisodeSearchResultFromRecord,
} from "../entities/index.ts";
import { err, ok, type Result } from "../utils/result.ts";
import { saleDependencyFailure } from "./sale-shared.ts";

export interface SearchSaleMemoryEpisodesOptions {
  readonly excludeSessionId?: string;
  readonly limit?: number;
  readonly minConfidence?: number;
}

export interface SaleMemoryRepository {
  createMemoryEpisode: (episode: NewSaleMemoryEpisode) => Promise<Result<SaleMemoryEpisode>>;
  searchMemoryEpisodes: (
    embedding: number[],
    options?: SearchSaleMemoryEpisodesOptions,
  ) => Promise<Result<SaleMemoryEpisodeSearchResult[]>>;
}

export function NewSaleMemoryRepository(db: DrizzleDatabase): SaleMemoryRepository {
  const saleMemoryEpisodeColumns = {
    assistantResponse: saleMemoryEpisodes.assistantResponse,
    confidence: saleMemoryEpisodes.confidence,
    createdAt: saleMemoryEpisodes.createdAt,
    id: saleMemoryEpisodes.id,
    orderId: saleMemoryEpisodes.orderId,
    sessionId: saleMemoryEpisodes.sessionId,
    toolCalls: saleMemoryEpisodes.toolCalls,
    userMessage: saleMemoryEpisodes.userMessage,
  };

  async function createMemoryEpisode(
    episode: NewSaleMemoryEpisode,
  ): Promise<Result<SaleMemoryEpisode>> {
    const [validEpisodeRecord, invalidEpisodeFailure] = newSaleMemoryEpisodeToRecord(episode);

    if (invalidEpisodeFailure !== null) {
      return err(invalidEpisodeFailure);
    }

    let episodeRecord: unknown;

    try {
      const [createdEpisodeRecord] = await db
        .insert(saleMemoryEpisodes)
        .values(validEpisodeRecord)
        .returning(saleMemoryEpisodeColumns);

      if (createdEpisodeRecord === undefined) {
        return err({
          code: "INTERNAL",
          message: "Failed to create sale memory episode",
          origin: "SYSTEM",
        });
      }

      episodeRecord = createdEpisodeRecord;
    } catch (error) {
      return saleDependencyFailure(error, "Failed to create sale memory episode");
    }

    return saleMemoryEpisodeFromRecord(episodeRecord);
  }

  async function searchMemoryEpisodes(
    embedding: number[],
    options: SearchSaleMemoryEpisodesOptions = {},
  ): Promise<Result<SaleMemoryEpisodeSearchResult[]>> {
    const distance = cosineDistance(saleMemoryEpisodes.embedding, embedding);
    const minConfidence = options.minConfidence ?? 0.35;
    let episodeRecords: unknown[];

    try {
      episodeRecords = await db
        .select({
          ...saleMemoryEpisodeColumns,
          score: distance.mapWith(Number),
        })
        .from(saleMemoryEpisodes)
        .where(
          and(
            gte(saleMemoryEpisodes.confidence, minConfidence),
            options.excludeSessionId === undefined
              ? undefined
              : ne(saleMemoryEpisodes.sessionId, options.excludeSessionId),
          ),
        )
        .orderBy(distance)
        .limit(options.limit ?? 4);
    } catch (error) {
      return saleDependencyFailure(error, "Failed to search sale memory episodes");
    }

    const parsedEpisodes: SaleMemoryEpisodeSearchResult[] = [];

    for (const episodeRecord of episodeRecords) {
      const [episode, episodeFailure] = saleMemoryEpisodeSearchResultFromRecord({
        ...(episodeRecord as Record<string, unknown>),
        score: 1 - Number((episodeRecord as { score: unknown }).score),
      });

      if (episodeFailure !== null) {
        return err(episodeFailure);
      }

      parsedEpisodes.push(episode);
    }

    return ok(parsedEpisodes);
  }

  return { createMemoryEpisode, searchMemoryEpisodes };
}
