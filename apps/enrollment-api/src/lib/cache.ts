/**
 * Module-level TTL cache for Cloudflare Workers.
 *
 * Cloudflare Workers run in a per-isolate context — this Map persists across
 * requests to the same isolate (typically a few minutes) but is lost on
 * worker restart or scale-out. That's acceptable for short TTLs (≤5 min):
 * a cache miss just causes a fresh API call.
 *
 * Usage:
 *   const val = getCache<MyType>('key');
 *   if (!val) { val = await fetchExpensive(); setCache('key', val, 300); }
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number; // ms since epoch
}

const store = new Map<string, CacheEntry<unknown>>();

export function getCache<T>(key: string): T | null {
  const entry = store.get(key) as CacheEntry<T> | undefined;
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }
  return entry.value;
}

export function setCache<T>(key: string, value: T, ttlSeconds: number): void {
  store.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
}

export function deleteCache(key: string): void {
  store.delete(key);
}
