// /api/demeter/conversations/[id] — rename or delete one saved conversation.
//
// Both operations are scoped by RLS, not by this code: the `.eq("id", …)` below
// says WHICH row, and the policies in migration 20260617 say WHOSE. A request
// for someone else's id matches zero rows and comes back 404 — the same answer
// as an id that does not exist, so this endpoint cannot be used to discover
// that a given conversation belongs to somebody.
//
// Delete is a hard delete. This is the one table on the surface that holds a
// person's own words verbatim, and "delete" has to mean deleted — a soft-delete
// flag would leave the transcript sitting in the table after they asked us to
// drop it.

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "../../../../../lib/supabase-server";
import { normalizeTitle } from "../../../../../lib/demeter-conversations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TABLE = "demeter_conversations";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "sign_in_required" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Body must be JSON" }, { status: 400 });
  }

  const title = normalizeTitle(body.title);
  if (!title) return NextResponse.json({ error: "Give it a name." }, { status: 400 });

  const { data, error } = await supabase
    .schema("snap_enrollment")
    .from(TABLE)
    .update({ title })
    .eq("id", id)
    .select("id, title, updated_at")
    .maybeSingle();

  if (error) {
    console.error("[demeter-conversations] rename failed:", error);
    return NextResponse.json({ error: "save_failed" }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ conversation: data });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "sign_in_required" }, { status: 401 });

  // select() after delete so a no-op is distinguishable from a real deletion —
  // PostgREST reports success either way otherwise, and a Delete button that
  // silently does nothing is worse than one that says it could not.
  const { data, error } = await supabase
    .schema("snap_enrollment")
    .from(TABLE)
    .delete()
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("[demeter-conversations] delete failed:", error);
    return NextResponse.json({ error: "delete_failed" }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
