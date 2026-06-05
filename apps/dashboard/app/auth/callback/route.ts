// GET /auth/callback — PKCE code exchange for OAuth providers (Google, etc.).
// Supabase redirects here after the user approves the OAuth consent screen.
// The `code` param is exchanged for a session server-side so cookies are
// written before the browser lands on the destination page.
//
// Staff gate: app_metadata.role is still required — if the Google user has
// no role assigned, the middleware bounces them to /login?error=staff_only.
// Admin assigns roles via the Supabase dashboard or a future provisioning flow.

import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { createServerClientFromCookies } from "../../../lib/supabase";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/packets";
  const origin = request.nextUrl.origin;

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=auth_failed`);
  }

  const cookieStore = await cookies();
  const supabase = createServerClientFromCookies(cookieStore);
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(`${origin}/login?error=auth_failed`);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
