import { z } from "zod";
import { PaginationQuerySchema, PageInfoSchema } from "./common.schemas.js";
import { VideoSchema } from "./video.schemas.js";

export const SearchQuerySchema = PaginationQuerySchema.extend({
  q: z.string().trim().min(1).max(200),
  categoryId: z.string().optional(),
  sort: z.enum(["relevance", "newest", "views"]).default("relevance")
});

export const SearchResponseSchema = z.object({
  items: z.array(VideoSchema),
  pageInfo: PageInfoSchema,
  total: z.number().int().nonnegative().optional()
});

export type SearchQuery = z.infer<typeof SearchQuerySchema>;
export type SearchResponse = z.infer<typeof SearchResponseSchema>;
