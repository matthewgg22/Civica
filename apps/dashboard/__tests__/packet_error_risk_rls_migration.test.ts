// Static check for supabase/migrations/20260601_fix_packet_error_risk_rls.sql.
//
// Regression test for #407: the applicant SELECT policy on packet_error_risk
// must join through applicants.auth_uid, NOT compare applicant_id = auth.uid()
// directly (snap_packets.applicant_id is a gen_uuidv7 PK, not the auth user id).
//
// vitest can't exec Postgres here, so we verify the migration text drops the
// broken policy and recreates it with the canonical join pattern. Real exec
// verification is via `supabase db reset` in CI / local.

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
  "20260601_fix_packet_error_risk_rls.sql",
);

describe("20260601_fix_packet_error_risk_rls migration shape", () => {
  it("file exists", () => {
    expect(existsSync(MIGRATION_PATH)).toBe(true);
  });

  const sql = existsSync(MIGRATION_PATH)
    ? readFileSync(MIGRATION_PATH, "utf-8")
    : "";

  it("drops the broken policy by name (idempotent)", () => {
    expect(sql).toMatch(
      /DROP POLICY IF EXISTS\s+"applicant can read own packet risk score"\s+ON\s+snap_enrollment\.packet_error_risk/i,
    );
  });

  it("recreates the policy on packet_error_risk FOR SELECT", () => {
    expect(sql).toMatch(
      /CREATE POLICY\s+"applicant can read own packet risk score"\s+ON\s+snap_enrollment\.packet_error_risk\s+FOR SELECT/i,
    );
  });

  it("uses the canonical applicants.auth_uid join, not applicant_id = auth.uid()", () => {
    // The bug pattern: a bare `applicant_id = auth.uid()` predicate.
    expect(sql).not.toMatch(/applicant_id\s*=\s*auth\.uid\(\)/);
    // The canonical pattern: subquery into applicants WHERE auth_uid = auth.uid().
    expect(sql).toMatch(
      /FROM\s+snap_enrollment\.applicants\s+WHERE\s+auth_uid\s*=\s*auth\.uid\(\)/i,
    );
  });

  it("scopes the policy to the authenticated role", () => {
    expect(sql).toMatch(/FOR SELECT\s+TO\s+authenticated/i);
  });
});
