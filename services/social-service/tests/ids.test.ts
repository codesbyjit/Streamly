import { describe, expect, it } from 'vitest';
import { pageSize, parseUuid } from '../src/utils/ids.js';

describe('parseUuid', () => {
  it('accepts a valid UUID', () => {
    expect(parseUuid('123e4567-e89b-42d3-a456-426614174000')).toBe('123e4567-e89b-42d3-a456-426614174000');
  });
  it('rejects invalid IDs', () => {
    expect(() => parseUuid('not-a-uuid')).toThrow('must be a valid UUID');
  });
});

describe('pageSize', () => {
  it('uses fallback for invalid values', () => {
    expect(pageSize('bad', 20, 100)).toBe(20);
  });
  it('caps oversized values', () => {
    expect(pageSize('500', 20, 100)).toBe(100);
  });
});
