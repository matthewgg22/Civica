import { describe, it, expect } from "vitest";
import { app } from "../index.js";
import { buildOpenAPIDocument } from "./spec.js";

const TEST_ENV = {
  SUPABASE_URL: "https://placeholder.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "placeholder-service-role-key",
  SUPABASE_ANON_KEY: "placeholder-anon-key",
  SNAP_FERNET_KEY: "placeholder-fernet-key-32bytes!!",
  SENTRY_DSN: "",
};

describe("GET /openapi.json", () => {
  it("returns a valid OpenAPI 3.1 document with the expected metadata", async () => {
    const res = await app.request("/openapi.json", {}, TEST_ENV);
    expect(res.status).toBe(200);

    const spec = (await res.json()) as {
      openapi: string;
      info: { title: string; version: string };
      paths: Record<string, unknown>;
      components: { securitySchemes: Record<string, unknown> };
    };

    expect(spec.openapi).toMatch(/^3\.1/);
    expect(spec.info.title).toContain("Civica");
    expect(spec.info.version).toBeTruthy();
    expect(spec.components.securitySchemes.bearerAuth).toBeDefined();
  });

  it("registers the iOS-facing routes the codegen client expects", async () => {
    const spec = buildOpenAPIDocument();

    // If any of these path drift, the contract test catches it before
    // iOS codegen does. Update spec.ts when routes move; do not pad this
    // list with stale entries.
    const requiredPaths = [
      "/v1/enrollment/me",
      "/v1/enrollment/me/active-recert",
      "/v1/enrollment/me/packets",
      "/v1/enrollment/me/packets/{packetId}",
      "/v1/enrollment/me/packets/{packetId}/error-risk",
      "/v1/enrollment/me/packets/{packetId}/submit",
      "/v1/enrollment/me/inbox",
      "/v1/enrollment/me/inbox/{requestId}/resolve",
      "/v1/enrollment/me/argyle",
      "/v1/enrollment/me/work-hours/{packetId}/hours",
      "/v1/enrollment/buddy/config",
      "/v1/enrollment/buddy/invite",
      "/v1/enrollment/buddy/accept",
      "/v1/enrollment/buddy/applicant-summary",
      "/v1/enrollment/recert/{packetId}",
      "/v1/enrollment/recert/{recertId}",
      "/v1/enrollment/feature-flags",
    ];

    for (const p of requiredPaths) {
      expect(spec.paths, `missing path ${p}`).toHaveProperty(p);
    }
  });

  it("every documented path lists at least one HTTP method", () => {
    const spec = buildOpenAPIDocument();
    for (const [path, methods] of Object.entries(spec.paths)) {
      const ops = Object.keys(methods as Record<string, unknown>);
      expect(ops.length, `${path} has no methods`).toBeGreaterThan(0);
    }
  });

  it("every documented route declares at least one 2xx response", () => {
    const spec = buildOpenAPIDocument();
    for (const [path, methods] of Object.entries(spec.paths)) {
      for (const [method, op] of Object.entries(methods as Record<string, unknown>)) {
        const op2 = op as { responses?: Record<string, unknown> };
        const responseCodes = Object.keys(op2.responses ?? {});
        const has2xx = responseCodes.some((code) => code.startsWith("2"));
        expect(has2xx, `${method.toUpperCase()} ${path} has no 2xx response`).toBe(true);
      }
    }
  });
});
