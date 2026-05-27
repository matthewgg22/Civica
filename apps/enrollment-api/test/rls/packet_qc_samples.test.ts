// RLS 4-way matrix per docs/plans/error-rate-engine-falsification.md (T11 / ENG-D5):
//
//   - navigator A reads org A sample  → allow
//   - navigator A reads org B sample  → deny
//   - applicant   reads samples table → deny
//   - service     role inserts         → allow
//
// No live Supabase test DB is wired into the worktree, so this test asserts
// the *static shape* of the migration's RLS policies + trigger. Each
// assertion maps a behavioural matrix entry to the SQL clause that
// guarantees it. The same migration replayed against a real Postgres would
// produce pg_policies / pg_trigger rows matching these strings.
//
// To upgrade to a live-DB matrix later: swap `policies` parsing for
// `SELECT * FROM pg_policies WHERE tablename = 'packet_qc_samples'` after
// applying the migration to a throwaway test schema, and replace the
// `expect(text).toMatch(...)` asserts with row-shape asserts.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const MIGRATION_PATH = resolve(
  __dirname,
  "../../../../supabase/migrations/20260590_packet_qc_samples.sql",
);

const sql = readFileSync(MIGRATION_PATH, "utf8");

describe("packet_qc_samples RLS shape (migration 20260590)", () => {
  it("enables row-level security on the table", () => {
    expect(sql).toMatch(
      /ALTER TABLE\s+snap_enrollment\.packet_qc_samples\s+ENABLE ROW LEVEL SECURITY/i,
    );
  });

  // -------------------------------------------------------------------------
  // Matrix entry 1: navigator A reads org A sample → ALLOW
  // Matrix entry 2: navigator A reads org B sample → DENY
  //
  // Both are guaranteed by the SELECT policy USING (is_navigator_in_org(org_id)).
  // The helper resolves the navigator's org via staff_users; when the row's
  // org_id doesn't match, USING returns false and the row is filtered out.
  // -------------------------------------------------------------------------
  it("grants SELECT to navigators in the row's org only", () => {
    expect(sql).toMatch(
      /CREATE POLICY\s+"navigator can read own org qc samples"[\s\S]*?ON\s+snap_enrollment\.packet_qc_samples[\s\S]*?FOR SELECT[\s\S]*?USING\s*\(\s*snap_enrollment\.is_navigator_in_org\s*\(\s*org_id\s*\)\s*\)/i,
    );
  });

  it("does not declare a SELECT/INSERT/UPDATE/DELETE policy for applicants", () => {
    // No CREATE POLICY clause should mention applicant_id or auth.uid() in
    // a USING clause on this table — confirming the applicant read-deny
    // path is the RLS default-deny (no permissive policy applies).
    const policyBlocks = sql.match(/CREATE POLICY[\s\S]*?;/gi) ?? [];
    const onThisTable = policyBlocks.filter((p) =>
      /packet_qc_samples/i.test(p),
    );
    for (const block of onThisTable) {
      expect(block).not.toMatch(/applicant_id/i);
      expect(block).not.toMatch(/auth\.uid\(\)/i);
    }
    // Exactly one permissive policy expected on this table — the navigator
    // SELECT. Any extra policy would risk widening the matrix.
    expect(onThisTable.length).toBe(1);
  });

  // -------------------------------------------------------------------------
  // Matrix entry 4: service_role inserts → ALLOW
  //
  // Supabase grants service_role bypass on RLS-enabled tables when the
  // grant chain exists. The migration must explicitly hand INSERT to
  // service_role so a future grant audit can't accidentally tighten this.
  // -------------------------------------------------------------------------
  it("grants INSERT (and UPDATE) on the table to service_role", () => {
    expect(sql).toMatch(
      /GRANT[^;]*INSERT[^;]*ON\s+snap_enrollment\.packet_qc_samples\s+TO\s+service_role/i,
    );
    expect(sql).toMatch(
      /GRANT[^;]*UPDATE[^;]*ON\s+snap_enrollment\.packet_qc_samples\s+TO\s+service_role/i,
    );
  });

  it("does NOT grant INSERT/UPDATE to authenticated (writes are service-role only)", () => {
    // Single GRANT line for authenticated; must be SELECT only.
    const authenticatedGrant = sql.match(
      /GRANT[^;]+ON\s+snap_enrollment\.packet_qc_samples\s+TO\s+authenticated[^;]*;/i,
    );
    expect(authenticatedGrant).not.toBeNull();
    const text = authenticatedGrant![0];
    expect(text).toMatch(/SELECT/i);
    expect(text).not.toMatch(/INSERT/i);
    expect(text).not.toMatch(/UPDATE/i);
    expect(text).not.toMatch(/DELETE/i);
  });
});

describe("packet_qc_samples constraints + indexes (migration 20260590)", () => {
  it("enforces the sample_stage CHECK enum", () => {
    expect(sql).toMatch(
      /CHECK\s*\(\s*sample_stage\s+IN\s*\(\s*'creation'\s*,\s*'submission'\s*\)\s*\)/i,
    );
  });

  it("enforces submission_sample_pre_submit (sampling-bias guard)", () => {
    expect(sql).toMatch(/CONSTRAINT\s+submission_sample_pre_submit/i);
    expect(sql).toMatch(/sampled_at\s*<\s*submitted_at/i);
  });

  it("declares the three required indexes (ENG-D7 + ON CONFLICT support)", () => {
    expect(sql).toMatch(
      /CREATE INDEX\s+idx_packet_qc_samples_queue[\s\S]*?\(\s*org_id\s*,\s*sample_stage\s*,\s*completed_at\s*\)/i,
    );
    expect(sql).toMatch(
      /CREATE INDEX\s+idx_packet_qc_samples_applicant[\s\S]*?\(\s*applicant_id\s*,\s*closed_reason\s*\)/i,
    );
    expect(sql).toMatch(
      /CREATE UNIQUE INDEX\s+uq_packet_qc_samples_packet_stage[\s\S]*?\(\s*packet_id\s*,\s*sample_stage\s*\)/i,
    );
  });
});

describe("applicant-restart closure trigger (T4b / D6)", () => {
  it("defines close_prior_qc_samples_on_restart function", () => {
    expect(sql).toMatch(
      /CREATE OR REPLACE FUNCTION\s+snap_enrollment\.close_prior_qc_samples_on_restart\s*\(\s*\)/i,
    );
  });

  it("function sets completed_at + closed_reason='applicant_restart' for open rows", () => {
    expect(sql).toMatch(
      /UPDATE\s+snap_enrollment\.packet_qc_samples[\s\S]*?SET[\s\S]*?completed_at\s*=\s*now\(\)[\s\S]*?closed_reason\s*=\s*'applicant_restart'/i,
    );
    expect(sql).toMatch(/completed_at\s+IS\s+NULL/i);
    expect(sql).toMatch(/closed_reason\s+IS\s+NULL/i);
  });

  it("creates trg_close_prior_qc_samples AFTER INSERT on snap_packets", () => {
    expect(sql).toMatch(
      /CREATE TRIGGER\s+trg_close_prior_qc_samples\s+AFTER INSERT\s+ON\s+snap_enrollment\.snap_packets\s+FOR EACH ROW\s+EXECUTE FUNCTION\s+snap_enrollment\.close_prior_qc_samples_on_restart/i,
    );
  });
});
