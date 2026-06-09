// GET /auth/callback — finish the OAuth sign-in.
//
// Google redirects here with ?code=… after consent. We exchange that code for
// a Supabase session (the @supabase/ssr client reads the PKCE verifier cookie
// set in /api/auth/google and writes the session cookies on the response),
// then send the user on to their original destination.
//
// Unlike the dashboard's callback, there is NO staff-role gate here: applicants
// are ordinary authenticated users with no app_metadata.role.

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "../../../lib/supabase-server";

function safeNext(raw: string | null): string {
  if (!raw) return "/apply";
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/apply";
  return raw;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = url.origin;
  const next = safeNext(url.searchParams.get("next"));
  const code = url.searchParams.get("code");

  // The provider can bounce back with an error (user cancelled, etc.).
  const providerError = url.searchParams.get("error");
  if (providerError || !code) {
    return NextResponse.redirect(`${origin}/sign-in?error=oauth_callback`);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(`${origin}/sign-in?error=oauth_exchange`);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
