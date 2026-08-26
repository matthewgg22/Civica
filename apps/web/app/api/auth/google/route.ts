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

  // NEVER THROW OUT OF THIS ROUTE. createSupabaseServerClient() throws when the
  // Supabase env is missing, and an uncaught throw here is a 500 with an EMPTY
  // BODY — the reader taps "Continue with Google" and gets a blank page, which
  // is the worst failure this flow has. Observed on a preview deployment, which
  // does not carry the env; production does, so it never surfaced there.
  //
  // Any failure now lands on the sign-in page with an error it can explain.
  let data: { url?: string | null } | null = null;
  let error: unknown = null;
  try {
    const supabase = await createSupabaseServerClient();
    ({ data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
        // We perform the redirect ourselves so the verifier cookie set by the
        // SSR client is flushed onto this response first.
        skipBrowserRedirect: true,
      },
    }));

  } catch (err) {
    console.error("[auth] google sign-in could not start:", err);
    return NextResponse.redirect(`${origin}/sign-in?error=oauth_init`);
  }

  if (error || !data?.url) {
    return NextResponse.redirect(`${origin}/sign-in?error=oauth_init`);
  }
  return NextResponse.redirect(data.url);
}
