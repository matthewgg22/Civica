import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { homeForRole, isPathAllowedForRole, isPubliclyAccessible, isStaff } from "./lib/roleRouting";

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });
  const path = request.nextUrl.pathname;

  // Fully public routes — no Supabase round-trip, no auth needed. Used for
  // share-out artifacts (compliance briefs, county B2G demo, CBO preview)
  // that get shared via outreach to recipients without a Civica account.
  // Resolved before any auth lookup so an unauthenticated visitor lands
  // on the page instead of being bounced to /login. Canonical list lives
  // in lib/roleRouting.ts so the middleware and per-route guards can't
  // drift.
  if (isPubliclyAccessible(path)) {
    return supabaseResponse;
  }

  // Mae public-preview mode: let /api/mae reach its own (preview-aware) gate
  // instead of being redirected to /login, so the anonymous CBO-preview chat
  // works. Off by default; the route still enforces staff/preview + PII rules.
  if (process.env.NEXT_PUBLIC_MAE_PREVIEW === "true" && path.startsWith("/api/mae")) {
    return supabaseResponse;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  // Routes accessible without an account: sign-in, account creation, and auth
  // callbacks (password reset email links land on /auth/reset-password with ?code=).
  const isUnauthenticatedAllowed =
    path.startsWith("/login") ||
    path.startsWith("/sign-up") ||
    path.startsWith("/auth/");

  if (!user) {
    if (isUnauthenticatedAllowed) return supabaseResponse;
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Staff role gate: applicant JWTs from the iOS app share this Supabase project,
  // so authentication alone is not enough — require app_metadata.role ∈ STAFF_ROLES.
  // Mirrors apps/api/src/auth/staff.ts.
  const role = (user.app_metadata as { role?: unknown } | null)?.role;
  if (!isStaff(role)) {
    if (isUnauthenticatedAllowed) return supabaseResponse;
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("error", "staff_only");
    return NextResponse.redirect(url);
  }

  // MFA gate: if the user has TOTP enrolled (nextLevel=aal2) but hasn't
  // verified this session (currentLevel=aal1), redirect to the verify page.
  //
  // The gate must NOT fire on /auth/* (the verify + setup pages, sign-out,
  // password-reset callback) or it would redirect /auth/mfa/verify back to
  // itself — an infinite loop that bricks every enrolled login. It also skips
  // /api/* so in-app fetch() calls get a clean 401/redirect from the route
  // itself rather than an HTML page that breaks res.json().
  const mfaGateApplies = !path.startsWith("/auth/") && !path.startsWith("/api/");
  if (mfaGateApplies) {
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal && aal.nextLevel === "aal2" && aal.currentLevel !== "aal2") {
      const url = request.nextUrl.clone();
      url.pathname = "/auth/mfa/verify";
      return NextResponse.redirect(url);
    }
  }

  // T5: audience-role routing. Restricted roles (state_deputy /
  // county_director / cbo_preview) can only access their assigned route;
  // root requests redirect to that role's home. Operational roles
  // (navigator / supervisor / admin) have full access and a default home
  // of /packets.
  if (path === "/") {
    const url = request.nextUrl.clone();
    url.pathname = homeForRole(role);
    return NextResponse.redirect(url);
  }

  if (!isPathAllowedForRole(path, role)) {
    const url = request.nextUrl.clone();
    url.pathname = homeForRole(role);
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    // Skip Next internals, favicon, and any file in /public with an extension
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|gif|webp|ico|woff|woff2|ttf|otf)).*)",
  ],
};
