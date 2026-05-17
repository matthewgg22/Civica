import type { Kysely } from 'kysely';
import { describe, expect, it } from 'vitest';
import type { Trx } from '../db/client.js';
import type { DB, SnapAuditLogTable } from '../db/schema.js';
import type { AuditActor } from './types.js';
import { withAudit } from './withAudit.js';

// ── Minimal mock database ─────────────────────────────────────────────────
// Simulates only the surface withAudit touches: transaction().execute() and
// insertInto('snap_audit_log').values({}).execute().

type AuditInsert = Omit<SnapAuditLogTable, 'audit_id' | 'occurred_at'>;

class MockDb {
  readonly auditInserts: AuditInsert[] = [];
  failOnAudit = false;

  private makeTrx(): Trx {
    return {
      insertInto: (table: string) => ({
        values: (row: unknown) => ({
          execute: async () => {
            if (table === 'snap_audit_log') {
              if (this.failOnAudit) throw new Error('audit insert simulated failure');
              this.auditInserts.push(row as AuditInsert);
            }
            return { numInsertedOrUpdatedRows: 1n };
          },
        }),
      }),
    } as unknown as Trx;
  }

  get db(): Kysely<DB> {
    const self = this;
    return {
      transaction: () => ({
        execute: async <T>(fn: (trx: Trx) => Promise<T>): Promise<T> =>
          fn(self.makeTrx()),
      }),
    } as unknown as Kysely<DB>;
  }
}

const actor: AuditActor = { kind: 'authenticated_user', id: 'user-abc' };

// ── happy path ────────────────────────────────────────────────────────────

describe('withAudit — happy path', () => {
  it('returns the fn result', async () => {
    const mock = new MockDb();
    const result = await withAudit(mock.db, actor, 'NOTE_ADDED', 'session-1', async () => 42);
    expect(result).toBe(42);
  });

  it('inserts exactly one audit row', async () => {
    const mock = new MockDb();
    await withAudit(mock.db, actor, 'NOTE_ADDED', 'session-1', async () => {});
    expect(mock.auditInserts).toHaveLength(1);
  });

  it('audit row carries correct actor and action fields', async () => {
    const mock = new MockDb();
    await withAudit(mock.db, actor, 'STATUS_TRANSITIONED', 'session-42', async () => {}, {
      reason: 'navigator moved to in_review',
      requestId: 'req-xyz',
      columnOrResource: 'navigator_status',
    });
    expect(mock.auditInserts[0]).toMatchObject({
      session_id: 'session-42',
      action: 'STATUS_TRANSITIONED',
      actor_kind: 'authenticated_user',
      actor_id: 'user-abc',
      reason: 'navigator moved to in_review',
      request_id: 'req-xyz',
      column_or_resource: 'navigator_status',
    });
  });

  it('defaults reason to action name when not supplied', async () => {
    const mock = new MockDb();
    await withAudit(mock.db, actor, 'HANDOFF_EXPORTED', 'session-1', async () => {});
    expect(mock.auditInserts[0]?.reason).toBe('HANDOFF_EXPORTED');
  });

  it('accepts null actor id (anonymous sessions)', async () => {
    const mock = new MockDb();
    const anonActor: AuditActor = { kind: 'anonymous_session', id: null };
    await withAudit(mock.db, anonActor, 'SESSION_CREATED', 'session-1', async () => {});
    expect(mock.auditInserts[0]?.actor_id).toBeNull();
  });

  it('passes the transaction object into fn', async () => {
    const mock = new MockDb();
    let capturedTrx: unknown;
    await withAudit(mock.db, actor, 'NOTE_ADDED', 'session-1', async (trx) => {
      capturedTrx = trx;
    });
    expect(capturedTrx).toBeDefined();
  });
});

// ── mutation failure ──────────────────────────────────────────────────────

describe('withAudit — mutation failure', () => {
  it('propagates the error from fn', async () => {
    const mock = new MockDb();
    await expect(
      withAudit(mock.db, actor, 'NOTE_ADDED', 'session-1', async () => {
        throw new Error('mutation failed');
      }),
    ).rejects.toThrow('mutation failed');
  });

  it('does not insert an audit row when fn throws (fn threw before audit)', async () => {
    const mock = new MockDb();
    await expect(
      withAudit(mock.db, actor, 'NOTE_ADDED', 'session-1', async () => {
        throw new Error('mutation failed');
      }),
    ).rejects.toThrow();
    expect(mock.auditInserts).toHaveLength(0);
  });
});

// ── audit insert failure ──────────────────────────────────────────────────
// This is hard requirement #2: if the audit insert fails, the mutation
// must also be rolled back (because both happen inside the same transaction).

describe('withAudit — audit insert failure', () => {
  it('propagates the audit insert error', async () => {
    const mock = new MockDb();
    mock.failOnAudit = true;
    await expect(
      withAudit(mock.db, actor, 'NOTE_ADDED', 'session-1', async () => 'done'),
    ).rejects.toThrow('audit insert simulated failure');
  });

  it('fn ran before the audit failed (proves rollback is needed)', async () => {
    // With a real DB, the mutation would be rolled back because the transaction
    // is aborted when the audit insert throws. This test documents that fn
    // executes successfully — the rollback guarantee comes from Kysely's
    // transaction().execute(), not from our code. See integration test (skipped
    // without DATABASE_URL) for the observable rollback.
    const mock = new MockDb();
    mock.failOnAudit = true;
    let fnDidRun = false;
    await expect(
      withAudit(mock.db, actor, 'NOTE_ADDED', 'session-1', async () => {
        fnDidRun = true;
        return 'done';
      }),
    ).rejects.toThrow();
    expect(fnDidRun).toBe(true);
  });
});

// ── integration (requires live Postgres) ─────────────────────────────────

const dbAvailable = Boolean(process.env.DATABASE_URL);

describe.skipIf(!dbAvailable)('withAudit — integration (real DB)', () => {
  it('mutation is rolled back when audit insert fails', async () => {
    const { getDb } = await import('../db/client.js');
    const db = getDb();

    // Insert a test session so we have a valid session_id to audit against.
    const session = await db
      .insertInto('snap_sessions')
      .values({ state: 'CA', language: 'en', status: 'active' })
      .returning('session_id')
      .executeTakeFirstOrThrow();

    // Force audit failure by passing an invalid actor_kind.
    // The DB CHECK constraint will reject it and roll back the transaction.
    await expect(
      db.transaction().execute(async (trx) => {
        await trx
          .insertInto('snap_navigator_notes')
          .values({
            session_id: session.session_id,
            author_id: '00000000-0000-0000-0000-000000000001',
            body: 'should be rolled back',
          })
          .execute();
        // Force failure: insert bad actor_kind bypassing the AuditAction type
        await trx
          .insertInto('snap_audit_log')
          .values({
            session_id: session.session_id,
            action: 'NOTE_ADDED',
            actor_kind: 'invalid_kind' as never,
            actor_id: null,
            reason: 'test',
            request_id: null,
            column_or_resource: null,
          })
          .execute();
      }),
    ).rejects.toThrow();

    // Verify the note was NOT persisted (rolled back with the audit).
    const notes = await db
      .selectFrom('snap_navigator_notes')
      .where('session_id', '=', session.session_id)
      .selectAll()
      .execute();
    expect(notes).toHaveLength(0);

    // Cleanup.
    await db.deleteFrom('snap_sessions').where('session_id', '=', session.session_id).execute();
  });
});
