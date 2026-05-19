// Simple in-memory IP rate limiter. Pilot-grade; resets on cold start. Good
// enough for the warm-referral funnel; upgrade to Upstash Redis or similar
// when traffic warrants. Kept in its own module so the route file only
// exports HTTP handler symbols (Next.js validates route exports).

export const RATE_LIMIT = {
  windowMs: 60 * 60 * 1000, // 1h
  max: 5,
};

const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(ip: string, now: number = Date.now()): boolean {
  const b = buckets.get(ip);
  if (!b || b.resetAt < now) {
    buckets.set(ip, { count: 1, resetAt: now + RATE_LIMIT.windowMs });
    return true;
  }
  if (b.count >= RATE_LIMIT.max) return false;
  b.count += 1;
  return true;
}

// Test-only helper; safe to expose since it just clears the map.
export function __resetRateLimitForTests() {
  buckets.clear();
}
