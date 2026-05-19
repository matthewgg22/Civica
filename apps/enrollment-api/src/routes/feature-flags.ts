/**
 * Feature flags — Session A.
 *
 * GET /v1/enrollment/feature-flags — public read of non-sensitive product
 * config. iOS + TS engine both poll this before applying CA LPIE override.
 *
 * Auth: none. Values are non-sensitive product flags (booleans only).
 * The route is mounted on the top-level app, BEFORE authMiddleware
 * attaches to the /v1/enrollment subtree.
 */

import { Hono } from "hono";
import { makeServiceClient } from "../lib/supabase.js";
import type { Env, Variables } from "../types.js";

// Known flag keys. Adding a new key here + a row in public.feature_flags
// is sufficient; clients receive `undefined` for unknown keys.
const KNOWN_FLAGS = ["lpie_auto_exempt_enabled"] as const;
type KnownFlag = (typeof KNOWN_FLAGS)[number];

// Default values when the DB read fails or the row is missing. Conservative:
// LPIE override defaults ON (matches the seeded migration value).
const DEFAULTS: Record<KnownFlag, boolean> = {
  lpie_auto_exempt_enabled: true,
};

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

app.get("/", async (c) => {
  const db = makeServiceClient(c.env);

  // Read all known flags in one query.
  const { data, error } = (await db
    .from("feature_flags" as never)
    .select("key, enabled")
    .in("key", KNOWN_FLAGS as unknown as string[])) as unknown as {
      data: Array<{ key: KnownFlag; enabled: boolean }> | null;
      error: unknown;
    };

  if (error) {
    c.get("log")?.error("feature_flags read failed", {
      message: (error as { message?: string })?.message ?? String(error),
    });
    // Fall back to defaults on read failure — never block the app.
    return c.json(DEFAULTS);
  }

  const result: Record<KnownFlag, boolean> = { ...DEFAULTS };
  for (const row of data ?? []) {
    if ((KNOWN_FLAGS as readonly string[]).includes(row.key)) {
      result[row.key] = row.enabled;
    }
  }
  return c.json(result);
});

export default app;
