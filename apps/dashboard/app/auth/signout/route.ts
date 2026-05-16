import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClientFromCookies } from "../../../lib/supabase";

export async function POST() {
  const cookieStore = await cookies();
  const supabase = createServerClientFromCookies(cookieStore);
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/login", process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://localhost:3000"));
}
