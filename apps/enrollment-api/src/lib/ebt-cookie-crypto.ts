/**
 * Thin wrapper around the pgsodium-backed encrypt_session_cookie /
 * decrypt_session_cookie RPCs (migration 20260576_ebt_cookie_encryption.sql).
 *
 * Why a wrapper instead of inlining .rpc() at the two call sites:
 *
 *   1. **Single grep target.** `git grep encryptSessionCookie` / `git grep
 *      decryptSessionCookie` returns exactly the two production call sites
 *      (link.ts on write, ebt-dispatch.ts on dispatch). That's the entire
 *      attack surface for the plaintext cookie — if a future route ever
 *      grows a third call site, code review catches it immediately.
 *
 *   2. **Consistent error semantics.** Both routes need the *same* "throw
 *      with a useful message on RPC failure" behavior — otherwise we'd
 *      either accidentally store/dispatch null, or have to re-derive the
 *      same `if (error || data == null)` guard in each caller.
 *
 *   3. **Test seam.** `link.test.ts` mocks `makeServiceClient` to return
 *      a fake supabase client whose `.rpc()` returns canned data. Keeping
 *      the wrapper means tests can also assert "encrypt RPC was called
 *      with the raw cookie" via `vi.mock(ebt-cookie-crypto.js)` if needed,
 *      without re-mocking the full client shape.
 *
 * The `pgs1:` prefix is the migration's wire format — the decrypt RPC
 * tolerates legacy plaintext input (returns it verbatim) so that the
 * gateway works against a freshly-applied migration before the backfill
 * step runs, but we do NOT rely on that fallback here: the wrapper only
 * validates that decrypt returned a string.
 */

import type { makeServiceClient } from './supabase.js';

type ServiceClient = ReturnType<typeof makeServiceClient>;

/**
 * Encrypts a plaintext cookie via the snap_enrollment.encrypt_session_cookie
 * SECURITY DEFINER RPC. Returns the 'pgs1:<base64>' ciphertext blob.
 *
 * Throws an Error (not an HTTPException) on RPC failure or unexpected
 * response shape. The caller wraps in HTTPException(500) so the wire-format
 * of the wrapper doesn't leak into route response codes.
 */
export async function encryptSessionCookie(
  db: ServiceClient,
  plaintext: string,
): Promise<string> {
  if (typeof plaintext !== 'string' || plaintext.length === 0) {
    throw new Error('encryptSessionCookie: plaintext must be non-empty');
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (db as any).rpc(
    'encrypt_session_cookie',
    { plaintext },
  ) as { data: string | null; error: { message: string } | null };

  if (error) {
    throw new Error(`encrypt_session_cookie RPC failed: ${error.message}`);
  }
  if (typeof data !== 'string' || data.length === 0) {
    throw new Error('encrypt_session_cookie RPC returned no ciphertext');
  }
  return data;
}

/**
 * Decrypts a 'pgs1:<base64>' ciphertext blob via the
 * snap_enrollment.decrypt_session_cookie SECURITY DEFINER RPC. Returns the
 * recovered plaintext.
 *
 * The migration's RPC tolerates a legacy plaintext input (returns it
 * verbatim) so that this wrapper still works on rows that were inserted
 * before the migration's backfill step touched them — the dispatch path
 * therefore degrades to "use plaintext" rather than failing loudly. After
 * the backfill DO block runs once, no row should ever take that path.
 */
export async function decryptSessionCookie(
  db: ServiceClient,
  ciphertext: string,
): Promise<string> {
  if (typeof ciphertext !== 'string' || ciphertext.length === 0) {
    throw new Error('decryptSessionCookie: ciphertext must be non-empty');
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (db as any).rpc(
    'decrypt_session_cookie',
    { ciphertext },
  ) as { data: string | null; error: { message: string } | null };

  if (error) {
    throw new Error(`decrypt_session_cookie RPC failed: ${error.message}`);
  }
  if (typeof data !== 'string' || data.length === 0) {
    throw new Error('decrypt_session_cookie RPC returned no plaintext');
  }
  return data;
}
