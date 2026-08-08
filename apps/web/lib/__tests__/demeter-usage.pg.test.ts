import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Pool } from "pg";

// Counter RPC vs REAL Postgres (T12 / eng 2A): the whole point of
// demeter_increment_and_check is that concurrent requests can't lose updates
// the way a read-modify-write would. CI applies the actual migration files to
// a Supabase-shaped database (schema + roles) and this spec hammers the RPC.
// Locally it skips unless TEST_DATABASE_URL is set.
const DB = process.env.TEST_DATABASE_URL;

describe.skipIf(!DB)("demeter_increment_and_check (real Postgres)", () => {
  let pool: Pool;

  beforeAll(async () => {
    pool = new Pool({ connectionString: DB, max: 10 });
    await pool.query("DELETE FROM snap_enrollment.demeter_usage WHERE bucket LIKE 'spec:%'");
  });

  afterAll(async () => {
    await pool?.end();
  });

  async function rpc(bucket: string, amount: number): Promise<number> {
    const { rows } = await pool.query(
      "SELECT snap_enrollment.demeter_increment_and_check($1, $2) AS count",
      [bucket, amount],
    );
    return Number(rows[0].count);
  }

  it("25 concurrent increments settle to exactly 25 with no lost updates", async () => {
    const returns = await Promise.all(
      Array.from({ length: 25 }, () => rpc("spec:concurrency", 1)),
    );
    // Each call returns the count AFTER its own increment. If and only if the
    // upsert-increment is atomic, the returns are a permutation of 1..25 —
    // a lost update would surface as a duplicate.
    expect([...returns].sort((a, b) => a - b)).toEqual(
      Array.from({ length: 25 }, (_, i) => i + 1),
    );
    const { rows } = await pool.query(
      "SELECT count FROM snap_enrollment.demeter_usage WHERE bucket = 'spec:concurrency'",
    );
    expect(Number(rows[0].count)).toBe(25);
  });

  it("accumulates fractional spend amounts without drift", async () => {
    await Promise.all(Array.from({ length: 10 }, () => rpc("spec:spend", 0.37)));
    const { rows } = await pool.query(
      "SELECT count FROM snap_enrollment.demeter_usage WHERE bucket = 'spec:spend'",
    );
    // numeric column — exact decimal arithmetic, not float drift.
    expect(Number(rows[0].count)).toBe(3.7);
  });

  it("is not executable by anon (REVOKE lockdown holds)", async () => {
    const client = await pool.connect();
    try {
      await client.query("SET ROLE anon");
      await expect(
        client.query("SELECT snap_enrollment.demeter_increment_and_check('spec:anon', 1)"),
      ).rejects.toThrow(/permission denied/);
    } finally {
      await client.query("RESET ROLE");
      client.release();
    }
  });
});
