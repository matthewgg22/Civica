// /api/demeter/conversations — list and save the signed-in user's conversations.
//
// The chat itself is free and anonymous and stays that way; an account buys one
// thing, which is coming back to a conversation you already had. So this is the
// only part of the Demeter surface that requires a session, and a 401 from here
// is never a dead end — the client turns it into an invitation to sign in with
// the transcript held safely in sessionStorage.
//
// USES THE USER-SCOPED CLIENT, NOT THE SERVICE KEY. Every other Demeter route
// reaches Supabase as service_role and enforces access itself, because its
// subjects are anonymous or guest and there is no auth.uid() for a policy to
// key on. Here there is, so RLS (migration 20260617) does the enforcing and
// this code cannot leak someone else's conversation even if it tries: the
// filters below are for correct BEHAVIOUR, and the database is what makes them
// SAFE. That is why `user_id` is still written explicitly on insert — the
// WITH CHECK policy rejects the row outright if it disagrees with auth.uid().

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "../../../../lib/supabase-server";
import {
  deriveTitle,
  normalizeLang,
  normalizeMessages,
  normalizeStateCode,
  normalizeTitle,
  normalizeWorksheet,
  MAX_CONVERSATIONS,
} from "../../../../lib/demeter-conversations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TABLE = "demeter_conversations";

/** Row shape the client list renders. `messages` is deliberately absent — the
 *  list needs titles, not transcripts, and shipping every transcript to render
 *  a list is the kind of thing that is fine at 3 rows and awful at 50. */
const LIST_COLUMNS = "id, title, state_code, lang, created_at, updated_at";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "sign_in_required" }, { status: 401 });

  const { data, error } = await supabase
    .schema("snap_enrollment")
    .from(TABLE)
    .select(LIST_COLUMNS)
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("[demeter-conversations] list failed:", error);
    return NextResponse.json({ error: "load_failed" }, { status: 500 });
  }
  return NextResponse.json({ conversations: data ?? [] });
}

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  // getUser() and not getSession(): this decides whether a row gets written, so
  // the token is revalidated against the auth server rather than trusted from
  // the cookie. RLS would still refuse a forged one, but a 401 here is a much
  // clearer failure than an empty result set.
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "sign_in_required" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Body must be JSON" }, { status: 400 });
  }

  const normalized = normalizeMessages(body.messages);
  if ("error" in normalized) {
    return NextResponse.json({ error: normalized.error }, { status: 400 });
  }
  const { messages } = normalized;

  const row = {
    title: normalizeTitle(body.title) ?? deriveTitle(messages),
    messages,
    state_code: normalizeStateCode(body.state),
    lang: normalizeLang(body.lang),
    // The drafted application (#905). Null for ask-mode chats, for clients
    // older than this feature, and for anything malformed — never a 400: the
    // worksheet is rebuildable from the transcript, the transcript is not.
    worksheet: normalizeWorksheet(body.worksheet),
  };

  /** Migrations apply by hand (dashboard SQL paste), so this code WILL run
   *  against a prod database that does not have the worksheet column yet.
   *  PostgREST reports that as a missing-column error; retrying once without
   *  the field keeps saves working through the window. Anything else is a
   *  real failure and is not retried. */
  const isMissingWorksheetColumn = (error: { code?: string; message?: string }) =>
    error.code === "PGRST204" && /worksheet/.test(error.message ?? "");
  const rowWithoutWorksheet = () => {
    const rest: Record<string, unknown> = { ...row };
    delete rest.worksheet;
    return rest;
  };

  // An id means "this conversation, kept up to date" — the chat re-posts after
  // each new answer once saved, so resume shows the whole thing and not the
  // prefix that existed at the moment they pressed the button.
  const id = typeof body.id === "string" ? body.id : null;
  if (id) {
    const doUpdate = (payload: Record<string, unknown>) =>
      supabase
        .schema("snap_enrollment")
        .from(TABLE)
        .update(payload)
        .eq("id", id)
        .select("id, title, updated_at")
        .maybeSingle();

    let { data, error } = await doUpdate(row);
    if (error && isMissingWorksheetColumn(error)) {
      console.warn(
        "[demeter-conversations] worksheet column missing — paste migration 20260821; saving without it",
      );
      ({ data, error } = await doUpdate(rowWithoutWorksheet()));
    }

    if (error) {
      console.error("[demeter-conversations] update failed:", error);
      return NextResponse.json({ error: "save_failed" }, { status: 500 });
    }
    // No row came back: either it does not exist or it is someone else's, and
    // RLS makes those indistinguishable from here. 404 for both, deliberately —
    // telling the difference would confirm the existence of another user's row.
    if (!data) return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json({ conversation: data });
  }

  // head:true fetches the count without the rows.
  const { count, error: countError } = await supabase
    .schema("snap_enrollment")
    .from(TABLE)
    .select("id", { count: "exact", head: true });

  if (countError) {
    console.error("[demeter-conversations] count failed:", countError);
    return NextResponse.json({ error: "save_failed" }, { status: 500 });
  }
  if ((count ?? 0) >= MAX_CONVERSATIONS) {
    return NextResponse.json(
      { error: "limit_reached", limit: MAX_CONVERSATIONS },
      { status: 409 },
    );
  }

  // user_id is written explicitly rather than defaulted in the DDL: a column
  // DEFAULT auth.uid() would be silently wrong for any service-role write,
  // and the INSERT policy's WITH CHECK rejects this row anyway if it does not
  // match the caller. Belt and braces on the one write that establishes
  // ownership for the life of the row.
  const doInsert = (payload: Record<string, unknown>) =>
    supabase
      .schema("snap_enrollment")
      .from(TABLE)
      .insert({ ...payload, user_id: user.id })
      .select("id, title, updated_at")
      .single();

  let { data, error } = await doInsert(row);
  if (error && isMissingWorksheetColumn(error)) {
    console.warn(
      "[demeter-conversations] worksheet column missing — paste migration 20260821; saving without it",
    );
    ({ data, error } = await doInsert(rowWithoutWorksheet()));
  }

  if (error) {
    console.error("[demeter-conversations] insert failed:", error);
    return NextResponse.json({ error: "save_failed" }, { status: 500 });
  }
  return NextResponse.json({ conversation: data }, { status: 201 });
}
