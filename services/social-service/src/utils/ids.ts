import { z } from 'zod';

export const uuidSchema = z.string().uuid();
export function parseUuid(value: unknown, label = 'id'): string {
  const parsed = uuidSchema.safeParse(value);
  if (!parsed.success) {
    const error = new Error(`${label} must be a valid UUID`);
    Object.assign(error, { statusCode: 400, code: 'INVALID_ID' });
    throw error;
  }
  return parsed.data;
}

export function pageSize(value: unknown, fallback: number, maximum: number): number {
  const n = typeof value === 'string' ? Number(value) : Number.NaN;
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) return fallback;
  return Math.min(n, maximum);
}
