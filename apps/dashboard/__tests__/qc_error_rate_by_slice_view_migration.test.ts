// Static check for supabase/migrations/20260596_qc_error_rate_by_slice.sql.
//
// vitest can't exec Postgres here, so we verify the migration text contains
// the contracted shape: the view, its security_invoker scope, the slice
// dimensions, the sampled-only population filter, the count columns, and the
// grants. Real exec verification is via `supabase db reset` in CI / local.
//
// Locked under apps/dashboard because the dashboard is the view's consumer —
// if the view's shape regresses, the per-slice QC leaderboard breaks.

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, it, expect } from "vitest";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const MIGRATION_PATH = join(
  __dirname,
  "..",
  "..",
  "..",
  "supabase",
  "migrations",
  "20260596_qc_error_rate_by_slice.sql",
);

describe("20260596_qc_error_rate_by_slice migration shape", () => {
  it("file exists", () => {
    expect(existsSync(MIGRATION_PATH)).toBe(true);
  });

  const sql = existsSync(MIGRATION_PATH)
    ? readFileSync(MIGRATION_PATH, "utf-8")
    : "";

  it("creates v_qc_error_rate_by_slice view in snap_enrollment schema", () => {
    expect(sql).toMatch(
      /CREATE OR REPLACE VIEW\s+snap_enrollment\.v_qc_error_rate_by_slice/i,
    );
  });

  it("sets security_invoker = true so RLS is enforced per querying user (per-org)", () => {
    expect(sql).toMatch(/WITH\s*\(\s*security_invoker\s*=\s*true\s*\)/i);
  });

  it("exposes the contracted columns slice_dim/slice_value/n/errors", () => {
    expect(sql).toMatch(/slice_dim/);
    expect(sql).toMatch(/slice_value/);
    expect(sql).toMatch(/\bAS\s+n\b/i);
    expect(sql).toMatch(/\bAS\s+errors\b/i);
  });

  it("covers the four v1 slice dimensions (county, county_fips, language, error_type)", () => {
    expect(sql).toMatch(/'county'/);
    expect(sql).toMatch(/'county_fips'/);
    expect(sql).toMatch(/'language'/);
    expect(sql).toMatch(/'error_type'/);
  });

  it("joins snap_packets + applicants to reach the slice dimensions", () => {
    expect(sql).toMatch(/JOIN\s+snap_enrollment\.snap_packets/i);
    expect(sql).toMatch(/JOIN\s+snap_enrollment\.applicants/i);
  });

  it("restricts to the sampled, completed-review population (no A2 mismatch)", () => {
    expect(sql).toMatch(/qc_sampled\s*=\s*true/i);
    expect(sql).toMatch(/error_found\s+IS\s+NOT\s+NULL/i);
  });

  it("excludes soft-deleted packets", () => {
    expect(sql).toMatch(/deleted_at\s+IS\s+NULL/i);
  });

  it("computes numerator with FILTER on error_found", () => {
    expect(sql).toMatch(/COUNT\(\*\)\s+FILTER\s*\(\s*WHERE\s+error_found\s*\)/i);
  });

  it("does NOT compute the Wilson interval in SQL (math lives in the engine)", () => {
    // The COMMENT intentionally names wilsonInterval to point at the engine
    // source-of-truth, so we don't ban the word — we ban the *computation*:
    // no sqrt(), no interval columns emitted by the view.
    expect(sql).not.toMatch(/\bsqrt\s*\(/i);
    expect(sql).not.toMatch(/\bAS\s+(wilson_)?lower\b/i);
    expect(sql).not.toMatch(/\bAS\s+(wilson_)?upper\b/i);
  });

  it("grants SELECT to authenticated + service_role", () => {
    expect(sql).toMatch(
      /GRANT SELECT\s+ON\s+snap_enrollment\.v_qc_error_rate_by_slice\s+TO\s+authenticated/i,
    );
    expect(sql).toMatch(/service_role/);
  });

  it("documents intent + plan section + engine source-of-truth in COMMENT ON VIEW", () => {
    expect(sql).toMatch(
      /COMMENT ON VIEW\s+snap_enrollment\.v_qc_error_rate_by_slice/i,
    );
    expect(sql).toMatch(/error-attribution-ledger/);
    expect(sql).toMatch(/snap-qc-engine/);
  });
});
