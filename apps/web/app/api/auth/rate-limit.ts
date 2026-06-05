// In-memory IP rate limiter for auth endpoints. Pilot-grade; resets on cold
// start. Sufficient for burst SMS-bombing protection; upgrade to Upstash Redis
// when traffic warrants. Mirrors apps/web/app/api/lead-capture/rate-limit.ts.
// Kept in its own module so route files only export HTTP handler symbols.

export const OTP_RATE_LIMIT = {
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 5,
};

const buckets = new Map<string, { count: number; resetAt: number }>();

export function otpRateLimit(ip: string, now: number = Date.now()): boolean {
  const b = buckets.get(ip);
  if (!b || b.resetAt < now) {
    buckets.set(ip, { count: 1, resetAt: now + OTP_RATE_LIMIT.windowMs });
    return true;
  }
  if (b.count >= OTP_RATE_LIMIT.max) return false;
  b.count += 1;
  return true;
}

// Test-only helper.
export function __resetOtpRateLimitForTests() {
  buckets.clear();
}
