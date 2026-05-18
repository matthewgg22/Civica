import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { createServerClientFromCookies } from "../../../lib/supabase";

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createServerClientFromCookies(cookieStore);
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/login", request.url));
}
