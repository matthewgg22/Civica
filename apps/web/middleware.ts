// Auth-gates the SNAP application routes. Uses @supabase/ssr so the
// middleware can refresh a stale access token before checking auth,
// eliminating the race condition in the former cookie-sniff approach.
//
// Login-first: /apply requires a session, so an applicant signs in (phone-OTP,
// which creates the account on first verify) BEFORE starting the wizard. An
// unauthenticated visitor is redirected to /sign-in?next=/apply and lands back
// on the wizard after creating their account. /documents and /status likewise
// need a real session (post-submit data).

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PROTECTED_PREFIXES = ["/apply", "/documents", "/status"];

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const { pathname, searchParams } = request.nextUrl;

  // Demo mode: /status?demo=1 is public for product demos without a login.
  if (pathname === "/status" && searchParams.get("demo") === "1") {
    return supabaseResponse;
  }

  const needsAuth = PROTECTED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
  if (!needsAuth) return supabaseResponse;

  // Supabase config ships via NEXT_PUBLIC_* (build-inlined). If it's ever
  // absent at runtime — e.g. the var was marked "Sensitive" in Vercel and so
  // never got inlined into the build — createServerClient() throws and EVERY
  // protected route returns 500, taking the whole applicant funnel down
  // (/apply, /documents, /status). Fail closed instead: we can't verify a
  // session without config, so route the visitor to /sign-in rather than
  // crashing, and surface the misconfiguration to the server log / Sentry.
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error(
      "[middleware] Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY — " +
        "cannot verify session; redirecting protected route to /sign-in. " +
        "Check these are set as NON-sensitive env vars in Vercel.",
    );
    const url = request.nextUrl.clone();
    url.pathname = "/sign-in";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // Build an SSR client that can refresh the session and rewrite cookies.
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );
      },
    },
  });

  // getSession() reuses the cached session; if the access token is stale the
  // SDK refreshes it automatically and rewrites the cookies via setAll above.
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    const url = request.nextUrl.clone();
    url.pathname = "/sign-in";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: ["/apply/:path*", "/apply", "/documents/:path*", "/status/:path*"],
};
