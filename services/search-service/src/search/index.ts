import { Client } from "@opensearch-project/opensearch";
import { config } from "../config.js";
import { logger } from "../logger.js";
import type { VideoDocument } from "./video-document.js";

export const openSearch = new Client({
  node: config.OPENSEARCH_NODE,
  requestTimeout: config.OPENSEARCH_REQUEST_TIMEOUT_MS,
  maxRetries: 2,
  sniffOnStart: false
});

export async function ensureIndex(recreate = false): Promise<void> {
  const exists = await openSearch.indices.exists({ index: config.OPENSEARCH_INDEX });
  if (exists.body && recreate) {
    await openSearch.indices.delete({ index: config.OPENSEARCH_INDEX });
  } else if (exists.body) {
    return;
  }

  await openSearch.indices.create({
    index: config.OPENSEARCH_INDEX,
    body: {
      settings: {
        number_of_shards: 1,
        number_of_replicas: 0,
        analysis: {
          analyzer: {
            streamly_text: {
              type: "custom",
              tokenizer: "standard",
              filter: ["lowercase", "asciifolding"]
            }
          }
        }
      },
      mappings: {
        dynamic: "strict",
        properties: {
          id: { type: "keyword" },
          title: { type: "text", analyzer: "streamly_text", fields: { raw: { type: "keyword", ignore_above: 256 } } },
          description: { type: "text", analyzer: "streamly_text" },
          tags: { type: "text", analyzer: "streamly_text", fields: { raw: { type: "keyword" } } },
          category: { type: "keyword" },
          creatorId: { type: "keyword" },
          creatorName: { type: "text", fields: { raw: { type: "keyword", ignore_above: 256 } } },
          visibility: { type: "keyword" },
          status: { type: "keyword" },
          publishedAt: { type: "date", format: "strict_date_optional_time||epoch_millis" },
          thumbnailUrl: { type: "keyword", index: false },
          durationSeconds: { type: "integer" },
          viewCount: { type: "long" },
          indexedAt: { type: "date" }
        }
      }
    }
  });
  logger.info({ index: config.OPENSEARCH_INDEX }, "OpenSearch index ready");
}

export async function indexVideo(video: VideoDocument): Promise<void> {
  await openSearch.index({
    index: config.OPENSEARCH_INDEX,
    id: video.id,
    body: { ...video, indexedAt: new Date().toISOString() },
    refresh: "wait_for"
  });
}

export async function deleteVideo(id: string): Promise<void> {
  try {
    await openSearch.delete({ index: config.OPENSEARCH_INDEX, id, refresh: "wait_for" });
  } catch (error: unknown) {
    const status = (error as { meta?: { statusCode?: number } })?.meta?.statusCode;
    if (status !== 404) throw error;
  }
}

export async function searchVideos(input: {
  q?: string; page: number; limit: number; category?: string; creatorId?: string;
  sort: "relevance" | "recent" | "popular";
}) {
  const filters: object[] = [
    { term: { visibility: "public" } },
    { term: { status: "published" } }
  ];
  if (input.category) filters.push({ term: { category: input.category } });
  if (input.creatorId) filters.push({ term: { creatorId: input.creatorId } });

  const query = input.q
    ? {
        bool: {
          must: [{
            multi_match: {
              query: input.q,
              fields: ["title^5", "tags^3", "creatorName^2", "description"],
              type: "best_fields",
              fuzziness: "AUTO",
              operator: "and"
            }
          }],
          filter: filters
        }
      }
    : { bool: { must: [{ match_all: {} }], filter: filters } };

  const sort = input.sort === "recent"
    ? [{ publishedAt: { order: "desc", unmapped_type: "date" } }, { id: { order: "asc" } }]
    : input.sort === "popular"
      ? [{ viewCount: { order: "desc", unmapped_type: "long" } }, { publishedAt: { order: "desc", unmapped_type: "date" } }]
      : input.q
        ? [{ _score: { order: "desc" } }, { publishedAt: { order: "desc", unmapped_type: "date" } }]
        : [{ publishedAt: { order: "desc", unmapped_type: "date" } }];

  const result = await openSearch.search({
    index: config.OPENSEARCH_INDEX,
    body: {
      from: (input.page - 1) * input.limit,
      size: input.limit,
      query,
      sort,
      track_total_hits: true,
      _source: ["id", "title", "description", "tags", "category", "creatorId", "creatorName", "publishedAt", "thumbnailUrl", "durationSeconds", "viewCount"]
    }
  });

  const hits = result.body.hits;
  const total = typeof hits.total === "number" ? hits.total : (hits.total?.value ?? 0);
  return {
    items: hits.hits.map((hit: any) => hit._source),
    page: input.page,
    limit: input.limit,
    total,
    totalRelation: typeof hits.total === "number" ? "eq" : (hits.total?.relation ?? "eq"),
    hasMore: input.page * input.limit < total
  };
}

export async function suggestTitles(q: string, limit = 8) {
  const result = await openSearch.search({
    index: config.OPENSEARCH_INDEX,
    body: {
      size: limit,
      query: {
        bool: {
          must: [{ match_phrase_prefix: { title: { query: q, max_expansions: 20 } } }],
          filter: [{ term: { visibility: "public" } }, { term: { status: "published" } }]
        }
      },
      _source: ["id", "title", "thumbnailUrl", "creatorName"],
      sort: [{ viewCount: { order: "desc", unmapped_type: "long" } }]
    }
  });
  return result.body.hits.hits.map((hit: any) => hit._source);
}

export async function searchHealth() {
  const response = await openSearch.cluster.health();
  return { status: response.body.status, index: config.OPENSEARCH_INDEX };
}