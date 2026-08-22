// Transactional mail — one sender, one place to change providers.
//
// There was no way to send an email from this codebase at all. Supabase sends
// the magic link, and that is auth's own plumbing, not something an application
// route can borrow to send someone their own document.
//
// PROVIDER-AGNOSTIC ON PURPOSE. The driver is chosen by environment, so the
// operator can point this at whatever the organisation already pays for
// without a code change, and so this file never becomes the reason a provider
// cannot be swapped.
//
// AND IT FAILS LOUDLY. An unconfigured mailer returns `not_configured` rather
// than resolving quietly, because a "we've sent it" that sent nothing is worse
// than an error: the person stops waiting for something that is never coming,
// and nothing anywhere records that it did not happen.

export type MailResult =
  | { ok: true; id: string | null }
  | { ok: false; reason: "not_configured" | "rejected" | "network"; detail?: string };

export interface MailMessage {
  to: string;
  subject: string;
  /** Plain text. Deliberately the only body format for now: this carries a
   *  working document someone may print or forward, and every client renders
   *  text identically. HTML can come when something needs it. */
  text: string;
}

/** Whether mail can be sent at all. Routes check this so they can say
 *  "not available" up front rather than after taking someone's address. */
export function mailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.DEMETER_MAIL_FROM);
}

export async function sendMail(msg: MailMessage): Promise<MailResult> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.DEMETER_MAIL_FROM;
  if (!key || !from) return { ok: false, reason: "not_configured" };

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to: [msg.to], subject: msg.subject, text: msg.text }),
    });
    if (!res.ok) {
      // The provider's own message, trimmed. It names the real cause —
      // unverified domain, invalid address, quota — and without it every
      // failure looks the same from the outside, which is the trap the save
      // path fell into.
      const detail = (await res.text().catch(() => "")).slice(0, 300);
      return { ok: false, reason: "rejected", detail: detail || `http_${res.status}` };
    }
    const body = (await res.json().catch(() => ({}))) as { id?: string };
    return { ok: true, id: body.id ?? null };
  } catch (err) {
    return {
      ok: false,
      reason: "network",
      detail: err instanceof Error ? err.message.slice(0, 200) : undefined,
    };
  }
}
