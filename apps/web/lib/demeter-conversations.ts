// Shape rules for a SAVED public-chat conversation (launch criterion #6).
//
// Pure — no Next, no Supabase, no request context — so the routes, the pages
// and the tests all agree on what a valid saved conversation is, and so the
// rules can be unit-tested without standing anything up.
//
// PRIVACY POSTURE, decided 2026-08-11 and deliberately DIFFERENT from the rest
// of this schema: a user's own messages are stored VERBATIM, not redactPii'd.
// mae_query_log and mae_feedback redact because WE are recording someone's
// words for OUR purposes (audit, triage) and they never asked us to. This is a
// person choosing to keep their own conversation, and handing it back as
// "my rent is $[REDACTED]" reads as a bug, not as care. The protections here
// are that only they can read it (RLS, migration 20260617) and that they can
// delete it. The save panel says so plainly.

import { isAnswerLang, VERIFIED_STATE_CODES, type AnswerLang } from "@civica/demeter-engine/packs";

/** The chat's own Msg shape, so resume is a straight hydrate. */
export type SavedMsg = {
  role: "user" | "assistant" | "divider";
  content: string;
};

const ROLES = new Set(["user", "assistant", "divider"]);

/** Matches the jsonb_array_length CHECK in migration 20260617. Enforced here
 *  too so an over-long payload is TRIMMED to the most recent turns rather than
 *  rejected — losing the oldest turns beats losing the save. */
export const MAX_MESSAGES = 200;

/** Byte budget for the transcript. The DB cannot express this (octet_length on
 *  a cast is not immutable enough for a CHECK), so it is enforced here — the
 *  one rule in this file that has no database backstop. Sized well above a long
 *  real conversation: the chat only ever sends the last 20 turns to the engine. */
export const MAX_BYTES = 256_000;

/** Saved conversations per user. A soft cap, counted then inserted, so a race
 *  can land 51 — which is harmless. It exists to bound storage for an
 *  authenticated account, not to ration anything a real person would hit. */
export const MAX_CONVERSATIONS = 50;

/** Matches the char_length CHECK in migration 20260617. */
export const TITLE_MAX = 160;

/** Where a derived title gets cut before the ellipsis. Shorter than TITLE_MAX:
 *  the list is scannable only if the titles are one line. */
const TITLE_TARGET = 72;

function byteLength(value: unknown): number {
  return new TextEncoder().encode(JSON.stringify(value)).length;
}

/**
 * Validate and bound an incoming transcript.
 *
 * Returns the messages to store, or an error string for a 400. Trimming is
 * preferred to rejection everywhere it is safe: someone pressing Save should
 * not be told no because their conversation ran long.
 */
export function normalizeMessages(raw: unknown): { messages: SavedMsg[] } | { error: string } {
  if (!Array.isArray(raw)) return { error: "messages must be an array" };

  const clean: SavedMsg[] = [];
  for (const entry of raw) {
    if (typeof entry !== "object" || entry === null) {
      return { error: "each message must be an object" };
    }
    const { role, content } = entry as { role?: unknown; content?: unknown };
    if (typeof role !== "string" || !ROLES.has(role)) {
      return { error: "each message needs role user|assistant|divider" };
    }
    if (typeof content !== "string") return { error: "each message needs string content" };
    // The chat appends an EMPTY assistant bubble as a streaming placeholder and
    // fills it chunk by chunk. Saving one would resume into a blank answer that
    // never completes. The UI only offers Save after an answer finishes, so this
    // is belt and braces — but it is the exact shape a mid-stream save produces.
    if (role === "assistant" && content === "") continue;
    clean.push({ role: role as SavedMsg["role"], content });
  }

  if (clean.length === 0) return { error: "nothing to save yet" };

  // Newest turns are the ones worth keeping: resume is about continuing, and
  // the engine only ever sees the last 20 turns anyway.
  let bounded = clean.slice(-MAX_MESSAGES);
  while (bounded.length > 1 && byteLength(bounded) > MAX_BYTES) {
    bounded = bounded.slice(1);
  }
  // A single turn can exceed the budget on its own; nothing left to drop.
  if (byteLength(bounded) > MAX_BYTES) return { error: "conversation is too large to save" };

  return { messages: bounded };
}

/**
 * A title from the first thing they asked — never typed by the user.
 *
 * Asking someone to name a conversation before they can keep it is a form to
 * fill in, and this whole surface exists for people who will not fill in a
 * form. Rename stays available afterwards.
 */
export function deriveTitle(messages: SavedMsg[], fallback = "Saved conversation"): string {
  const first = messages.find((m) => m.role === "user" && m.content.trim() !== "");
  const flat = (first?.content ?? "").replace(/\s+/g, " ").trim();
  if (!flat) return fallback;
  if (flat.length <= TITLE_TARGET) return flat.slice(0, TITLE_MAX);

  // Cut on a word boundary when there is one reasonably close to the target,
  // so a title ends "…income limit for my" rather than "…income limit for m".
  const cut = flat.slice(0, TITLE_TARGET);
  const lastSpace = cut.lastIndexOf(" ");
  const stem = lastSpace > TITLE_TARGET * 0.6 ? cut.slice(0, lastSpace) : cut;
  return `${stem.trimEnd()}…`.slice(0, TITLE_MAX);
}

/** A user-supplied title (rename only). Empty or absent means "derive it". */
export function normalizeTitle(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const flat = raw.replace(/\s+/g, " ").trim();
  return flat === "" ? null : flat.slice(0, TITLE_MAX);
}

/** null = the federal floor, exactly as the picker means it. An unverified or
 *  malformed code degrades to the federal floor rather than 400-ing: the scope
 *  is a property of the answers already given, and refusing the save over it
 *  would be punishing the wrong thing. */
export function normalizeStateCode(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const upper = raw.toUpperCase();
  return VERIFIED_STATE_CODES.includes(upper) ? upper : null;
}

export function normalizeLang(raw: unknown): AnswerLang {
  return typeof raw === "string" && isAnswerLang(raw) ? raw : "en";
}
