// Hard requirement #4: these strings must never appear in API response bodies.
// They imply benefit determination, which is illegal to communicate via API.
export const FORBIDDEN_WORDS = ['approved', 'denied', 'eligible', 'ineligible'] as const;
export type ForbiddenWord = (typeof FORBIDDEN_WORDS)[number];

const FORBIDDEN_RE = new RegExp(
  `\\b(${FORBIDDEN_WORDS.join('|')})\\b`,
  'i',
);

/**
 * Returns the first forbidden word found in `body`, or null if the body is clean.
 * Used in tests and the optional dev-mode response guard.
 */
export function findForbiddenWord(body: string): ForbiddenWord | null {
  const match = FORBIDDEN_RE.exec(body);
  return match ? (match[1]!.toLowerCase() as ForbiddenWord) : null;
}
