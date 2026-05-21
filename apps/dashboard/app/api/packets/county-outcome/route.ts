import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { createServerClientFromCookies } from "../../../../lib/supabase";

const ALLOWED_OUTCOMES = new Set(["approved", "denied", "pending_decision"]);

export async function PATCH(req: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createServerClientFromCookies(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json() as {
    packet_id?: string;
    county_outcome?: string;
    county_decision_date?: string | null;
  };

  if (!body.packet_id || typeof body.county_outcome !== "string") {
    return NextResponse.json({ error: "packet_id and county_outcome are required" }, { status: 400 });
  }

  if (!ALLOWED_OUTCOMES.has(body.county_outcome)) {
    return NextResponse.json({ error: "county_outcome must be approved, denied, or pending_decision" }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.schema("snap_enrollment") as any).from("snap_packets")
    .update({
      county_outcome: body.county_outcome,
      county_decision_date: body.county_decision_date ?? new Date().toISOString(),
    })
    .eq("packet_id", body.packet_id)
    .is("deleted_at", null);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
