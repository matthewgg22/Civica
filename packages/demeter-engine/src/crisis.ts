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

import type { AnswerLang } from "./lang";

export type CrisisKind = "self_harm" | "abuse";

const SELF_HARM: RegExp[] = [
  // English. "kill myself" not "kill" — see the idiom note above.
  /\b(kill|killing|hurt|harm|hurting|harming|cut|cutting)\s+(myself|my ?self)\b/i,
  /\bend(ing)?\s+(my|it)\s+(life|all)\b|\btake\s+my\s+own\s+life\b/i,
  /\bbetter\s+off\s+dead\b|\bwant\s+to\s+(die|be\s+dead)\b|\bwanna\s+die\b/i,
  /\bdon'?t\s+want\s+to\s+(be\s+here|be\s+alive|live)\s*(anymore|any\s+more)?\b/i,
  /\bsuicid(e|al)\b/i,
  // HOW PEOPLE ACTUALLY SAY IT (launch audit 2026-08-28). The set above missed
  // the most common real phrasings, and a miss here is the exact failure this
  // file exists to prevent — plus it silently disables the deterministic safety
  // net (#1069), which only fires when this returns non-null. Each added phrase
  // is high-signal and checked against the idiom non-matches below.
  /\bkms\b/i, // near-universal abbreviation for "kill myself"
  /\bunali(ve|fe)\b/i, // the euphemism coined to evade suicide-word moderation
  /\bwish(ed)?\s+i\s+(was|were|wasn'?t|weren'?t)\s+(dead|alive|here|born)\b/i,
  /\b(i'?d\s+)?rather\s+be\s+dead\b/i,
  /\bend\s+(it|things|everything)\s+(tonight|today|tonite|now|soon|for\s+good)\b/i,
  /\bno\s+(point|reason)\s+(in\s+|to\s+)?(living|go(ing)?\s+on|keep\s+going|be(ing)?\s+(here|alive))\b/i,
  /\bbetter\s+(off\s+)?without\s+me\b/i,
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
  // COERCIVE CONTROL — abuse without a named physical hit (issue #1083). The
  // physical-violence patterns above miss confinement, financial control,
  // surveillance and isolation, which are core DV patterns a benefits chat
  // will hear ("he won't let me leave", "he takes my EBT card"). High-signal
  // only, and test-pinned NOT to fire on ordinary benefits talk ("my disability
  // won't let me work", "who controls the SNAP program"). A DV advocate should
  // still review these — see #1083.
  /\b(won'?t|will not|does\s?n'?t|do\s?n'?t)\s+let\s+me\s+leave\b/i,
  /\bnot\s+allowed\s+to\s+(leave|have\s+(any\s+)?money|see\s+(my\s+)?(friends|family|anyone)|have\s+friends|go\s+out)\b/i,
  /\b(takes?|took|taking|controls?|controlling|keeps?|hides?)\s+(all\s+)?(my|the)\s+(money|paycheck|pay|benefits|ebt|snap\s+card|card|phone|passport|documents|keys)\b/i,
  /\bcontrols?\s+(everything|where\s+i\s+(go|can\s+go)|what\s+i\s+(do|can\s+do|buy|eat)|who\s+i\s+(see|talk\s+to))\b/i,
  /\b(tracks?|tracking|monitors?|monitoring|watches?)\s+(my|all\s+my)\s+(location|phone|messages|texts|calls|every\s+move|whereabouts)\b/i,
  /\bisolat(es?|ing|ed)\s+me\b|\bcut\s+me\s+off\s+from\s+(my\s+)?(family|friends|everyone|everybody)\b/i,
  /\b(won'?t|does\s?n'?t)\s+let\s+me\s+(see\s+(my\s+)?(family|friends|kids)|have\s+(a\s+)?(phone|money)|go\s+anywhere)\b/i,
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

// ---------------------------------------------------------------------------
// Deterministic safety net (launch audit 2026-08-28).
//
// The addendum above is an INSTRUCTION to the model, not a guarantee. Under the
// asymmetry this whole file is built on — "someone saying they want to die is
// answered with paperwork" — the resource actually reaching the reader cannot
// depend on the model complying. A truncated stream, an adversarial turn, or
// plain non-compliance would drop the number silently.
//
// So the orchestrator checks the FINISHED answer: if the crisis resource is not
// detectably in it, append this deterministic line. Bias is one-directional on
// purpose — when unsure, append. A duplicated hotline number is a far smaller
// harm than a missing one, and the detection below is strict enough that a real
// compliant answer (which always writes the number) suppresses the net.

/** True when the answer already carries this crisis's resource number, so the
 *  net must NOT be appended. Digit-stripped for the DV number so any separator
 *  formatting still counts; 988 is a bounded token to avoid an unrelated "988"
 *  in the body reading as compliance. */
export function crisisResourcePresent(kind: CrisisKind, answer: string): boolean {
  if (kind === "self_harm") return /(?<!\d)988(?!\d)/.test(answer);
  const digits = answer.replace(/\D/g, "");
  return digits.includes("7997233") || digits.includes("88788");
}

const SAFETY_NET: Record<CrisisKind, Record<AnswerLang, string>> = {
  self_harm: {
    en: "**If you're thinking about suicide or self-harm, you're not alone.** The 988 Suicide & Crisis Lifeline is free, confidential, and open 24/7 — call or text **988** (press 2 for Spanish).",
    es: "**Si estás pensando en el suicidio o en hacerte daño, no estás solo.** La Línea 988 de Prevención del Suicidio y Crisis es gratuita, confidencial y está disponible las 24 horas — llama o envía un mensaje de texto al **988** (presiona 2 para español).",
    vi: "**Nếu bạn đang nghĩ đến việc tự tử hoặc tự làm hại bản thân, bạn không đơn độc.** Đường dây 988 miễn phí, bảo mật và hoạt động 24/7 — hãy gọi hoặc nhắn tin **988** (có hỗ trợ tiếng Việt).",
    zh: "**如果你有自杀或自残的念头，你并不孤单。** 988 生命热线免费、保密，全天候 24/7 — 可拨打或发短信至 **988**（提供中文服务）。",
  },
  abuse: {
    en: "**If you're not safe at home, help is available.** The National Domestic Violence Hotline is free, confidential, and open 24/7 — call **1-800-799-7233** or text **START to 88788** (interpretation in many languages).",
    es: "**Si no estás seguro/a en casa, hay ayuda disponible.** La Línea Nacional contra la Violencia Doméstica es gratuita, confidencial y está disponible las 24 horas — llama al **1-800-799-7233** o envía **START al 88788** (interpretación en muchos idiomas).",
    vi: "**Nếu bạn không an toàn ở nhà, luôn có sự trợ giúp.** Đường dây nóng Quốc gia về Bạo lực Gia đình miễn phí, bảo mật và hoạt động 24/7 — gọi **1-800-799-7233** hoặc nhắn **START đến 88788** (hỗ trợ thông dịch nhiều ngôn ngữ).",
    zh: "**如果你在家中不安全，可以获得帮助。** 全国家庭暴力热线免费、保密，全天候 24/7 — 请拨打 **1-800-799-7233**，或发送 **START 至 88788**（提供多种语言口译）。",
  },
};

/** The deterministic line the orchestrator appends when the model's answer
 *  omitted the crisis resource. Its own paragraph; safe to render as markdown. */
export function crisisSafetyNet(kind: CrisisKind, lang: AnswerLang = "en"): string {
  return SAFETY_NET[kind][lang];
}
