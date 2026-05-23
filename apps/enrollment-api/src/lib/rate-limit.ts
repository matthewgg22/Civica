// ---------------------------------------------------------------------------
// Rate limiting (TODO-2, /plan-eng-review pre-App-Store gate).
//
// Wraps the Cloudflare Workers Rate Limiting API into a Hono middleware that
// keys per authenticated user (or per CF-Connecting-IP for anonymous routes).
//
// Two tiers, configured in wrangler.toml:
//   - RL_STRICT   (10 req/min) — buddy invite/accept, oauth exchange
//   - RL_STANDARD (60 req/min) — packet create/submit, argyle connect, benefitscal
//
// Graceful degrade: if a binding is absent (vitest, pre-deploy env), the
// middleware no-ops with a single info log per request so existing tests
// don't have to stub a fake RateLimit.
// ---------------------------------------------------------------------------

import type { Context, MiddlewareHandler } from "hono";
import { HTTPException } from "hono/http-exception";
import type { Env } from "../types.js";

export type RateLimitTier = "strict" | "standard";

/**
 * Resolve a stable bucket key for the calling request.
 *
 * Preferred: the Supabase user id (set by authMiddleware via c.get("actor")).
 * Fallback: the Cloudflare CF-Connecting-IP header.
 * Last resort: a per-path bucket so anonymous, IP-less requests don't all
 * share one global bucket (which would lock every anonymous caller out at once).
 *
 * Typed loosely (Context<any>) so this helper composes with any route app's
 * generic shape — strict route-level typing fought Hono's chain inference.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function bucketKey(c: Context<any>, tier: RateLimitTier): string {
  const actor = c.get("actor") as { id?: string } | undefined;
  if (actor?.id) return `${tier}:uid:${actor.id}`;
  const ip = c.req.header("CF-Connecting-IP") ?? c.req.header("x-forwarded-for")?.split(",")[0]?.trim();
  if (ip) return `${tier}:ip:${ip}`;
  return `${tier}:path:${c.req.path}`;
}

/**
 * Hono middleware that applies the named rate-limit binding to the route.
 *
 * Usage:
 *   app.post("/invite", rateLimit("strict"), zValidator(...), handler);
 *
 * Returns 429 with { code: "RATE_LIMIT_EXCEEDED", tier } when the binding
 * reports !success. Adds the standard Retry-After header (in seconds) so
 * clients can back off correctly.
 */
export function rateLimit(tier: RateLimitTier): MiddlewareHandler<{ Bindings: Env }> {
  return async (c, next) => {
    const binding = tier === "strict" ? c.env.RL_STRICT : c.env.RL_STANDARD;
    if (!binding) {
      // Graceful degrade — vitest + pre-deploy workers run without bindings.
      // Production deploys MUST have them wired (verified by wrangler.toml
      // [[unsafe.bindings]] entries; missing in prod would be a deploy bug).
      // The Sentry envelope around the request will tag any degraded path.
      await next();
      return;
    }

    const key = bucketKey(c, tier);
    const { success } = await binding.limit({ key });

    if (!success) {
      // Retry-After: 60 matches the binding's `period` from wrangler.toml.
      // Hard-coded for now; if we add more tiers with different periods,
      // thread the period through.
      throw new HTTPException(429, {
        message: "RATE_LIMIT_EXCEEDED",
        res: new Response(
          JSON.stringify({ code: "RATE_LIMIT_EXCEEDED", tier, retry_after_seconds: 60 }),
          {
            status: 429,
            headers: {
              "Content-Type": "application/json",
              "Retry-After": "60",
            },
          },
        ),
      });
    }

    await next();
  };
}
