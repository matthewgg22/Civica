import { jwtVerify } from 'jose';
import type { JWTPayload } from 'jose';

let _secret: Uint8Array | null = null;

function getSecret(): Uint8Array {
  if (!_secret) {
    const s = process.env.SUPABASE_JWT_SECRET;
    if (!s) throw new Error('SUPABASE_JWT_SECRET is required');
    _secret = new TextEncoder().encode(s);
  }
  return _secret;
}

export async function verifySupabaseJwt(token: string): Promise<JWTPayload> {
  const { payload } = await jwtVerify(token, getSecret(), {
    algorithms: ['HS256'],
  });
  return payload;
}

// Exposed for tests so they can reset the cached secret between runs.
export function _resetSecretCache(): void {
  _secret = null;
}
