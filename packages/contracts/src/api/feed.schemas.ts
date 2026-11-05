import { z } from "zod";
import { IdSchema, PaginationQuerySchema, PageInfoSchema } from "./common.schemas.js";
import { VideoSchema } from "./video.schemas.js";

export const HomeFeedQuerySchema = PaginationQuerySchema.extend({
  viewerId: IdSchema.optional()
});

export const HomeFeedResponseSchema = z.object({
  items: z.array(VideoSchema),
  pageInfo: PageInfoSchema
});

export type HomeFeedQuery = z.infer<typeof HomeFeedQuerySchema>;
export type HomeFeedResponse = z.infer<typeof HomeFeedResponseSchema>;
