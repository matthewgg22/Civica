import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Pool } from "pg";

// Public feedback upsert vs REAL Postgres.
//
// This exists because a unit test could not have caught the bug it guards. The
// double-count fix relies on `ON CONFLICT (report_id) DO UPDATE`, and whether
// that RESOLVES is a property of the index in the database, not of the route
// code. 20260614 created the uniqueness as a PARTIAL index; Postgres cannot
// infer a partial index as an ON CONFLICT arbiter unless the predicate is
// restated, which PostgREST has no syntax for. Every write failed 42P10 in
// production while the route — deliberately, so a reporter is never punished —
// returned 202 {"ok":true,"stored":false}. Silent, for two weeks.
//
// CI applies the real migration files, so this reproduces the exact shape.
// Locally it skips unless TEST_DATABASE_URL is set.
const DB = process.env.TEST_DATABASE_URL;

const RID = "5b7e0c31-3333-4000-8000-0000000000aa";

describe.skipIf(!DB)("public feedback upsert (real Postgres)", () => {
  let pool: Pool;

  beforeAll(async () => {
    pool = new Pool({ connectionString: DB, max: 4 });
    await pool.query("DELETE FROM snap_enrollment.mae_feedback WHERE report_id = $1", [RID]);
  });

  afterAll(async () => {
    await pool?.query("DELETE FROM snap_enrollment.mae_feedback WHERE report_id = $1", [RID]);
    await pool?.end();
  });

  async function submit(reason: string | null): Promise<void> {
    // The exact statement shape PostgREST generates for
    // .upsert(row, { onConflict: "report_id" }) — no index predicate.
    await pool.query(
      `INSERT INTO snap_enrollment.mae_feedback
         (report_id, rating, source, scope_state, lang, certainty, reason)
       VALUES ($1, 'down', 'public', 'CA', 'en', 'certain', $2)
       ON CONFLICT (report_id) DO UPDATE SET reason = EXCLUDED.reason`,
      [RID, reason],
    );
  }

  it("resolves ON CONFLICT (report_id) — a partial index makes this throw 42P10", async () => {
    await expect(submit(null)).resolves.not.toThrow();
  });

  it("keeps one row per report across the two-step submit", async () => {
    // The public flow submits twice: the thumbs-down fires immediately (most
    // people never reach the follow-up), then again with a reason. Two rows
    // would double-count one person's complaint AND split it across two
    // `reason` buckets — corrupting the exact number the loop exists to produce.
    await submit(null);
    await submit("citation_wrong");

    const { rows } = await pool.query(
      "SELECT count(*)::int AS n, max(reason) AS reason FROM snap_enrollment.mae_feedback WHERE report_id = $1",
      [RID],
    );
    expect(rows[0].n).toBe(1);
    expect(rows[0].reason).toBe("citation_wrong");
  });

  it("still allows many staff rows with a NULL report_id", async () => {
    // The partial predicate existed to protect this. It was never needed:
    // Postgres treats NULLs as distinct in a unique index. Asserted so nobody
    // "restores" the predicate to fix a problem that does not exist.
    const ids: string[] = [];
    for (let i = 0; i < 3; i++) {
      const { rows } = await pool.query(
        `INSERT INTO snap_enrollment.mae_feedback (rating, source, reason)
         VALUES ('down', 'staff', 'other') RETURNING id`,
      );
      ids.push(rows[0].id);
    }
    expect(ids).toHaveLength(3);
    await pool.query("DELETE FROM snap_enrollment.mae_feedback WHERE id = ANY($1::uuid[])", [ids]);
  });
});
