import { z } from "zod";

export const IdSchema = z.string().min(1);
export const IsoDateTimeSchema = z.string().datetime({ offset: true });

export const PaginationQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20)
});

export const PageInfoSchema = z.object({
  nextCursor: z.string().nullable(),
  hasNextPage: z.boolean()
});

export const ApiErrorSchema = z.object({
  error: z.object({
    code: z.string().min(1),
    message: z.string().min(1),
    requestId: z.string().optional(),
    details: z.unknown().optional()
  })
});

export function ApiResponseSchema<T extends z.ZodTypeAny>(data: T) {
  return z.object({ data });
}

export type PaginationQuery = z.infer<typeof PaginationQuerySchema>;
export type PageInfo = z.infer<typeof PageInfoSchema>;
export type ApiError = z.infer<typeof ApiErrorSchema>;
