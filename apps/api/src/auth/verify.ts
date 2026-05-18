import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { JWTPayload, JWTVerifyGetKey } from 'jose';

let _secret: Uint8Array | null = null;
let _jwks: JWTVerifyGetKey | null = null;

function getVerifier(): Uint8Array | JWTVerifyGetKey {
  const s = process.env.SUPABASE_JWT_SECRET;
  if (s) {
    if (!_secret) _secret = new TextEncoder().encode(s);
    return _secret;
  }
  if (!_jwks) {
    const url = process.env.SUPABASE_URL;
    if (!url) throw new Error('SUPABASE_URL is required for JWT verification');
    _jwks = createRemoteJWKSet(new URL(`${url}/auth/v1/.well-known/jwks.json`));
  }
  return _jwks;
}

export async function verifySupabaseJwt(token: string): Promise<JWTPayload> {
  const { payload } = await jwtVerify(token, getVerifier());
  return payload;
}

// Exposed for tests so they can reset the cached secret between runs.
export function _resetSecretCache(): void {
  _secret = null;
  _jwks = null;
}
