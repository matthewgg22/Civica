// The two auth actions the sign-in surfaces share.
//
// EXTRACTED because there are two of them now (2026-08-22): the standalone
// /sign-in route, and the modal the chat opens over itself. The MARKUP
// differs — the page's card is interleaved with the Civica apply-flow
// branch, the modal's is not — but the endpoint, the payload and the
// failure mapping must never diverge, so they live here rather than in
// two components that drift.
//
// The route answers identically whether or not an address is known, and so
// does this: the only outcomes distinguished are ones the person can act on.
// Anything else resolves "sent", because the alternative is telling someone
// their address does not exist on a benefits service.

/** OAuth needs a top-level redirect so the PKCE verifier cookie set by the
 *  server route rides along to Google — hence a plain href, never fetch. */
export function googleHref(next: string): string {
  return `/api/auth/google?next=${encodeURIComponent(next)}`;
}

export type MagicLinkOutcome = "sent" | "invalid_email" | "rate_limited" | "error";

export async function sendMagicLink(email: string, next: string): Promise<MagicLinkOutcome> {
  try {
    const res = await fetch("/api/auth/magic-link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, next }),
    });
    if (res.status === 400) return "invalid_email";
    if (res.status === 429) return "rate_limited";
    return "sent";
  } catch {
    return "error";
  }
}
