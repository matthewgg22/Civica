// Auth-gates the SNAP application routes. Uses @supabase/ssr so the
// middleware can refresh a stale access token before checking auth,
// eliminating the race condition in the former cookie-sniff approach.
//
// /apply is intentionally NOT gated: the wizard stores only to localStorage
// until submit. /documents and /status need a real session (post-submit data).

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PROTECTED_PREFIXES = ["/documents", "/status"];

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

  // Build an SSR client that can refresh the session and rewrite cookies.
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
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
    },
  );

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
  matcher: ["/documents/:path*", "/status/:path*"],
};
