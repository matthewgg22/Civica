// The observability pass (#1049 follow-on).
//
// mae_query_log records ANSWERS. Everything else was invisible:
//
//   - Every early return in /api/demeter — 429, the daily IP cap,
//     at-capacity, malformed input — happens BEFORE the audit sink exists.
//     Someone who hit a wall and left left no trace, so "how often does a
//     real person hit a wall" could not be asked at all.
//   - No language on the answer log, though mae_feedback has carried it from
//     the start — so per-language quality was unreviewable in a product that
//     ships in four.
//   - No timing. A thirty-second answer and a three-second one were the same
//     row.
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const ROUTE = readFileSync(join(__dirname, "..", "app", "api", "demeter", "route.ts"), "utf8");
const SINK = readFileSync(join(__dirname, "..", "lib", "demeter-audit-sink.ts"), "utf8");
const EVENTS = readFileSync(join(__dirname, "..", "lib", "demeter-events.ts"), "utf8");
const MIGRATIONS = join(__dirname, "..", "..", "..", "supabase", "migrations");
const MIGRATION = readFileSync(
  join(MIGRATIONS, "20260828_demeter_observability_pass.sql"),
  "utf8",
);

describe("every refusal is recorded", () => {
  it("covers all four ways the route turns someone away", () => {
    for (const ev of ["unconfigured", "rate_limited", "ip_daily_cap", "at_capacity"]) {
      expect(ROUTE, `${ev} is not recorded`).toContain(`event: "${ev}"`);
    }
    expect(ROUTE, "malformed input is not recorded").toContain('event: "bad_request"');
  });

  it("records without delaying the refusal", () => {
    // after() — a person being rate-limited should not wait on our bookkeeping.
    const calls = [...ROUTE.matchAll(/after\(\(\) =>\s*\n?\s*recordDemeterEvent/g)];
    expect(calls.length, "some refusal records synchronously").toBeGreaterThanOrEqual(4);
  });

  it("never writes what the reader typed", () => {
    // detail takes codes and counts. The question belongs in mae_query_log,
    // where the retention job can reach it; nothing here should need
    // tombstoning, and a jsonb blob is where PII hides.
    expect(EVENTS).toMatch(/never anything the reader typed|no free text/i);
    // The route's own detail payloads are causes, not content.
    for (const m of ROUTE.matchAll(/detail:\s*\{([^}]*)\}/g)) {
      expect(m[1], "a detail payload carries something other than a code").toMatch(
        /^\s*cause:\s*"[a-z_]+"\s*,?\s*$/,
      );
    }
  });
});

describe("the answer log learns what it could not answer", () => {
  it("carries language, mode, timing and the stop flag", () => {
    for (const col of ["lang:", "worksheet_mode:", "ttft_ms:", "total_ms:", "stopped:"]) {
      expect(SINK, `the sink does not write ${col}`).toContain(col);
    }
  });

  it("declares every one of them in the migration", () => {
    // The lesson of #1049: code and schema shipping together, only one
    // applied. At least the repo must agree with itself.
    for (const col of ["lang", "worksheet_mode", "ttft_ms", "total_ms", "stopped"]) {
      expect(MIGRATION, `${col} is written but never declared`).toMatch(
        new RegExp(`add column if not exists ${col}\\b`),
      );
    }
  });

  it("keeps stopped distinct from failed", () => {
    // An abandoned answer is not a failed one. Lumping them together would
    // make the failure rate meaningless.
    expect(MIGRATION).toMatch(/stopped boolean not null default false/);
    expect(EVENTS, "stop is not an event kind").not.toContain('"stopped"');
  });
});

describe("the migration is safe to paste", () => {
  it("is idempotent throughout", () => {
    const creates = [...MIGRATION.matchAll(/create (table|index)/g)].length;
    const guarded = [...MIGRATION.matchAll(/create (table|index) if not exists/g)].length;
    expect(guarded, "an unguarded CREATE would fail on a second paste").toBe(creates);
    expect(MIGRATION).not.toMatch(/alter table[^;]*add column(?! if not exists)/);
  });

  it("does not collide with an existing version prefix", () => {
    const versions = readdirSync(MIGRATIONS)
      .filter((f) => f.endsWith(".sql"))
      .map((f) => f.slice(0, 8));
    const mine = versions.filter((v) => v === "20260828");
    expect(mine.length, "another migration already claims 20260828").toBe(1);
  });

  it("leaves the new table closed by default", () => {
    // Service role writes it, staff tooling reads it. No anon policy is
    // granted, so RLS denies everything else — mae_query_log's own posture.
    expect(MIGRATION).toMatch(/alter table snap_enrollment\.demeter_events enable row level security/);
    expect(MIGRATION, "a policy would open it wider than intended").not.toMatch(
      /create policy[^;]*demeter_events/i,
    );
  });
});
