// GET /auth/callback — finish the sign-in (Google OAuth and email magic link).
//
// Both providers land here with ?code=…; we exchange it for a Supabase session
// (the @supabase/ssr client reads the PKCE verifier cookie set by the route
// that started the flow and writes the session cookies on the response), then
// send the user to their original destination.
//
// Unlike the dashboard's callback, there is NO staff-role gate here: applicants
// are ordinary authenticated users with no app_metadata.role.
//
// DESTINATION comes from the cookie first, ?next= second. The cookie exists
// because encoding the destination in this URL made it miss Supabase's
// Redirect URL allow list, which fell back to the project Site URL — the staff
// dashboard — and dropped applicants into software they cannot use (see
// lib/auth-next.ts). The query param is still honoured so the Google route,
// which never had that problem, keeps working unchanged.

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createSupabaseServerClient } from "../../../lib/supabase-server";
import { AUTH_NEXT_COOKIE, DEFAULT_NEXT, safeNext, takeAuthNext } from "../../../lib/auth-next";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = url.origin;
  const jar = await cookies();
  const stashed = jar.get(AUTH_NEXT_COOKIE)?.value;

  // Cookie wins; ?next= is the fallback for the OAuth path. Both are clamped
  // to same-origin paths — this value survives a round trip through the user's
  // inbox, so an open redirect here would be a phishing primitive.
  const fromQuery = url.searchParams.get("next");
  const destination = stashed ? safeNext(stashed) : fromQuery ? safeNext(fromQuery) : DEFAULT_NEXT;

  const code = url.searchParams.get("code");
  const providerError = url.searchParams.get("error");
  if (providerError || !code) {
    const res = NextResponse.redirect(`${origin}/sign-in?error=oauth_callback`);
    takeAuthNext(res, stashed);
    return res;
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    const res = NextResponse.redirect(`${origin}/sign-in?error=oauth_exchange`);
    takeAuthNext(res, stashed);
    return res;
  }

  const res = NextResponse.redirect(`${origin}${destination}`);
  // Cleared on every path, success or failure — a stashed destination must
  // never be able to steer a later, unrelated sign-in.
  takeAuthNext(res, stashed);
  return res;
}
