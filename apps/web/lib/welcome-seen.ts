// Whether the first-visit card has been shown.
//
// SHARED, because it is now asked on two surfaces — /chat and the landing at
// /screen/ask — and the answer has to be the SAME answer. Two copies of this
// would mean being introduced to the product twice, once per door, which is
// the specific thing a "first visit" card must not do.
//
// Deliberately its own key rather than a field on the saved session: clearing
// a conversation must not make the product introduce itself again.

export const WELCOME_SEEN_KEY = "demeter.welcome.seen";

/** True only if we can positively read that it HAS been seen.
 *
 *  STORAGE BLOCKED (private mode, blocked cookies) READS AS NOT SEEN — owner,
 *  2026-08-26, reversing the original call. We cannot remember a dismissal
 *  there, so we cannot know they have seen it, and the two failure modes are
 *  not equal: a card shown again is a second of mild annoyance, while a card
 *  never shown means someone who does not know what SNAP is never finds out,
 *  and never learns this is not the government. Dismissing still works for the
 *  session; it just does not survive a reload. */
export function welcomeSeen(): boolean {
  try {
    return Boolean(window.localStorage.getItem(WELCOME_SEEN_KEY));
  } catch {
    return false;
  }
}

/** Remember it. Silent when there is nothing to remember it with — the card
 *  simply shows again next time, which is the intended fallback above. */
export function markWelcomeSeen(): void {
  try {
    window.localStorage.setItem(WELCOME_SEEN_KEY, "1");
  } catch {
    /* nothing to remember it with */
  }
}
