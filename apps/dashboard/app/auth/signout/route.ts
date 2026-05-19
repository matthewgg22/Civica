import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { createServerClientFromCookies } from "../../../lib/supabase";

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createServerClientFromCookies(cookieStore);
  await supabase.auth.signOut();
  // 303 See Other: browser follows with GET rather than repeating the POST.
  // NextResponse.redirect defaults to 307, which would POST to /login.
  return NextResponse.redirect(new URL("/login", request.url), 303);
}
