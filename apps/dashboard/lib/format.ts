export function formatDateTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).replace(",", " at");
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const days = Math.floor(hr / 24);
  if (days < 7) return `${days}d ago`;
  return formatDate(dateStr);
}

// Demo-only decryptor: real Fernet ciphertext is `snap_v1::<token>`, demo is
// `snap_v1::DEMO:NAME`. Real decrypt must go through the Python backend so the
// pii_field_decrypted audit event is recorded — see ALLOW_REAL_CIPHERTEXT below.
//
// In prod we refuse to render real ciphertext (would leak as "[encrypted]"
// silently, which is worse than failing loudly). UAT/staging can opt in with
// NEXT_PUBLIC_ALLOW_REAL_CIPHERTEXT=1 to render a redacted placeholder while
// the real decrypt path is being wired up.
const ALLOW_REAL_CIPHERTEXT = process.env.NEXT_PUBLIC_ALLOW_REAL_CIPHERTEXT === "1";
const IS_PROD = process.env.NODE_ENV === "production";

export function decryptDemoName(ciphertext: string | null): string {
  if (!ciphertext) return "Unknown";
  const demo = ciphertext.match(/^snap_v1::DEMO:(.+)$/);
  if (demo?.[1]) return demo[1];
  if (ciphertext.startsWith("snap_v1::")) {
    if (IS_PROD && !ALLOW_REAL_CIPHERTEXT) {
      throw new Error(
        "decryptDemoName received real Fernet ciphertext in production. " +
          "Real decrypt must route through the backend audit path. " +
          "Set NEXT_PUBLIC_ALLOW_REAL_CIPHERTEXT=1 only in non-prod environments."
      );
    }
    return "[redacted]";
  }
  return "[encrypted]";
}

export function firstNameLastInitial(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length < 2) return name;
  return `${parts[0]} ${parts[parts.length - 1]?.[0]}.`;
}

// Short identifier for display. We use the LAST 6 chars because UUIDv7 packs
// timestamp into the leading bits — packets created seconds apart share long
// prefixes, making first-N slicing useless for distinguishing them.
export function shortId(uuid: string): string {
  return uuid.replace(/-/g, "").slice(-6).toUpperCase();
}
