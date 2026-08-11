// Server-side reads for saved conversations.
//
// Split from ./demeter-conversations (the pure shape rules) because this file
// reaches for next/headers via the SSR Supabase client, and the shape rules
// have to stay importable from anywhere — tests, client code, the routes.
//
// Reads go through the USER-SCOPED client, so RLS (migration 20260617) is what
// decides what comes back. A caller asking for someone else's conversation gets
// null, and gets exactly the same null for an id that never existed.

import { createSupabaseServerClient } from "./supabase-server";
import type { SavedMsg } from "./demeter-conversations";

export type SavedConversation = {
  id: string;
  title: string;
  messages: SavedMsg[];
  state_code: string | null;
  lang: string;
  created_at: string;
  updated_at: string;
};

export type ConversationSummary = Omit<SavedConversation, "messages">;

/** One conversation, for resuming it. null when there is no session, no such
 *  row, or the row is someone else's — the three are deliberately the same
 *  answer to the caller. */
export async function loadConversation(id: string): Promise<SavedConversation | null> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .schema("snap_enrollment")
    .from("demeter_conversations")
    .select("id, title, messages, state_code, lang, created_at, updated_at")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    // A failed read must not take the chat page down with it — the page still
    // renders a working, empty chat, which is the whole product.
    console.error("[demeter-conversations] load failed:", error);
    return null;
  }
  return (data as SavedConversation | null) ?? null;
}

/** The signed-in user's conversations, newest activity first. Transcripts are
 *  not selected: the list renders titles, and shipping 50 transcripts to draw
 *  50 rows is the kind of thing that is fine in testing and awful in use. */
export async function listConversations(): Promise<ConversationSummary[] | null> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .schema("snap_enrollment")
    .from("demeter_conversations")
    .select("id, title, state_code, lang, created_at, updated_at")
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("[demeter-conversations] list failed:", error);
    return [];
  }
  return (data as ConversationSummary[] | null) ?? [];
}
