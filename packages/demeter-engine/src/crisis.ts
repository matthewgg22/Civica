// Crisis gate (#927) — the tier above the distress gate.
//
// distress.ts catches acute FOOD and HOUSING crisis and makes the answer lead
// with expedited-service rights, 211 and food banks. This catches the two
// things a public benefits chat will also receive and must not answer with
// policy: self-harm or suicidal ideation, and abuse. Before this, "I can't do
// this anymore, I'd be better off dead" got a SNAP eligibility answer.
//
// This is a plausible message here, not an edge case: food insecurity
// co-occurs with both, and the product invites people to describe their
// situation in their own words.
//
// THE ASYMMETRY THAT SHAPES EVERY CHOICE BELOW. A false negative means
// someone saying they want to die is answered with paperwork. A false
// positive means someone gets one gentle line and a number they did not need.
// Those are not comparable, so recall wins — with one limit: matching bare
// words would fire on "this paperwork is killing me", and a product that
// mishandles the idiom will not be trusted with the real thing. So the
// patterns are PHRASES, and the idioms are test-pinned as non-matches.
//
// DELIBERATELY NOT MATCHED in v1: standalone ambiguous phrases like "I can't
// do this anymore" or "I give up", which on a benefits site are usually about
// a form. They carry real signal but too little of it alone; the issue's own
// example is caught by its second clause ("better off dead"). Revisit with
// evidence from the audit log rather than by guessing.
//
// NOT A DIAGNOSIS, and not a gate on the answer: see the addendum.

export type CrisisKind = "self_harm" | "abuse";

const SELF_HARM: RegExp[] = [
  // English. "kill myself" not "kill" — see the idiom note above.
  /\b(kill|killing|hurt|harm|hurting|harming|cut|cutting)\s+(myself|my ?self)\b/i,
  /\bend(ing)?\s+(my|it)\s+(life|all)\b|\btake\s+my\s+own\s+life\b/i,
  /\bbetter\s+off\s+dead\b|\bwant\s+to\s+(die|be\s+dead)\b|\bwanna\s+die\b/i,
  /\bdon'?t\s+want\s+to\s+(be\s+here|live)\s*(anymore|any\s+more)?\b/i,
  /\bsuicid(e|al)\b/i,
  // Spanish
  /\b(matarme|suicidarme|quitarme\s+la\s+vida|hacerme\s+da[ñn]o|lastimarme)\b/i,
  /\bquiero\s+morir(me)?\b|\bmejor\s+muert[oa]\b|\bno\s+quiero\s+vivir\b/i,
  /\bsuicid(io|a)\b/i,
  // Vietnamese
  /tự\s*tử|tự\s*sát|muốn\s+chết|kết\s+liễu/i,
  // Chinese
  /自杀|自殺|想死|不想活|轻生|輕生|自残|自殘/,
];

const ABUSE: RegExp[] = [
  // English. Third person acting on "me" is the shape disclosure takes.
  /\b(he|she|they|husband|wife|partner|boyfriend|girlfriend|bf|gf)\s+\w*\s*(hits?|beats?|hurts?|chokes?|strangles?)\s+me\b/i,
  /\b(hits|beats|hurts)\s+me\b|\bbeat\s+me\s+up\b/i,
  /\b(is|was|being)\s+abusive\b|\babus(es|ing)\s+me\b|\bmy\s+abuser\b/i,
  /\b(scared|afraid|terrified)\s+of\s+my\s+(husband|wife|partner|boyfriend|girlfriend|ex)\b/i,
  /\bdomestic\s+violence\b|\brestraining\s+order\b/i,
  /\bnot\s+safe\s+(at\s+home|here)\b|\bthreatened?\s+to\s+kill\s+me\b|\bthreatens\s+me\b/i,
  // Spanish
  /\bme\s+(pega|golpea|maltrata|amenaza)\b|\bviolencia\s+dom[ée]stica\b/i,
  /\babusa\s+de\s+m[ií]\b|\borden\s+de\s+restricci[óo]n\b/i,
  /\b(miedo|temor)\s+de\s+mi\s+(esposo|esposa|pareja|novio|novia)\b/i,
  // Vietnamese
  /bạo\s*lực\s+gia\s*đình|đánh\s+tôi|chồng\s+tôi\s+đánh|vợ\s+tôi\s+đánh/i,
  // Chinese
  /家暴|家庭暴力|他打我|她打我|虐待我/,
];

/** The crisis kind this message shows, or null. Self-harm wins when both
 *  appear: it is the more time-critical of the two. */
export function detectCrisis(text: string): CrisisKind | null {
  if (SELF_HARM.some((p) => p.test(text))) return "self_harm";
  if (ABUSE.some((p) => p.test(text))) return "abuse";
  return null;
}

/** Shape borrowed from published crisis-response protocol: acknowledge →
 *  resource → keep helping. Deliberately NOT "refuse and redirect".
 *
 *  Someone may disclose abuse precisely BECAUSE it bears on their case —
 *  leaving a household changes who they apply as, and there are real SNAP
 *  provisions for it. Withholding the benefits answer would be unhelpful,
 *  patronising, and would teach them not to mention it again. */
export function CRISIS_SYSTEM_ADDENDUM(kind: CrisisKind): string {
  const shared =
    "Do not diagnose, label, or speculate about what they are experiencing. " +
    "Do not moralise, and do not make continuing the conversation conditional " +
    "on them contacting anyone. Say it once, warmly and briefly — repeating it " +
    "reads as a script rather than as care. Then still answer their benefits " +
    "question, in full and as usual.";

  if (kind === "self_harm") {
    return (
      "SAFETY MODE — the user's message suggests they may be thinking about " +
      "suicide or self-harm. Before anything else, open with two or three " +
      "short lines: acknowledge what they said plainly and without alarm, and " +
      "tell them the 988 Suicide & Crisis Lifeline is free, confidential and " +
      "open 24/7 — they can call or text 988 (Spanish available; press 2 when " +
      "calling). " +
      shared
    );
  }
  return (
    "SAFETY MODE — the user's message suggests they may be experiencing abuse " +
    "or an unsafe situation at home. Before anything else, open with two or " +
    "three short lines: acknowledge what they said plainly and without alarm, " +
    "and tell them the National Domestic Violence Hotline is free, " +
    "confidential and open 24/7 — 1-800-799-7233, or text START to 88788 " +
    "(interpretation available in many languages). If they have left or are " +
    "planning to, note that who counts as part of their household can change, " +
    "which affects a SNAP application — but only state specifics that the " +
    "sources you were given actually support. " +
    shared
  );
}
