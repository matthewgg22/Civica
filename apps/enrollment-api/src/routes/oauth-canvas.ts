/**
 * Canvas OAuth Proxy — T-DR3-9 (marketplace Canvas schedule integration)
 *
 * POST /oauth/canvas/exchange — iOS calls this after ASWebAuthenticationSession
 *   completes. Exchanges the auth code for Canvas access + refresh tokens,
 *   encrypts them with AES-GCM (SNAP_FERNET_KEY as seed), and stores in
 *   snap_enrollment.canvas_connections. Returns { connected: true }.
 *
 * GET  /oauth/canvas/status  — returns current connection state for the
 *   authenticated applicant. Used by MarketplaceEntryCard to show
 *   "Canvas-connected" vs connect prompt.
 *
 * DELETE /oauth/canvas — revokes the stored Canvas tokens and marks the
 *   connection row as revoked. Used by Settings > Connections.
 *
 * The Canvas client secret never leaves this service. The iOS app only
 * sends the short-lived auth code; all token storage happens server-side.
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { HTTPException } from 'hono/http-exception';
import { makeAnonClient, makeServiceClient } from '../lib/supabase.js';
import type { Env } from '../types.js';

// ---------------------------------------------------------------------------
// AES-GCM helpers (Web Crypto — available in Cloudflare Workers)
// ---------------------------------------------------------------------------

async function deriveKey(rawSecret: string): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(rawSecret.slice(0, 32).padEnd(32, '0')),
    'AES-GCM',
    false,
    ['encrypt', 'decrypt'],
  );
  return keyMaterial;
}

async function encryptToken(secret: string, plaintext: string): Promise<string> {
  const key = await deriveKey(secret);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(plaintext),
  );
  const combined = new Uint8Array(iv.byteLength + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.byteLength);
  return btoa(String.fromCharCode(...combined));
}

async function decryptToken(secret: string, ciphertext: string): Promise<string> {
  const key = await deriveKey(secret);
  const combined = Uint8Array.from(atob(ciphertext), c => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const data = combined.slice(12);
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
  return new TextDecoder().decode(decrypted);
}

// ---------------------------------------------------------------------------
// Canvas token exchange helper
// ---------------------------------------------------------------------------

interface CanvasEnv {
  CANVAS_CLIENT_ID: string;
  CANVAS_CLIENT_SECRET: string;
  CANVAS_INSTANCE_URL: string;   // e.g. https://myschool.instructure.com
  CANVAS_REDIRECT_URI: string;
  SNAP_FERNET_KEY: string;
}

async function exchangeCanvasCode(
  env: CanvasEnv,
  code: string,
): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: env.CANVAS_CLIENT_ID,
    client_secret: env.CANVAS_CLIENT_SECRET,
    redirect_uri: env.CANVAS_REDIRECT_URI,
    code,
  });

  const res = await fetch(`${env.CANVAS_INSTANCE_URL}/login/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => '');
    throw new HTTPException(502, { message: `Canvas token exchange failed: ${res.status} ${err}` });
  }

  const json = await res.json() as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };

  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresIn: json.expires_in ?? 3600,
  };
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

const exchangeBodySchema = z.object({
  code: z.string().min(1),
  packet_id: z.string().uuid(),
});

const app = new Hono<{ Bindings: Env }>();

app.post('/exchange', zValidator('json', exchangeBodySchema), async (c) => {
  const actor = c.get('actor');
  const body = c.req.valid('json');
  const canvasEnv = c.env as unknown as CanvasEnv;

  if (!canvasEnv.CANVAS_CLIENT_ID || !canvasEnv.CANVAS_CLIENT_SECRET) {
    throw new HTTPException(503, { message: 'Canvas integration not configured' });
  }

  const { accessToken, refreshToken, expiresIn } = await exchangeCanvasCode(canvasEnv, body.code);

  const encryptedAccess = await encryptToken(canvasEnv.SNAP_FERNET_KEY, accessToken);
  const encryptedRefresh = await encryptToken(canvasEnv.SNAP_FERNET_KEY, refreshToken);
  const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

  const db = makeServiceClient(c.env);

  await db
    .schema('snap_enrollment')
    .from('canvas_connections' as never)
    .upsert({
      applicant_id: actor.id,
      packet_id: body.packet_id,
      access_token_enc: encryptedAccess,
      refresh_token_enc: encryptedRefresh,
      expires_at: expiresAt,
      canvas_instance_url: canvasEnv.CANVAS_INSTANCE_URL,
      revoked_at: null,
    }, { onConflict: 'applicant_id' });

  return c.json({ connected: true, expires_at: expiresAt }, 200);
});

app.get('/status', async (c) => {
  const actor = c.get('actor');
  const db = makeAnonClient(c.env, c.get('jwt'));

  const { data } = await db
    .schema('snap_enrollment')
    .from('canvas_connections' as never)
    .select('expires_at, revoked_at')
    .eq('applicant_id', actor.id)
    .is('revoked_at', null)
    .single() as unknown as { data: { expires_at: string; revoked_at: string | null } | null };

  if (!data) {
    return c.json({ connected: false });
  }

  const isExpired = new Date(data.expires_at) < new Date();
  return c.json({ connected: !isExpired, expires_at: data.expires_at });
});

app.delete('/', async (c) => {
  const actor = c.get('actor');
  const db = makeServiceClient(c.env);

  await db
    .schema('snap_enrollment')
    .from('canvas_connections' as never)
    .update({ revoked_at: new Date().toISOString() })
    .eq('applicant_id', actor.id)
    .is('revoked_at', null);

  return c.json({ connected: false });
});

export default app;
