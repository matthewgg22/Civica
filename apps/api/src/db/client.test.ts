import { sql } from 'kysely';
import { describe, expect, it } from 'vitest';

// Skipped in CI when there is no running Postgres.
// Run locally: DATABASE_URL=postgres://civica:civica@127.0.0.1:5432/civica_dev pnpm test
const dbAvailable = Boolean(process.env.DATABASE_URL);

describe.skipIf(!dbAvailable)('DB connectivity', () => {
  it('SELECT 1 reaches Postgres', async () => {
    const { getDb } = await import('./client.js');
    const result = await sql<{ one: number }>`SELECT 1 AS one`.execute(getDb());
    expect(result.rows[0]?.one).toBe(1);
  });

  it('withTransaction commits successfully', async () => {
    const { withTransaction } = await import('./client.js');
    const result = await withTransaction(async (trx) => {
      const r = await sql<{ two: number }>`SELECT 2 AS two`.execute(trx);
      return r.rows[0]?.two;
    });
    expect(result).toBe(2);
  });
});
