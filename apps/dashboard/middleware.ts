import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

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

  const isLogin = request.nextUrl.pathname.startsWith("/login");

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
  const isStaff = typeof role === "string" && STAFF_ROLES.has(role);

  if (!isStaff && !isLogin) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("error", "staff_only");
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

const STAFF_ROLES = new Set(["navigator", "supervisor", "admin"]);

export const config = {
  matcher: [
    // Skip Next internals, favicon, and any file in /public with an extension
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|gif|webp|ico|woff|woff2|ttf|otf)).*)",
  ],
};
