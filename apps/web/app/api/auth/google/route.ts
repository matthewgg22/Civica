// GET /api/auth/google — start the Google sign-in (PKCE, server-initiated).
//
// Mirrors the OTP path's principle: we never call Supabase from the browser
// (see ../otp/route.ts). The server client generates the PKCE challenge,
// persists the code verifier in an HttpOnly cookie via @supabase/ssr, and we
// 302 the browser to Google's consent screen. Google sends the user back to
// /auth/callback, which exchanges the code for a session.
//
// Phone OTP is intentionally not wired (it needs a paid SMS provider); Google
// reuses the OAuth provider already configured for the staff dashboard, at no
// per-message cost.

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "../../../../lib/supabase-server";

// Only allow same-origin relative paths as the post-login destination, so a
// crafted ?next=https://evil.example can't turn this into an open redirect.
function safeNext(raw: string | null): string {
  if (!raw) return "/apply";
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/apply";
  return raw;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const next = safeNext(url.searchParams.get("next"));
  const origin = url.origin;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
      // We perform the redirect ourselves so the verifier cookie set by the
      // SSR client is flushed onto this response first.
      skipBrowserRedirect: true,
    },
  });

  if (error || !data?.url) {
    return NextResponse.redirect(`${origin}/sign-in?error=oauth_init`);
  }
  return NextResponse.redirect(data.url);
}
