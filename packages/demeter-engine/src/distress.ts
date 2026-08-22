// Distress gate (CEO review F2/D3.2; closes OBBBA-audit item Q5).
//
// A public benefits chatbot WILL receive messages like "I have no food for my
// kids tonight." This keyword gate (v1 — EN + ES) detects crisis phrasing so
// the answer LEADS with immediate help (expedited 7-day SNAP rights, 211,
// local food banks) before any policy content. Detection is deliberately
// high-recall/low-precision: a false positive costs one extra helpful
// paragraph; a false negative costs a hungry family a day.

const DISTRESS_PATTERNS: RegExp[] = [
  // English
  /no food (for|to feed)|nothing to eat|out of food|can'?t (afford|buy) (any )?food/i,
  /kids? (are|is|go(es)? to bed) hungry|children (are )?hungry|haven'?t eaten/i,
  /starving|going hungry|food emergency|empty fridge|no money for (food|groceries)/i,
  /benefits (were|got) (cut|stopped|stolen)|ebt (was|got) (stolen|skimmed|emptied)/i,
  /homeless|evicted|sleeping in (my|the) car|shelter tonight/i,
  // Spanish
  /no (tengo|tenemos|hay) (comida|nada que comer|dinero para comida)/i,
  /ni[ñn]os? (tienen|con) hambre|sin comer|pasando hambre/i,
  /emergencia de comida|me robaron (los beneficios|la ebt|las estampillas)/i,
  /sin hogar|desalojad[oa]|durmiendo en (el|mi) (carro|auto)/i,
];

/** True when the message shows acute food/shelter crisis phrasing. */
export function detectDistress(text: string): boolean {
  return DISTRESS_PATTERNS.some((p) => p.test(text));
}

/** System addendum prepended when distress is detected: lead with immediate,
 *  actionable help — warm, brief, never a policy lecture first. */
export const DISTRESS_SYSTEM_ADDENDUM =
  "URGENT-NEED MODE: the user's message indicates an immediate food or housing " +
  "crisis. BEFORE answering their question, open with 2-4 short lines of " +
  "immediate help, warmly and without judgment: (1) if they apply for SNAP and " +
  "qualify for expedited service, benefits must be available within 7 days — " +
  "and many states are faster; (2) for food TODAY, call 211 (or visit 211.org) " +
  "for local food banks and community meals — no paperwork needed; (3) if " +
  "benefits were stolen or cut wrongly, they can act (report to their agency; " +
  "ask about replacement). Then answer their question. Keep the whole response " +
  "shorter and gentler than usual. Do not lecture about eligibility rules " +
  "before offering the immediate options.";
