import { describe, it, expect, vi, afterEach } from 'vitest';
import { getCache, setCache, deleteCache } from './cache.js';

afterEach(() => vi.useRealTimers());

describe('TTL cache', () => {
  it('returns null for unknown keys', () => {
    expect(getCache('no-such-key')).toBeNull();
  });

  it('stores and retrieves values within TTL', () => {
    setCache('k1', { x: 42 }, 60);
    expect(getCache('k1')).toEqual({ x: 42 });
  });

  it('returns null after TTL expires', () => {
    vi.useFakeTimers();
    setCache('k2', 'hello', 1);
    vi.advanceTimersByTime(1001);
    expect(getCache('k2')).toBeNull();
  });

  it('deleteCache removes an entry', () => {
    setCache('k3', true, 60);
    deleteCache('k3');
    expect(getCache('k3')).toBeNull();
  });
});
