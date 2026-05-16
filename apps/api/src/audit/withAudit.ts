import type { Kysely } from 'kysely';
import type { DB } from '../db/schema.js';
import type { Trx } from '../db/client.js';
import type { AuditAction, AuditActor, WithAuditOptions } from './types.js';

/**
 * Runs `fn` inside a Kysely transaction, then inserts a snap_audit_log row
 * in the SAME transaction. If the audit insert fails, the entire transaction
 * (including fn's mutations) rolls back. This is hard requirement #2.
 *
 * Usage:
 *   const note = await withAudit(getDb(), actor, 'NOTE_ADDED', sessionId,
 *     (trx) => trx.insertInto('snap_navigator_notes').values({...}).executeTakeFirstOrThrow(),
 *     { requestId: c.req.header('x-request-id') ?? undefined }
 *   );
 */
export async function withAudit<T>(
  db: Kysely<DB>,
  actor: AuditActor,
  action: AuditAction,
  sessionId: string,
  fn: (trx: Trx) => Promise<T>,
  opts?: WithAuditOptions,
): Promise<T> {
  return db.transaction().execute(async (trx) => {
    const result = await fn(trx);

    await trx
      .insertInto('snap_audit_log')
      .values({
        session_id: sessionId,
        action,
        actor_kind: actor.kind,
        actor_id: actor.id ?? null,
        reason: opts?.reason ?? action,
        request_id: opts?.requestId ?? null,
        column_or_resource: opts?.columnOrResource ?? null,
      })
      .execute();

    return result;
  });
}
