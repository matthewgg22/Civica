import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { Pool } from "pg";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { RETENTION_DAYS, RETENTION_JOB_LIVE } from "../legal/types";

// The retention sweep vs REAL Postgres (#926).
//
// Retention moved out of TypeScript and into the database, onto the pg_cron
// schedule that was already running — which removed an operator step but cost
// the one guarantee the TS version had for free: it IMPORTED RETENTION_DAYS,
// so the policy's promise and the job's behaviour could not disagree. SQL
// cannot import a TS constant.
//
// This file is what replaces that guarantee, and it is deliberately stronger
// than a string comparison would be: it runs the actual function against a
// real database and asserts the OBSERVED cutoff matches RETENTION_DAYS. A
// migration that says 7 and behaves like 90 fails here.
const DB = process.env.TEST_DATABASE_URL;

const MIGRATION = join(
  __dirname, "..", "..", "..", "..",
  "supabase", "migrations", "20260824_demeter_query_log_retention_purge.sql",
);
const TOMBSTONE = "[expired per retention policy]";

describe.skipIf(!DB)("mae_query_log retention sweep (real Postgres)", () => {
  let pool: Pool;

  beforeAll(async () => {
    pool = new Pool({ connectionString: DB, max: 4 });
  });

  afterAll(async () => {
    await pool?.end();
  });

  beforeEach(async () => {
    await pool.query("DELETE FROM snap_enrollment.mae_query_log");
  });

  /** Insert one row aged `ageDays` days, flagged or not. */
  async function seed(ageDays: number, flagged: boolean, text = "how do I apply?") {
    const { rows } = await pool.query(
      `INSERT INTO snap_enrollment.mae_query_log
         (created_at, question_redacted, answer, unrecognized_count, citations)
       VALUES (now() - make_interval(days => $1), $2, 'an answer', $3, '[]'::jsonb)
       RETURNING id`,
      [ageDays, text, flagged ? 1 : 0],
    );
    return rows[0].id as string;
  }

  async function sweep(dryRun = false) {
    const { rows } = await pool.query(
      "SELECT tier, window_days, rows_swept FROM snap_enrollment.purge_mae_query_log_retention($1)",
      [dryRun],
    );
    return Object.fromEntries(
      rows.map((r) => [r.tier, { days: Number(r.window_days), rows: Number(r.rows_swept) }]),
    ) as Record<"ordinary" | "flagged", { days: number; rows: number }>;
  }

  async function textOf(id: string) {
    const { rows } = await pool.query(
      "SELECT question_redacted, answer FROM snap_enrollment.mae_query_log WHERE id = $1",
      [id],
    );
    return rows[0] as { question_redacted: string; answer: string | null };
  }

  it("enforces exactly the windows the policy promises", async () => {
    // THE POINT OF THIS FILE. Not "the SQL contains a 7" — the sweep's
    // observed behaviour, either side of the boundary RETENTION_DAYS names.
    const justInside = await seed(RETENTION_DAYS.questionText - 1, false);
    const justOutside = await seed(RETENTION_DAYS.questionText + 1, false);

    await sweep();

    expect((await textOf(justInside)).question_redacted).not.toBe(TOMBSTONE);
    expect((await textOf(justOutside)).question_redacted).toBe(TOMBSTONE);
  });

  it("gives flagged rows their longer window, on both sides of it", async () => {
    const flaggedInside = await seed(RETENTION_DAYS.flaggedRow - 1, true);
    const flaggedOutside = await seed(RETENTION_DAYS.flaggedRow + 1, true);
    // Old enough for the ordinary window, but flagged — must survive.
    const flaggedMiddle = await seed(RETENTION_DAYS.questionText + 1, true);

    await sweep();

    expect((await textOf(flaggedInside)).question_redacted).not.toBe(TOMBSTONE);
    expect((await textOf(flaggedMiddle)).question_redacted).not.toBe(TOMBSTONE);
    expect((await textOf(flaggedOutside)).question_redacted).toBe(TOMBSTONE);
  });

  it("reports the windows it used, and they are RETENTION_DAYS", async () => {
    const result = await sweep(true);
    expect(result.ordinary.days).toBe(RETENTION_DAYS.questionText);
    expect(result.flagged.days).toBe(RETENTION_DAYS.flaggedRow);
  });

  it("blanks the answer as well as the question", async () => {
    const id = await seed(RETENTION_DAYS.questionText + 1, false);
    await sweep();
    const row = await textOf(id);
    expect(row.question_redacted).toBe(TOMBSTONE);
    expect(row.answer).toBeNull();
  });

  it("keeps the row and every non-text column — that is the accuracy dataset", async () => {
    const id = await seed(RETENTION_DAYS.questionText + 1, false);
    await pool.query(
      `UPDATE snap_enrollment.mae_query_log
          SET certainty = 'CERTAIN', verifier_outcome = 'pass', mode = 'public',
              citations = '["7 CFR 273.5"]'::jsonb, pii_redactions = 2
        WHERE id = $1`,
      [id],
    );
    await sweep();
    const { rows } = await pool.query(
      `SELECT certainty, verifier_outcome, mode, citations, pii_redactions
         FROM snap_enrollment.mae_query_log WHERE id = $1`,
      [id],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].certainty).toBe("CERTAIN");
    expect(rows[0].verifier_outcome).toBe("pass");
    expect(rows[0].mode).toBe("public");
    expect(rows[0].citations).toEqual(["7 CFR 273.5"]);
    expect(rows[0].pii_redactions).toBe(2);
  });

  it("a dry run counts without writing", async () => {
    await seed(RETENTION_DAYS.questionText + 1, false);
    const id = await seed(RETENTION_DAYS.questionText + 1, false);

    const dry = await sweep(true);
    expect(dry.ordinary.rows).toBe(2);
    expect((await textOf(id)).question_redacted).not.toBe(TOMBSTONE);

    const real = await sweep();
    expect(real.ordinary.rows).toBe(2);
    expect((await textOf(id)).question_redacted).toBe(TOMBSTONE);
  });

  it("is idempotent — a second run re-sweeps nothing", async () => {
    await seed(RETENTION_DAYS.questionText + 1, false);
    expect((await sweep()).ordinary.rows).toBe(1);
    // Already-expired rows are excluded, so the daily job touches only what
    // newly crossed the line instead of rewriting the table every night.
    expect((await sweep()).ordinary.rows).toBe(0);
  });
});

// These run everywhere, with or without a database.
describe("the migration is scheduled and safe to replay", () => {
  const sql = readFileSync(MIGRATION, "utf8");

  it("states the same windows the policy does", () => {
    // Belt to the behavioural braces above: catches a drifted constant even in
    // a local run with no TEST_DATABASE_URL.
    expect(sql).toContain(`c_ordinary constant integer := ${RETENTION_DAYS.questionText};`);
    expect(sql).toContain(`c_flagged  constant integer := ${RETENTION_DAYS.flaggedRow};`);
  });

  it("guards cron.schedule so the chain still replays without pg_cron", () => {
    // The migration-replay job applies this file to a stock postgres image.
    // Unguarded, this migration would have to join the skip list — and then
    // the FUNCTION would never be replay-tested either.
    expect(sql).toMatch(/if exists \(select 1 from pg_extension where extname = 'pg_cron'\)/i);
    expect(sql).toContain("cron.schedule(");
  });

  it("RETENTION_JOB_LIVE cannot be true without the job that makes it true", () => {
    // The constant asserts something about PROD, which no test can reach. What
    // a test CAN do is stop the assertion outliving its own mechanism: if this
    // migration is ever deleted, renamed, or stripped of its schedule while
    // the flag still reads true, the Privacy Policy would be making a
    // retention promise with nothing behind it — the exact failure the flag
    // was invented to prevent, arriving from the other direction.
    if (!RETENTION_JOB_LIVE) return;
    expect(sql).toContain("purge_mae_query_log_retention");
    expect(sql).toContain("demeter-purge-query-log-daily");
    expect(sql).toContain("cron.schedule(");
  });

  it("schedules its own job rather than editing the packet-retention one", () => {
    expect(sql).toContain("demeter-purge-query-log-daily");
    expect(sql, "the 7-year packet purge is a separate obligation").not.toMatch(
      /create or replace function snap_enrollment\.purge_snap_retention/i,
    );
  });
});
