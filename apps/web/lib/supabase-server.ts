import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { publicEnv } from "./env";

// Session cookies. We split access + refresh so that route handlers can
// refresh without exposing the refresh token to anything that reads
// `access_token`. Names match nothing public; if Supabase later ships a
// recommended convention we can rename.
export const ACCESS_TOKEN_COOKIE = "civica.access_token";
export const REFRESH_TOKEN_COOKIE = "civica.refresh_token";
export const USER_ID_COOKIE = "civica.user_id";

const SECURE_COOKIE_BASE = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};

export type SessionRecord = {
  accessToken: string;
  refreshToken: string;
  userId: string;
  expiresInSeconds: number;
};

// Set session cookies after a successful OTP verify. Called from the
// /api/auth/verify route handler.
export async function persistSession(session: SessionRecord) {
  const jar = await cookies();
  // Access token lifetime is short (default 1h). We let Supabase decide
  // expiry; the cookie expires when the refresh path detects an invalid
  // access token, fetches a new one, and rewrites both cookies.
  jar.set(ACCESS_TOKEN_COOKIE, session.accessToken, {
    ...SECURE_COOKIE_BASE,
    maxAge: session.expiresInSeconds,
  });
  jar.set(REFRESH_TOKEN_COOKIE, session.refreshToken, {
    ...SECURE_COOKIE_BASE,
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
  jar.set(USER_ID_COOKIE, session.userId, {
    ...SECURE_COOKIE_BASE,
    httpOnly: false, // userId is non-secret; expose to client so the UI knows it's signed in
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearSession() {
  const jar = await cookies();
  jar.delete(ACCESS_TOKEN_COOKIE);
  jar.delete(REFRESH_TOKEN_COOKIE);
  jar.delete(USER_ID_COOKIE);
}

// Returns the access token from the cookie jar. Auto-refreshes if the
// stored token is rejected by Supabase. Returns null when there's no
// valid session at all.
export async function currentAccessToken(): Promise<string | null> {
  const jar = await cookies();
  const access = jar.get(ACCESS_TOKEN_COOKIE)?.value;
  if (access) return access;

  // No access token but maybe a refresh token — try to refresh.
  const refresh = jar.get(REFRESH_TOKEN_COOKIE)?.value;
  if (!refresh) return null;

  const refreshed = await refreshWithToken(refresh);
  if (!refreshed) return null;
  await persistSession(refreshed);
  return refreshed.accessToken;
}

export async function currentUserId(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(USER_ID_COOKIE)?.value ?? null;
}

async function refreshWithToken(refreshToken: string): Promise<SessionRecord | null> {
  const { supabaseUrl, supabaseAnonKey } = publicEnv();
  const res = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: supabaseAnonKey,
    },
    body: JSON.stringify({ refresh_token: refreshToken }),
    cache: "no-store",
  });
  if (!res.ok) return null;
  const body = (await res.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    user: { id: string };
  };
  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token,
    userId: body.user.id,
    expiresInSeconds: body.expires_in,
  };
}

// Service-role admin client — server-only, used by the existing lead-capture
// route. Kept here so future server routes have one source.
export function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "Missing Supabase admin config: set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    );
  }
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
