// Where to send someone after they finish signing in.
//
// WHY THIS IS A COOKIE AND NOT A QUERY PARAM.
//
// The magic-link flow used to encode the destination in the redirect itself:
//
//   emailRedirectTo = https://…/auth/callback?next=%2Fscreen%2Fask
//
// Supabase matches that WHOLE URL against the project's Redirect URL allow
// list. An entry of ".../auth/callback" does not cover a URL carrying a query
// string, so the match failed, Supabase fell back to the project's Site URL —
// which pointed at the STAFF DASHBOARD — and an applicant signing in to save
// their SNAP conversation landed in staff software and was bounced to
// /login?error=staff_only. Observed in production 2026-08-11.
//
// A wildcard allow-list entry fixes that instance. It does not fix the class:
// sign-in would still depend on dashboard configuration matching a URL shape
// this code chooses, with nothing in the repo to catch a mismatch, and the
// failure lands on the user rather than on us.
//
// Keeping the destination in a short-lived cookie makes the redirect URL a
// constant — an EXACT allow-list match — so no allow-list edit can silently
// break sign-in again.
//
// KNOWN TRADE-OFF, accepted deliberately: a cookie is per-browser, so opening
// the email on a different device drops the destination and the user lands on
// the default. That costs a nicety (which page you land on). The query-param
// version survives that, at the price of a config dependency that already
// dumped real users into the wrong application. Landing on the chat instead of
// the chat-with-a-question-prefilled is a far smaller harm than landing in a
// staff dashboard you have no access to.

import type { NextResponse } from "next/server";

export const AUTH_NEXT_COOKIE = "demeter_auth_next";

/** Fallback destination. The public chat, not /apply — the account exists to
 *  save a conversation, so the conversation is where you belong. */
export const DEFAULT_NEXT = "/screen/ask";

/**
 * Same-origin relative paths only.
 *
 * This value round-trips through the user's inbox, so an open redirect here is
 * a phishing primitive: a genuine Demeter sign-in email that lands the reader
 * on someone else's site. Rejects absolute URLs, protocol-relative "//evil",
 * and anything not starting with a single slash.
 */
export function safeNext(raw: unknown): string {
  if (typeof raw !== "string") return DEFAULT_NEXT;
  const v = raw.trim();
  if (!v.startsWith("/") || v.startsWith("//") || v.startsWith("/\\")) return DEFAULT_NEXT;
  return v;
}

/** Stash the destination for the callback to read. */
export function setAuthNext(res: NextResponse, next: string): void {
  res.cookies.set(AUTH_NEXT_COOKIE, safeNext(next), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    // Lax, not Strict: clicking a link in an email is a top-level GET
    // navigation from another origin, and Strict would withhold the cookie on
    // exactly the request this exists to serve.
    sameSite: "lax",
    path: "/",
    // Long enough for a trip through an inbox, short enough that a stale
    // destination cannot redirect a later, unrelated sign-in.
    maxAge: 30 * 60,
  });
}

/** Read and clear it. Cleared unconditionally so one stashed destination can
 *  never steer a second sign-in. */
export function takeAuthNext(res: NextResponse, cookieValue: string | undefined): string {
  res.cookies.set(AUTH_NEXT_COOKIE, "", { path: "/", maxAge: 0 });
  return safeNext(cookieValue);
}
