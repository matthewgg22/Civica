import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { createServerClientFromCookies } from "../../../../lib/supabase";

const ALLOWED_ERROR_TYPES = new Set([
  "income_mismatch",
  "sua_overclaim",
  "address_invalid",
  "missing_doc",
  "heap_sua_conflict",
  "other",
]);

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createServerClientFromCookies(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json() as {
    packet_id?: string;
    error_found?: boolean;
    error_type?: string | null;
    notes?: string | null;
  };

  if (!body.packet_id || typeof body.error_found !== "boolean") {
    return NextResponse.json({ error: "packet_id and error_found are required" }, { status: 400 });
  }

  if (body.error_type && !ALLOWED_ERROR_TYPES.has(body.error_type)) {
    return NextResponse.json({ error: "Invalid error_type" }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await supabase.schema("snap_enrollment").from("qc_outcomes" as any)
    .insert({
      packet_id: body.packet_id,
      qc_sampled: true,
      error_found: body.error_found,
      error_type: body.error_found ? (body.error_type ?? null) : null,
      notes: body.notes ?? null,
    } as never)
    .select("qc_outcome_id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ qc_outcome_id: (data as { qc_outcome_id: string }).qc_outcome_id }, { status: 201 });
}
