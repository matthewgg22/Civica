import { describe, it, expect } from "vitest";
import { Hono } from "hono";
import { app } from "./index.js";

// The 500 error handler must include a trace_id so a user reporting an issue
// gives the team a single grep handle into Sentry / Axiom. The handler reads
// the requestId set by requestLogger middleware.

const TEST_ENV = {
  SUPABASE_URL: "https://placeholder.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "placeholder-service-role-key",
  SUPABASE_ANON_KEY: "placeholder-anon-key",
  SNAP_FERNET_KEY: "placeholder-fernet-key-32bytes!!",
  SENTRY_DSN: "",
};

describe("500 error handler", () => {
  it("includes a trace_id in unhandled error responses", async () => {
    // Mount a route on the app that throws, then hit it.
    // app is imported from ./index.js so onError + requestLogger run as in prod.
    const probe = new Hono();
    probe.get("/probe-error", () => {
      throw new Error("boom");
    });
    app.route("/_test", probe);

    const res = await app.request("/_test/probe-error", {}, TEST_ENV);
    expect(res.status).toBe(500);
    const body = (await res.json()) as { error: string; trace_id?: string };
    expect(body.error).toBe("Internal server error");
    expect(body.trace_id).toBeTruthy();
    // requestLogger generates crypto.randomUUID() — match the UUID v4 shape
    // so we know the field carries a real correlation handle.
    expect(body.trace_id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });
});
