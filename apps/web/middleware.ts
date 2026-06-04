// Auth-gates the SNAP application routes: /apply, /documents, /status.
// Redirects to /sign-in when the access-token cookie is missing.
// The /api/auth/* routes are intentionally NOT gated — sign-in itself.

import { NextResponse, type NextRequest } from "next/server";
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from "./lib/cookie-keys";

// /apply is NOT gated: the wizard persists to localStorage only (no server
// PII until submit), mirroring iOS "save anytime, no commitment to submit."
// Sign-in is required at submit time (createPacket), not to start. /documents
// and /status need a real session (post-submit data), so they stay gated.
const PROTECTED_PREFIXES = ["/documents", "/status"];

export function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  // Demo mode (?demo=1) is public on /status — lets the applicant dashboard
  // be product-demo-able without a phone-OTP login. The page renders sample
  // data and never touches the gateway in this mode.
  if (pathname === "/status" && searchParams.get("demo") === "1") {
    return NextResponse.next();
  }

  const needsAuth = PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  if (!needsAuth) return NextResponse.next();

  const hasAccess = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  const hasRefresh = request.cookies.get(REFRESH_TOKEN_COOKIE)?.value;
  if (hasAccess || hasRefresh) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = "/sign-in";
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/documents/:path*", "/status/:path*"],
};
