import type { Context, MiddlewareHandler } from 'hono';

// ── Store interface ────────────────────────────────────────────────────────

export interface RateLimitStore {
  increment(key: string, windowMs: number): Promise<{ count: number; resetAt: Date }>;
}

// ── In-memory store (default, single-process) ──────────────────────────────

interface Window { count: number; resetAt: number }

export class InMemoryStore implements RateLimitStore {
  private readonly windows = new Map<string, Window>();

  async increment(key: string, windowMs: number): Promise<{ count: number; resetAt: Date }> {
    const now = Date.now();
    const w = this.windows.get(key);
    if (!w || now >= w.resetAt) {
      const entry: Window = { count: 1, resetAt: now + windowMs };
      this.windows.set(key, entry);
      return { count: 1, resetAt: new Date(entry.resetAt) };
    }
    w.count += 1;
    return { count: w.count, resetAt: new Date(w.resetAt) };
  }

  /** Evict expired windows. Call periodically to prevent unbounded growth. */
  cleanup(): void {
    const now = Date.now();
    for (const [key, w] of this.windows) {
      if (now >= w.resetAt) this.windows.delete(key);
    }
  }
}

// ── Redis store stub ───────────────────────────────────────────────────────
// Replace this stub with an ioredis implementation when REDIS_URL is set.
// The increment must use INCR + PEXPIRE in a Lua script or pipeline to be
// atomic under concurrent writes.

export class RedisStore implements RateLimitStore {
  async increment(_key: string, _windowMs: number): Promise<{ count: number; resetAt: Date }> {
    throw new Error(
      'RedisStore is a stub. Implement with ioredis using an atomic INCR + PEXPIRE pipeline.',
    );
  }
}

// ── Factory ────────────────────────────────────────────────────────────────

const DEFAULT_STORE = new InMemoryStore();

export interface RateLimitOptions<E extends { Variables?: Record<string, unknown> }> {
  /** Sliding window duration in milliseconds. */
  windowMs: number;
  /** Maximum requests allowed per key per window. */
  max: number;
  /** Derives the bucket key from the request context. */
  keyFn: (c: Context<E>) => string;
  /** Defaults to InMemoryStore. Pass RedisStore for multi-instance deployments. */
  store?: RateLimitStore;
}

export function rateLimit<E extends { Variables?: Record<string, unknown> } = Record<string, never>>(
  options: RateLimitOptions<E>,
): MiddlewareHandler<E> {
  const store = options.store ?? DEFAULT_STORE;

  return async (c, next) => {
    const key = options.keyFn(c);
    const { count, resetAt } = await store.increment(key, options.windowMs);

    if (count > options.max) {
      const retryAfterSecs = Math.ceil((resetAt.getTime() - Date.now()) / 1000);
      c.header('Retry-After', String(retryAfterSecs));
      return c.json({ error: 'rate_limited', retryAfter: retryAfterSecs }, 429);
    }

    c.header('X-RateLimit-Limit', String(options.max));
    c.header('X-RateLimit-Remaining', String(Math.max(0, options.max - count)));
    c.header('X-RateLimit-Reset', String(Math.ceil(resetAt.getTime() / 1000)));

    await next();
  };
}

// ── Pre-built middleware instances ─────────────────────────────────────────

import type { ApplicantEnv, StaffEnv } from '../auth/types.js';

/** Per-user rate limit for applicant routes (requires auth to run first). */
export const applicantRateLimit = rateLimit<ApplicantEnv>({
  windowMs: 60_000,
  max: 60,
  keyFn: (c) => `applicant:${c.var.applicant.sub}`,
});

/** Per-IP rate limit for navigator routes. */
export const navigatorRateLimit = rateLimit<StaffEnv>({
  windowMs: 60_000,
  max: 120,
  keyFn: (c) =>
    `navigator:${c.req.header('x-forwarded-for') ?? c.req.header('x-real-ip') ?? 'unknown'}`,
});
