import { z } from "zod";

export const uploadIdSchema = z.string().uuid();

export const createUploadSchema = z
  .object({
    fileName: z.string().trim().min(1).max(255),
    contentType: z.string().min(1).max(128),
    sizeBytes: z
      .number()
      .int()
      .positive()
      .max(Number.MAX_SAFE_INTEGER)
  })
  .strict();

export type CreateUploadInput = z.infer<
  typeof createUploadSchema
>;