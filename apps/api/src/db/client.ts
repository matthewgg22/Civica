import { Kysely, PostgresDialect } from 'kysely';
import type { Transaction } from 'kysely';
import { Pool } from 'pg';
import type { DB } from './schema.js';

let _db: Kysely<DB> | null = null;

export function getDb(): Kysely<DB> {
  if (!_db) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error('DATABASE_URL is required');
    _db = new Kysely<DB>({
      dialect: new PostgresDialect({
        pool: new Pool({ connectionString, max: 10 }),
      }),
    });
  }
  return _db;
}

// Alias used by the audit wrapper (Phase 7) and every mutating handler.
export type Trx = Transaction<DB>;

export async function withTransaction<T>(fn: (trx: Trx) => Promise<T>): Promise<T> {
  return getDb().transaction().execute(fn);
}
