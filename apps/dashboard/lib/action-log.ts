// Demo-grade local log of the navigator's actions today. Persists across
// page navigations via localStorage so the chip clicks feel like "real"
// state. Date-keyed so the counter resets at midnight.
//
// In a production wiring, logAction() would POST to the gateway. Here it
// just records to localStorage and fires a custom event so any subscribed
// component (the top-of-page counter) can update live.

const STORAGE_PREFIX = "civica:actions-today";
export const ACTION_LOGGED_EVENT = "civica:action-logged";

export type LoggedAction = {
  at: string;            // ISO timestamp
  label: string;         // chip action label, e.g. "Call applicant"
  applicantName: string; // first-name-last-initial, never raw PII
};

function todayKey(): string {
  const d = new Date();
  return `${STORAGE_PREFIX}:${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function logAction(label: string, applicantName: string): void {
  if (typeof window === "undefined") return;
  const key = todayKey();
  const existing = readActionsRaw(key);
  const next: LoggedAction = { at: new Date().toISOString(), label, applicantName };
  existing.push(next);
  try {
    localStorage.setItem(key, JSON.stringify(existing));
    window.dispatchEvent(new CustomEvent(ACTION_LOGGED_EVENT, { detail: next }));
  } catch {
    // localStorage can throw in private mode or when quota is exceeded.
    // Demo-grade: silently swallow — the chip's local confirm state still
    // gives the navigator visual feedback.
  }
}

export function getActionsToday(): LoggedAction[] {
  if (typeof window === "undefined") return [];
  return readActionsRaw(todayKey());
}

function readActionsRaw(key: string): LoggedAction[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
