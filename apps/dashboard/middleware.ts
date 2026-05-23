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

  const isLogin = path.startsWith("/login");

  if (!user) {
    if (isLogin) return supabaseResponse;
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Staff role gate: applicant JWTs from the iOS app share this Supabase project,
  // so authentication alone is not enough — require app_metadata.role ∈ STAFF_ROLES.
  // Mirrors apps/api/src/auth/staff.ts.
  const role = (user.app_metadata as { role?: unknown } | null)?.role;
  if (!isStaff(role)) {
    if (isLogin) return supabaseResponse;
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("error", "staff_only");
    return NextResponse.redirect(url);
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
