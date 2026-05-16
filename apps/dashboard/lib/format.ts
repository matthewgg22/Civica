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

// Decrypt placeholder: real Fernet ciphertext is `snap_v1::...`, demo is `snap_v1::DEMO:NAME`
export function decryptDemoName(ciphertext: string | null): string {
  if (!ciphertext) return "Unknown";
  const m = ciphertext.match(/^snap_v1::DEMO:(.+)$/);
  return m?.[1] ?? "[encrypted]";
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
