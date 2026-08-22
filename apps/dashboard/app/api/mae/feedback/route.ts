// POST /api/mae/feedback — caseworker feedback on a Mae answer.
//
// Staff-auth-gated (same gate as /api/mae). Captures thumbs up/down + an
// optional reason + note, PII-scrubbed, into snap_enrollment.mae_feedback. This
// is the human-in-the-loop signal: thumbs-down + "citation wrong" rows are the
// triage queue for new answer-eval regression cases.

import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { createServerClientFromCookies, createServiceClient } from "../../../../lib/supabase";
import { isStaff } from "../../../../lib/roleRouting";
import { redactPii } from "@civica/demeter-engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RATINGS = new Set(["up", "down"]);
const REASONS = new Set(["citation_wrong", "incorrect", "unclear", "other"]);
const MAX_NOTE = 2_000;
const MAX_SNAPSHOT = 8_000;

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createServerClientFromCookies(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (user.app_metadata as { role?: unknown } | null)?.role;
  if (!isStaff(role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: { rating?: unknown; reason?: unknown; note?: unknown; question?: unknown; answer?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const rating = typeof body.rating === "string" ? body.rating : "";
  if (!RATINGS.has(rating)) {
    return NextResponse.json({ error: "rating must be 'up' or 'down'" }, { status: 400 });
  }
  const reason = typeof body.reason === "string" && REASONS.has(body.reason) ? body.reason : null;
  const clip = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");

  // PII-scrub anything free-text before it persists.
  const note = clip(body.note, MAX_NOTE);
  const row = {
    staff_user_id: user.id,
    rating,
    reason,
    note: note ? redactPii(note).redacted : null,
    question_redacted: redactPii(clip(body.question, MAX_SNAPSHOT)).redacted || null,
    answer: clip(body.answer, MAX_SNAPSHOT) || null,
  };

  const { error } = await createServiceClient()
    .schema("snap_enrollment")
    .from("mae_feedback")
    .insert(row);
  if (error) {
    console.error("[mae-feedback]", error);
    return NextResponse.json({ error: "Failed to save feedback" }, { status: 500 });
  }
  return NextResponse.json({ ok: true }, { status: 201 });
}
