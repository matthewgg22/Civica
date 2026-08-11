import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { Pool } from "pg";

// Saved-conversation isolation vs REAL Postgres.
//
// This is the spec that matters for this feature, and it cannot be a unit test.
// Unlike every other Demeter table — where the Next.js route is what enforces
// access, because guest tokens have no auth.uid() to key on — the saved
// conversations table is guarded by RLS (migration 20260617), and the routes
// deliberately use the USER-SCOPED Supabase client so those policies are
// load-bearing. "Can user B read user A's conversation?" is therefore a
// property of the POLICIES, not of any TypeScript we could mock.
//
// Same lesson as demeter-feedback.pg.test.ts, one layer up: that bug was a
// partial index silently breaking an upsert for two weeks. A policy with a
// missing WITH CHECK fails the same way — quietly, and in the direction of
// leaking rather than of erroring.
//
// Each case acts as the `authenticated` PostgREST role with a jwt claim, which
// is what PostgREST does per request. The pool's own role (superuser) BYPASSES
// RLS, so any query run without SET LOCAL ROLE proves nothing.
//
// CI applies the real migration files. Locally it skips unless
// TEST_DATABASE_URL is set.
const DB = process.env.TEST_DATABASE_URL;

const USER_A = "11111111-1111-4111-8111-111111111111";
const USER_B = "22222222-2222-4222-8222-222222222222";

describe.skipIf(!DB)("saved conversations, RLS (real Postgres)", () => {
  let pool: Pool;

  beforeAll(() => {
    pool = new Pool({ connectionString: DB, max: 4 });
  });

  afterAll(async () => {
    await pool?.query(
      "DELETE FROM snap_enrollment.demeter_conversations WHERE user_id = ANY($1::uuid[])",
      [[USER_A, USER_B]],
    );
    await pool?.end();
  });

  /** Run statements the way PostgREST does: as `authenticated`, with a jwt
   *  claim, inside one transaction. Returns the LAST statement's rows. */
  async function asUser<T = Record<string, unknown>>(
    userId: string,
    statements: Array<[string, unknown[]?]>,
  ): Promise<T[]> {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SET LOCAL ROLE authenticated");
      await client.query("SELECT set_config('request.jwt.claims', $1, true)", [
        JSON.stringify({ sub: userId, role: "authenticated" }),
      ]);
      let last: T[] = [];
      for (const [sql, params] of statements) {
        last = (await client.query(sql, params ?? [])).rows as T[];
      }
      await client.query("COMMIT");
      return last;
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  const INSERT = `INSERT INTO snap_enrollment.demeter_conversations
      (user_id, title, messages, state_code, lang)
    VALUES ($1, $2, $3::jsonb, $4, $5) RETURNING id`;

  const ONE_TURN = JSON.stringify([
    { role: "user", content: "What's the income limit for my household?" },
    { role: "assistant", content: "For a household of two in California…" },
  ]);

  beforeEach(async () => {
    await pool.query(
      "DELETE FROM snap_enrollment.demeter_conversations WHERE user_id = ANY($1::uuid[])",
      [[USER_A, USER_B]],
    );
    await asUser(USER_A, [[INSERT, [USER_A, "A's conversation", ONE_TURN, "CA", "en"]]]);
    await asUser(USER_B, [[INSERT, [USER_B, "B's conversation", ONE_TURN, "WA", "es"]]]);
  });

  it("shows each user only their own conversations", async () => {
    const rows = await asUser<{ title: string }>(USER_B, [
      ["SELECT title FROM snap_enrollment.demeter_conversations"],
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.title).toBe("B's conversation");
  });

  it("matches zero rows when one user targets another's conversation by id", async () => {
    // The route turns "zero rows" into a 404 — the SAME answer it gives for an
    // id that never existed, so the endpoint cannot be used to discover that a
    // given conversation belongs to somebody.
    const [{ id }] = await pool.query<{ id: string }>(
      "SELECT id FROM snap_enrollment.demeter_conversations WHERE user_id = $1",
      [USER_A],
    ).then((r) => r.rows);

    const seen = await asUser(USER_B, [
      ["SELECT id FROM snap_enrollment.demeter_conversations WHERE id = $1", [id]],
    ]);
    expect(seen).toHaveLength(0);
  });

  it("refuses to let one user edit another's conversation", async () => {
    const updated = await asUser(USER_B, [
      [
        `UPDATE snap_enrollment.demeter_conversations SET title = 'stolen'
         WHERE title = $1 RETURNING id`,
        ["A's conversation"],
      ],
    ]);
    expect(updated).toHaveLength(0);

    const { rows } = await pool.query(
      "SELECT title FROM snap_enrollment.demeter_conversations WHERE user_id = $1",
      [USER_A],
    );
    expect(rows[0]!.title).toBe("A's conversation");
  });

  it("refuses to let one user delete another's conversation", async () => {
    const deleted = await asUser(USER_B, [
      [
        `DELETE FROM snap_enrollment.demeter_conversations
         WHERE title = $1 RETURNING id`,
        ["A's conversation"],
      ],
    ]);
    expect(deleted).toHaveLength(0);

    const { rows } = await pool.query(
      "SELECT count(*)::int AS n FROM snap_enrollment.demeter_conversations WHERE user_id = $1",
      [USER_A],
    );
    expect(rows[0]!.n).toBe(1);
  });

  it("refuses a row planted under someone else's user_id", async () => {
    // Without the INSERT policy's WITH CHECK, a compromised or buggy route
    // could write a conversation straight into another person's list.
    await expect(
      asUser(USER_B, [[INSERT, [USER_A, "planted", ONE_TURN, "CA", "en"]]]),
    ).rejects.toThrow(/row-level security/i);
  });

  it("refuses to reassign your own conversation to another user", async () => {
    // The row IS yours to update, so the UPDATE policy's USING clause passes;
    // what has to be stopped is what the row BECOMES. Measured with mutations
    // against a real database: this is refused twice over — by the UPDATE
    // policy's WITH CHECK, and independently by the SELECT policy, since the
    // reassigned row would no longer be visible to the user writing it.
    // Widening either alone still refuses; only widening both lets it through.
    await expect(
      asUser(USER_B, [
        [
          `UPDATE snap_enrollment.demeter_conversations SET user_id = $1
           WHERE title = $2`,
          [USER_A, "B's conversation"],
        ],
      ]),
    ).rejects.toThrow(/row-level security/i);
  });

  it("gives the anonymous PostgREST role no reach at all", async () => {
    // The public chat is anonymous, so `anon` is the role most of this surface
    // runs as. It must not be able to touch saved conversations even to be
    // refused by a policy — prod does not grant it USAGE on the schema.
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SET LOCAL ROLE anon");
      await expect(
        client.query("SELECT count(*) FROM snap_enrollment.demeter_conversations"),
      ).rejects.toThrow(/permission denied/i);
    } finally {
      await client.query("ROLLBACK").catch(() => {});
      client.release();
    }
  });

  it("stamps updated_at on every write, so the list orders by real activity", async () => {
    // The list is ordered by updated_at and the chat re-posts after each answer.
    // If the trigger were missing, "most recent" would silently mean "created
    // first" and a conversation someone just added to would sink to the bottom.
    const [{ id, updated_at: before }] = await pool
      .query<{ id: string; updated_at: Date }>(
        "SELECT id, updated_at FROM snap_enrollment.demeter_conversations WHERE user_id = $1",
        [USER_A],
      )
      .then((r) => r.rows);

    await asUser(USER_A, [
      [
        "UPDATE snap_enrollment.demeter_conversations SET title = $1 WHERE id = $2",
        ["renamed", id],
      ],
    ]);

    const { rows } = await pool.query<{ updated_at: Date }>(
      "SELECT updated_at FROM snap_enrollment.demeter_conversations WHERE id = $1",
      [id],
    );
    expect(rows[0]!.updated_at.getTime()).toBeGreaterThan(before.getTime());
  });

  it("rejects a transcript longer than the column's CHECK allows", async () => {
    // The route trims to MAX_MESSAGES before it ever gets here; this asserts
    // the database is the backstop and not merely decoration, so a future
    // caller that skips the helper cannot write an unbounded transcript.
    const tooMany = JSON.stringify(
      Array.from({ length: 201 }, () => ({ role: "user", content: "x" })),
    );
    await expect(
      asUser(USER_A, [[INSERT, [USER_A, "too long", tooMany, "CA", "en"]]]),
    ).rejects.toThrow(/violates check constraint/i);
  });
});
