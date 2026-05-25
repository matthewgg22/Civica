// Static check for supabase/migrations/20260583_qc_pillar_coverage_view.sql.
//
// vitest can't exec Postgres here, so we verify the migration text contains
// the contracted columns + grant statements + engine-interop documentation.
// Real exec verification is via `supabase db reset` in CI / local.
//
// Locked under apps/dashboard because the dashboard is the view's consumer —
// if the view's shape regresses, the dashboard breaks.

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
  "20260583_qc_pillar_coverage_view.sql",
);

describe("20260583_qc_pillar_coverage_view migration shape", () => {
  it("file exists", () => {
    expect(existsSync(MIGRATION_PATH)).toBe(true);
  });

  const sql = existsSync(MIGRATION_PATH)
    ? readFileSync(MIGRATION_PATH, "utf-8")
    : "";

  it("creates v_qc_pillar_coverage view in snap_enrollment schema", () => {
    expect(sql).toMatch(
      /CREATE OR REPLACE VIEW\s+snap_enrollment\.v_qc_pillar_coverage/i,
    );
  });

  it("exposes total_packets + per-pillar count columns", () => {
    expect(sql).toMatch(/total_packets/);
    expect(sql).toMatch(/argyle_connected_packets/);
    expect(sql).toMatch(/shelter_doc_packets/);
    expect(sql).toMatch(/sua_answered_packets/);
  });

  it("exposes coverage rate columns matching PillarCoverage type", () => {
    expect(sql).toMatch(/gig_income_coverage/);
    expect(sql).toMatch(/utility_sua_coverage/);
    expect(sql).toMatch(/shared_lease_coverage/);
    expect(sql).toMatch(/assets_coverage/);
    expect(sql).toMatch(/benefit_impact_coverage/);
  });

  it("guards division-by-zero with NULLIF (engine clamp01 coerces NULL to 0)", () => {
    expect(sql).toMatch(/NULLIF/i);
  });

  it("grants SELECT to authenticated + service_role", () => {
    expect(sql).toMatch(
      /GRANT SELECT.+ON\s+snap_enrollment\.v_qc_pillar_coverage.+TO.+authenticated/i,
    );
    expect(sql).toMatch(/service_role/);
  });

  it("filters out soft-deleted packets", () => {
    expect(sql).toMatch(/deleted_at\s+IS\s+NULL/i);
  });

  it("references the engine package for math-source-of-truth", () => {
    expect(sql).toMatch(/snap-qc-engine/);
    expect(sql).toMatch(/computeEngagementImpliedPER/);
  });

  it("documents intent + plan section in COMMENT ON VIEW", () => {
    expect(sql).toMatch(
      /COMMENT ON VIEW\s+snap_enrollment\.v_qc_pillar_coverage/i,
    );
    expect(sql).toMatch(/qc-error-rate-intelligence-redesign/);
  });

  it("returns shared_lease_coverage = 0 (Phase 2, classifier UI pending)", () => {
    expect(sql).toMatch(/0::float AS shared_lease_coverage/);
  });

  it("returns benefit_impact_coverage = 1.0 (deterministic, always engaged)", () => {
    expect(sql).toMatch(/1\.0::float AS benefit_impact_coverage/);
  });
});
