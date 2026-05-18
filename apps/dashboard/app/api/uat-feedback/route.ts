import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClientFromCookies } from "../../../lib/supabase";

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createServerClientFromCookies(cookieStore);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { page_path?: unknown; message?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const page_path = typeof body.page_path === "string" ? body.page_path.slice(0, 500) : "";
  const message = typeof body.message === "string" ? body.message.trim() : "";

  if (!message) {
    return NextResponse.json({ error: "message is required" }, { status: 400 });
  }

  // uat_feedback is in public schema — use default schema (no .schema() call needed)
  const { error } = await (supabase as ReturnType<typeof createServerClientFromCookies>)
    .from("uat_feedback" as never)
    .insert({ navigator_email: user.email ?? "", page_path, message });

  if (error) {
    console.error("[uat-feedback]", error);
    return NextResponse.json({ error: "Failed to save feedback" }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
