import { type NextRequest, NextResponse } from "next/server";
import createMiddleware from "next-intl/middleware";
import { createServerClient } from "@supabase/ssr";
import { routing } from "@/lib/i18n/routing";

const intlMiddleware = createMiddleware(routing);

const PUBLIC_PATHS = ["/sign-in", "/auth/callback"];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname.endsWith(p));
}

export async function proxy(request: NextRequest) {
  const intlResponse = intlMiddleware(request);
  const response = intlResponse ?? NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value, options } of cookiesToSet) {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          }
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Gate /[locale]/app/* behind auth
  const isAppRoute = pathname.includes("/app/");
  if (isAppRoute && !user && !isPublicPath(pathname)) {
    const locale = pathname.split("/")[1] ?? "en";
    return NextResponse.redirect(new URL(`/${locale}/sign-in`, request.url));
  }

  // Redirect authenticated users away from sign-in
  if (user && isPublicPath(pathname)) {
    const locale = pathname.split("/")[1] ?? "en";
    return NextResponse.redirect(new URL(`/${locale}/app/packet`, request.url));
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next|_vercel|.*\\..*).*)"],
};
