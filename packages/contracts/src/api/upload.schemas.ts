import { z } from "zod";
import { IdSchema, IsoDateTimeSchema } from "./common.schemas.js";

export const CreateUploadRequestSchema = z.object({
  fileName: z.string().min(1).max(255),
  contentType: z.string().regex(/^(video\/|application\/octet-stream)/),
  sizeBytes: z.number().int().positive(),
  checksum: z.string().optional()
});

export const CreateUploadResponseSchema = z.object({
  uploadId: IdSchema,
  videoId: IdSchema,
  uploadUrl: z.string().url(),
  method: z.enum(["PUT", "POST"]).default("PUT"),
  headers: z.record(z.string()).default({}),
  expiresAt: IsoDateTimeSchema
});

export const CompleteUploadRequestSchema = z.object({
  objectKey: z.string().min(1),
  sizeBytes: z.number().int().positive(),
  checksum: z.string().optional()
});

export const UploadStatusSchema = z.object({
  uploadId: IdSchema,
  videoId: IdSchema,
  status: z.enum(["created", "uploading", "uploaded", "processing", "completed", "failed", "expired"]),
  createdAt: IsoDateTimeSchema,
  expiresAt: IsoDateTimeSchema
});

export type CreateUploadRequest = z.infer<typeof CreateUploadRequestSchema>;
export type CreateUploadResponse = z.infer<typeof CreateUploadResponseSchema>;
export type CompleteUploadRequest = z.infer<typeof CompleteUploadRequestSchema>;
export type UploadStatus = z.infer<typeof UploadStatusSchema>;
