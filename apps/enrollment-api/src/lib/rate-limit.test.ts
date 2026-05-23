import { describe, it, expect, vi } from "vitest";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { rateLimit } from "./rate-limit.js";
import type { Env } from "../types.js";

const ENV: Env = {
  SUPABASE_URL: "https://placeholder.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "placeholder-service-role-key",
  SUPABASE_ANON_KEY: "placeholder-anon-key",
  SNAP_FERNET_KEY: "placeholder-fernet-key-32bytes!!",
  SENTRY_DSN: "",
};

function appWithLimiter(tier: "strict" | "standard", binding: RateLimit | undefined) {
  const app = new Hono<{ Bindings: Env }>();
  app.use("*", async (c, next) => {
    // Inject the binding through env so the middleware sees it.
    if (binding !== undefined) {
      if (tier === "strict") c.env.RL_STRICT = binding;
      else c.env.RL_STANDARD = binding;
    }
    // Stub actor for keying — match what authMiddleware would have set.
    c.set("actor", { kind: "applicant", id: "user-abc" } as never);
    await next();
  });
  app.post("/probe", rateLimit(tier), (c) => c.json({ ok: true }));
  app.onError((err, c) => {
    if (err instanceof HTTPException) return err.getResponse();
    return c.json({ error: "internal" }, 500);
  });
  return app;
}

describe("rateLimit middleware", () => {
  it("passes through when the binding allows the request", async () => {
    const limit = vi.fn().mockResolvedValue({ success: true });
    const app = appWithLimiter("standard", { limit } as unknown as RateLimit);
    const res = await app.request("/probe", { method: "POST" }, ENV);
    expect(res.status).toBe(200);
    expect(limit).toHaveBeenCalledWith({ key: "standard:uid:user-abc" });
  });

  it("returns 429 with code + Retry-After when the binding rejects", async () => {
    const limit = vi.fn().mockResolvedValue({ success: false });
    const app = appWithLimiter("strict", { limit } as unknown as RateLimit);
    const res = await app.request("/probe", { method: "POST" }, ENV);
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("60");
    const body = (await res.json()) as { code: string; tier: string; retry_after_seconds: number };
    expect(body.code).toBe("RATE_LIMIT_EXCEEDED");
    expect(body.tier).toBe("strict");
    expect(body.retry_after_seconds).toBe(60);
  });

  it("graceful-degrades to pass-through when the binding is absent", async () => {
    // No binding wired — the middleware MUST NOT throw. This is the vitest
    // and pre-deploy code path. Production wires the binding via wrangler.toml.
    const app = appWithLimiter("standard", undefined);
    const res = await app.request("/probe", { method: "POST" }, ENV);
    expect(res.status).toBe(200);
  });

  it("falls back to CF-Connecting-IP when no actor is set", async () => {
    const limit = vi.fn().mockResolvedValue({ success: true });
    const app = new Hono<{ Bindings: Env }>();
    app.use("*", async (c, next) => {
      c.env.RL_STRICT = { limit } as unknown as RateLimit;
      await next();
    });
    app.post("/probe", rateLimit("strict"), (c) => c.json({ ok: true }));
    const res = await app.request(
      "/probe",
      { method: "POST", headers: { "CF-Connecting-IP": "203.0.113.42" } },
      ENV,
    );
    expect(res.status).toBe(200);
    expect(limit).toHaveBeenCalledWith({ key: "strict:ip:203.0.113.42" });
  });

  it("keys per-path when no actor and no IP are available", async () => {
    const limit = vi.fn().mockResolvedValue({ success: true });
    const app = new Hono<{ Bindings: Env }>();
    app.use("*", async (c, next) => {
      c.env.RL_STANDARD = { limit } as unknown as RateLimit;
      await next();
    });
    app.post("/probe", rateLimit("standard"), (c) => c.json({ ok: true }));
    const res = await app.request("/probe", { method: "POST" }, ENV);
    expect(res.status).toBe(200);
    // Path bucket prevents all anonymous, IP-less callers from sharing one
    // global bucket and locking each other out.
    expect(limit).toHaveBeenCalledWith({ key: "standard:path:/probe" });
  });

  it("strict and standard tiers use different buckets for the same user", async () => {
    const strictLimit = vi.fn().mockResolvedValue({ success: true });
    const standardLimit = vi.fn().mockResolvedValue({ success: true });
    const app = new Hono<{ Bindings: Env }>();
    app.use("*", async (c, next) => {
      c.env.RL_STRICT = { limit: strictLimit } as unknown as RateLimit;
      c.env.RL_STANDARD = { limit: standardLimit } as unknown as RateLimit;
      c.set("actor", { kind: "applicant", id: "user-xyz" } as never);
      await next();
    });
    app.post("/strict", rateLimit("strict"), (c) => c.json({ ok: true }));
    app.post("/standard", rateLimit("standard"), (c) => c.json({ ok: true }));

    await app.request("/strict", { method: "POST" }, ENV);
    await app.request("/standard", { method: "POST" }, ENV);

    expect(strictLimit).toHaveBeenCalledWith({ key: "strict:uid:user-xyz" });
    expect(standardLimit).toHaveBeenCalledWith({ key: "standard:uid:user-xyz" });
  });
});
