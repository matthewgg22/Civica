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

/** EMAIL SIGN-IN IS OFF UNTIL SMTP IS WIRED (#699, owner decision 2026-08-29).
 *
 *  The magic-link route works, but the project has no transactional mail
 *  provider configured, so every send silently fails — a person who picks
 *  "Email me a sign-in link" gets nothing, which reads as a broken product.
 *  Rather than ship that button live, both sign-in surfaces hide the email
 *  half and offer Google only, which is verified working end-to-end.
 *
 *  Google is not a wall: the chat is free and anonymous, and an account only
 *  buys save/resume. Someone without a Google account loses saving, not the
 *  product.
 *
 *  REVERSING THIS IS ONE LINE. Wire SMTP (a verified sending domain on
 *  Resend, or Gmail SMTP as a throwaway), paste the templates in
 *  supabase/templates/ into the dashboard, flip this to true, redeploy. The
 *  email markup on both surfaces is intact behind the flag, not deleted. */
export const EMAIL_SIGNIN_ENABLED = false;

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
