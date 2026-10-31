import { z } from "zod";

const safeUrl = z.string().url().max(2048).nullable();

export const createProfileSchema = z.object({
  userId: z.string().uuid(),
  handle: z.string().trim().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/),
  displayName: z.string().trim().min(1).max(80),
  bio: z.string().max(500).default(""),
  avatarUrl: safeUrl.optional().default(null),
  bannerUrl: safeUrl.optional().default(null),
  countryCode: z.string().regex(/^[A-Za-z]{2}$/).transform((v) => v.toUpperCase()).nullable().optional()
}).strict();

export const updateProfileSchema = z.object({
  handle: z.string().trim().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/).optional(),
  displayName: z.string().trim().min(1).max(80).optional(),
  bio: z.string().max(500).optional(),
  avatarUrl: safeUrl.optional(),
  bannerUrl: safeUrl.optional(),
  countryCode: z.string().regex(/^[A-Za-z]{2}$/).transform((v) => v.toUpperCase()).nullable().optional()
}).strict().refine((value) => Object.keys(value).length > 0, {
  message: "At least one field must be provided"
});

export const updatePreferencesSchema = z.object({
  language: z.string().trim().min(2).max(12).optional(),
  theme: z.enum(["light", "dark", "system"]).optional(),
  autoplay: z.boolean().optional(),
  emailNotifications: z.boolean().optional()
}).strict().refine((value) => Object.keys(value).length > 0, {
  message: "At least one field must be provided"
});
