// Retrieval over the vendored eCFR corpus (lib/mae/corpus/ecfr-snap.json).
//
// Given a caseworker's question, select the most relevant verbatim regulation
// chunks so Mae quotes and cites from source text instead of recalling. Pure
// lexical scoring + a small domain hint map — no embeddings, no deps; the corpus
// is ~250 chunks so this is fast and deterministic (which also makes it
// unit-testable and keeps citations reproducible).

import corpusJson from "./corpus/ecfr-snap.json";
import { embed, cosine } from "./embeddings";
import { DESCRIPTORS } from "./section-descriptors";
import { getStatePack, type StatePack, type PackTopic } from "./states";

export interface RegChunk {
  id: string;
  citation: string; // e.g. "7 CFR 273.9(d)(2)"
  section: string; // e.g. "273.9"
  heading: string;
  subsection: string | null;
  text: string;
  source_url: string;
  effective_date: string;
}

const CHUNKS: RegChunk[] = (corpusJson as { chunks: RegChunk[] }).chunks;

export const CORPUS_EFFECTIVE_DATE: string =
  (corpusJson as { _provenance?: { issue_date?: string } })._provenance?.issue_date ?? "";

// Domain phrasing → governing citation(s). Caseworkers rarely type section
// numbers; these map natural language onto the right part of the corpus. Each
// entry's `cites` is a citation PREFIX (matched on a "(" / exact boundary so
// "273.1" never grabs "273.10").
const TOPIC_HINTS: { terms: string[]; cites: string[] }[] = [
  { terms: ["shelter", "rent", "utility", "utilities", "housing"], cites: ["273.9(d)(6)"] },
  { terms: ["earned income deduction", "earned deduction", "20 percent", "twenty percent"], cites: ["273.9(d)(2)"] },
  { terms: ["standard deduction"], cites: ["273.9(d)(1)"] },
  { terms: ["medical"], cites: ["273.9(d)(3)"] },
  { terms: ["dependent care", "child care", "childcare"], cites: ["273.9(d)(4)"] },
  { terms: ["child support paid", "pay child support", "child support i pay", "support payment"], cites: ["273.9(d)(5)"] },
  { terms: ["deduction", "deductions", "deduct", "deductible", "write off", "what can i claim"], cites: ["273.9(d)"] },
  { terms: ["counts as income", "count as income", "what counts", "whose income", "included as income", "considered income", "is that income", "does it count"], cites: ["273.9(b)", "273.9(c)"] },
  { terms: ["expedited", "seven day", "7 day", "emergency", "expedite"], cites: ["273.2(i)"] },
  { terms: ["verification", "verify", "verifying", "documentation", "document"], cites: ["273.2(f)"] },
  { terms: ["categorical", "categorically", "bbce", "broad-based", "broad based"], cites: ["273.2(j)"] },
  { terms: ["abawd", "work requirement", "work requirements", "time limit", "able-bodied", "able bodied", "three months", "80 hours", "eighty hours"], cites: ["273.24"] },
  { terms: ["student", "students", "college", "higher education", "enrolled"], cites: ["273.5"] },
  { terms: ["asset", "assets", "resource", "resources", "vehicle", "automobile", "countable", "savings", "house", "bank account", "property", "retirement"], cites: ["273.8"] },
  { terms: ["gross income", "net income", "income limit", "income eligibility", "income test", "make too much", "too much to qualify", "over income", "over-income", "earn too much"], cites: ["273.9(a)"] },
  { terms: ["allotment", "benefit amount", "benefit calculation", "thrifty food plan", "minimum benefit", "proration", "how much will i get", "how much do i get", "how much snap", "what will i receive"], cites: ["273.10"] },
  { terms: ["income changes", "income varies", "varies every month", "every month", "fluctuate", "last 30 days", "last thirty days", "variable income"], cites: ["273.10"] },
  { terms: ["immigrant", "immigration", "noncitizen", "non-citizen", "non citizen", "alien", "lpr", "lawful permanent", "refugee", "asylee", "citizenship", "five-year", "five year", "qualified alien"], cites: ["273.4"] },
  { terms: ["citizen kids", "citizen children", "apply for my kids", "apply for my children", "undocumented", "mixed status", "mixed-status", "ineligible member"], cites: ["273.11(c)"] },
  { terms: ["ipv", "intentional program violation", "fraud", "disqualification", "disqualified"], cites: ["273.16"] },
  { terms: ["lottery", "gambling", "winnings"], cites: ["272.17", "273.11"] },
  { terms: ["who is in the household", "living together", "boarder", "roomer", "household composition", "household member", "household concept", "purchase and prepare"], cites: ["273.1"] },
  { terms: ["interview", "phone interview", "interview waiver"], cites: ["273.2(e)"] },
  { terms: ["what documents", "documents do i need", "still apply", "without a pay stub", "do not have", "don't have", "missing document", "incomplete application", "right to file"], cites: ["273.2(f)", "273.2(c)"] },
  { terms: ["paid in cash", "cash income", "pay stub", "paystub", "prove income", "proof of income", "employer won't", "employer will not", "letter from employer", "what counts instead", "alternative proof", "how do i prove"], cites: ["273.2(f)"] },
  { terms: ["quality control", "case review", "error rate"], cites: ["275.12"] },
  { terms: ["mixed status", "mixed-status", "ineligible member", "prorate"], cites: ["273.11(c)"] },
  // Procedural (caseworker-facing) topics
  { terms: ["recert", "recertify", "recertification", "renew", "renewal", "reapply", "certification period", "benefits stopped", "benefits ended", "cut off", "why did my benefits stop", "lost my benefits", "stopped getting"], cites: ["273.14"] },
  { terms: ["appeal", "appeals", "fair hearing", "hearing", "denied", "denial", "aid paid pending", "request a hearing"], cites: ["273.15"] },
  { terms: ["notice of adverse action", "adverse action", "noaa", "termination notice", "notice period"], cites: ["273.13"] },
  { terms: ["report", "reporting", "report changes", "change report", "semi-annual report", "periodic report", "interim report"], cites: ["273.12"] },
  { terms: ["work registration", "employment and training", "voluntary quit", "work provision", "work registrant", "reduce work"], cites: ["273.7"] },
  { terms: ["social security number", "ssn", "social security"], cites: ["273.6"] },
  { terms: ["residency", "residence", "reside", "live in the state", "where they live"], cites: ["273.3"] },
  { terms: ["restoration", "restore", "lost benefits", "underissuance", "restored benefits", "underpayment"], cites: ["273.17"] },
  { terms: ["authorized representative", "fill out for me", "fill it out for me", "submit for me", "submit the application for me", "on my behalf", "apply on my behalf", "represent me", "apply for me"], cites: ["273.2(n)"] },
  { terms: ["ice or immigration", "immigration find out", "find out if i apply", "data sharing", "data-sharing", "report me", "reported to", "confidential", "information shared", "who sees my", "shared with"], cites: ["272.1(c)"] },
  { terms: ["self-employment", "self employment", "self-employed", "self employed", "gig", "gig work", "uber", "lyft", "doordash", "independent contractor", "business income", "odd jobs"], cites: ["273.11"] },
];

interface ExternalTopic {
  terms: string[];
  curated?: RegChunk;
  suppressSections?: string[]; // corpus sections to drop when this topic fires
}

function curatedAuthority(citation: string, heading: string, text: string, url: string): RegChunk {
  return { id: citation, citation, section: citation, heading, subsection: null, text, source_url: url, effective_date: "curated reference" };
}

// State-pack topics (states/<code>/supplements.json) in ExternalTopic shape.
// This is where the formerly-hardcoded California supplements now come from —
// the pack is DATA; this converter is the only code that touches its shape.
function packTopics(pack: StatePack | null): ExternalTopic[] {
  if (!pack) return [];
  return pack.topics.map((t: PackTopic) => ({
    terms: t.terms,
    suppressSections: t.suppress_sections,
    curated: curatedAuthority(t.citation, t.heading, t.text, t.source_url),
  }));
}

// Topics the USDA 7 CFR corpus should NOT answer with a federal eligibility
// section. Each either injects a curated correct authority and/or suppresses a
// distractor section, so the result is the right cite — or nothing — not a
// wrong 7 CFR hit.
const FEDERAL_EXTERNAL_TOPICS: ExternalTopic[] = [
  {
    // Public charge is a DHS rule (8 CFR), not USDA — and SNAP is excluded.
    // (No "count against me" — too broad; it caught lump-sum income questions.)
    terms: ["public charge", "public-charge", "hurt my immigration", "affect my immigration status", "green card", "deportation", "inadmissible"],
    suppressSections: ["273.4"],
    curated: curatedAuthority(
      "8 CFR 212.21 (DHS public-charge rule)",
      "Public charge — SNAP is NOT counted",
      "SNAP (food stamps) is NOT considered in the public-charge inadmissibility determination. Public charge is a DHS/USCIS rule (8 CFR 212.21-212.22), not a USDA/SNAP rule. Only cash assistance for income maintenance (SSI, TANF, state general assistance) and long-term institutionalization at government expense count toward public charge; SNAP, Medicaid (other than long-term care), CHIP, and WIC are explicitly NOT counted. Applying for or receiving SNAP — for the applicant or for their U.S.-citizen/LPR children — does not by itself affect a green-card or public-charge case. This is a DHS matter; confirm current USCIS public-charge guidance for an individual situation.",
      "https://www.ecfr.gov/current/title-8/section-212.21",
    ),
  },
  {
    // Self-employment income method: federal framework is 273.11; the flat
    // 40-50% deduction is a state option, so don't route to change-reporting.
    terms: ["self-employment", "self employment", "self-employed", "self employed", "gig", "uber", "lyft", "doordash", "independent contractor"],
    suppressSections: ["273.12"],
  },
  {
    // Confidentiality / "will ICE find out": the answer is the disclosure rule
    // 7 CFR 272.1(c) (surfaced via topic hint), NOT the non-citizen eligibility
    // section — suppress that distractor.
    terms: ["ice or immigration", "immigration find out", "find out if i apply", "data sharing", "data-sharing", "report me", "reported to", "who sees my", "shared with"],
    suppressSections: ["273.4"],
  },
];


const STOPWORDS = new Set([
  "the", "and", "for", "are", "what", "when", "how", "does", "can", "with", "that", "this",
  "from", "have", "has", "who", "whom", "which", "into", "about", "would", "should", "could",
  "you", "your", "our", "they", "their", "them", "but", "not", "all", "any", "may", "must",
  "snap", "calfresh", "household", "households", "member", "members", "client", "applicant",
]);

const EXPLICIT_CITE_RE = /\b(27[0-9])\.(\d+)((?:\([a-z0-9]+\))*)/gi;

/** A citation matches a hint/prefix on a clean boundary (avoids 273.1 vs 273.10). */
function citeMatches(citation: string, prefix: string): boolean {
  const full = `7 CFR ${prefix}`;
  return citation === full || citation.startsWith(`${full}(`) || citation.startsWith(`${full}.`);
}

function tokenize(q: string): string[] {
  return (q.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter((t) => t.length >= 3 && !STOPWORDS.has(t));
}

function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max).trimEnd()} […truncated; full text at the cited URL]`;
}

export interface RetrieveOptions {
  /** State pack to merge with the federal corpus. Defaults to the launch state
   *  (CA), preserving the pre-pack behavior; an unregistered code degrades to
   *  federal-only. */
  state?: string | null;
  k?: number; // max chunks (default 6)
  charBudget?: number; // total injected chars (default 10000)
  maxChunkChars?: number; // per-chunk cap (default 3500)
  minScore?: number; // relevance floor (default 2) — below this, return nothing
}

// A chunk must clear this to be considered relevant. One heading-word match (+2)
// or a topic-hint/explicit-section hit clears it; scattered weak body-word hits
// (e.g. "weather" matching "weatherization") do not — so off-topic and
// not-covered questions retrieve nothing and Mae says "I don't have that."
const DEFAULT_MIN_SCORE = 2;

// How hard the semantic signal pushes. A descriptor cosine of ~0.5 (a clear
// paraphrase match) contributes ~4 — enough to carry a section over the floor on
// its own when no keyword fires; an off-topic ~0.1 contributes ~0.8 (filtered).
const SEMANTIC_WEIGHT = 8;

// Embed the descriptor index once per process; null again on failure so a later
// request can retry. Returns [] if embeddings are unavailable (lexical-only).
let descriptorVectorsPromise: Promise<{ cite: string; vec: number[] }[]> | null = null;
function descriptorVectors(): Promise<{ cite: string; vec: number[] }[]> {
  if (!descriptorVectorsPromise) {
    descriptorVectorsPromise = Promise.all(
      DESCRIPTORS.map(async (d) => ({ cite: d.cite, vec: await embed(d.text) })),
    ).catch((err) => {
      descriptorVectorsPromise = null;
      console.error("[mae] descriptor embedding unavailable, lexical-only:", err);
      return [];
    });
  }
  return descriptorVectorsPromise;
}

/**
 * Does the query contain `term`? Multi-word terms match as a substring; single
 * words match a whole query word (or a stem prefix, for terms ≥5 chars). This
 * stops short terms from matching inside larger words — "car" must not match
 * "care", "ice" must not match "notice" — while "recert" still matches
 * "recertify".
 */
function queryHasTerm(words: Set<string>, normalized: string, term: string): boolean {
  if (term.includes(" ")) return normalized.includes(term);
  if (words.has(term)) return true;
  if (term.length >= 5) {
    for (const w of words) if (w.startsWith(term)) return true;
  }
  return false;
}

/** Score and rank corpus chunks for a query; returns the top set within budget.
 *
 * Hybrid: a local sentence-embedding model routes the question to the right
 * section by matching plain-English descriptors (paraphrase-robust), blended
 * with deterministic lexical/keyword scoring for subsection precision. Semantic
 * is best-effort — if the model can't load, this is exactly the lexical path. */
export async function retrieve(query: string, opts: RetrieveOptions = {}): Promise<RegChunk[]> {
  const { k = 6, charBudget = 10_000, maxChunkChars = 3_500, minScore = DEFAULT_MIN_SCORE, state } = opts;
  const normalized = query.toLowerCase();
  const words = new Set(normalized.match(/[a-z0-9]+/g) ?? []);
  const tokens = new Set(tokenize(query));

  // Explicit section references typed by the user.
  const explicit: string[] = [];
  for (const m of normalized.matchAll(EXPLICIT_CITE_RE)) {
    explicit.push(`${m[1]}.${m[2]}${m[3] ?? ""}`);
  }

  // Topic hints whose phrasing appears in the query.
  const hintedCites: string[] = [];
  for (const hint of TOPIC_HINTS) {
    if (hint.terms.some((t) => queryHasTerm(words, normalized, t))) hintedCites.push(...hint.cites);
  }

  // External-authority topics the USDA corpus shouldn't answer: inject a curated
  // authority (e.g. DHS public charge) and/or suppress a distractor section so
  // these return the correct cite — or nothing — instead of a wrong 7 CFR hit.
  const curated: RegChunk[] = [];
  const suppressed = new Set<string>();
  for (const topic of [...FEDERAL_EXTERNAL_TOPICS, ...packTopics(getStatePack(state))]) {
    if (topic.terms.some((t) => queryHasTerm(words, normalized, t))) {
      if (topic.curated) curated.push(topic.curated);
      for (const s of topic.suppressSections ?? []) suppressed.add(s);
    }
  }

  // Semantic layer (best-effort): cosine of the query against each descriptor.
  // semFor(citation) = the best similarity of any descriptor whose cite matches
  // this chunk — so a subsection descriptor refines its section descriptor.
  let semByCite: { cite: string; sim: number }[] = [];
  try {
    const [qVec, descVecs] = await Promise.all([embed(query), descriptorVectors()]);
    semByCite = descVecs.map((d) => ({ cite: d.cite, sim: cosine(qVec, d.vec) }));
  } catch (err) {
    console.error("[mae] query embedding failed, lexical-only:", err);
  }
  const semFor = (citation: string): number => {
    let best = 0;
    for (const s of semByCite) if (s.sim > best && citeMatches(citation, s.cite)) best = s.sim;
    return best;
  };

  const scored = CHUNKS.filter((c) => !suppressed.has(c.section))
    .map((c) => {
      let score = 0;
      for (const e of explicit) if (citeMatches(c.citation, e)) score += 8;
      for (const h of hintedCites) if (citeMatches(c.citation, h)) score += 6;
      const heading = c.heading.toLowerCase();
      const text = c.text.toLowerCase();
      for (const tok of tokens) {
        if (heading.includes(tok)) score += 2;
        if (c.citation.toLowerCase().includes(tok)) score += 1;
        if (text.includes(tok)) score += 0.3;
      }
      score += SEMANTIC_WEIGHT * semFor(c.citation);
      return { c, score };
    })
    .filter((s) => s.score >= minScore)
    .sort((a, b) => b.score - a.score);

  // Curated external authorities lead; then top corpus chunks within budget.
  const out: RegChunk[] = [];
  let used = 0;
  for (const c of curated) {
    out.push(c);
    used += c.text.length;
  }
  for (const { c } of scored) {
    if (out.length >= k) break;
    const t = truncate(c.text, maxChunkChars);
    if (used + t.length > charBudget && out.length > 0) continue;
    out.push({ ...c, text: t });
    used += t.length;
  }
  return out;
}

// CRITICAL: the eCFR regulatory text lags the H.R.1 / OBBBA statute (Pub. L.
// 119-21, eff. 2025-07-04). For these sections the VERBATIM TEXT IS STALE — the
// regulation hasn't been amended yet — so a warning is injected above the
// excerpt telling Mae the OBBBA notes control. Verified against the corpus
// 2026-06-07: 273.24(c) still reads "55 years of age or older" + lists the
// repealed veteran/homeless/foster exemptions; 273.4 still lists refugees/asylees.
const OBBBA_SUPERSEDED: Record<string, string> = {
  "273.24":
    "⚠️ SUPERSEDED IN PART by H.R.1 / OBBBA (Pub. L. 119-21, eff. 2025-07-04). The eCFR text below PREDATES the statute and is outdated on age and exemptions: the ABAWD time-limit age ceiling is now 64 (exempt only if under 18 or 65+) — the \"55 years of age or older\" exemption below is NO LONGER CURRENT; and the exemptions for veterans, people experiencing homelessness, and former foster youth were ELIMINATED (an exemption for Indian / Urban Indian / California Indian individuals was added). The 80-hour work definition is unchanged. Cite the statute / current FNS ABAWD memo for age and exemptions — do NOT quote this subsection as current.",
  "273.4":
    "⚠️ SUPERSEDED IN PART by H.R.1 / OBBBA (Pub. L. 119-21). The eligible non-citizen categories in the text below PREDATE the statute: eligibility was narrowed — refugees, asylees, and TPS holders were REMOVED. The current eligible set is U.S. nationals, LPRs, Cuban/Haitian entrants, and COFA migrants (FNS Alien Eligibility memo, 2025-10-31). Do not state refugee/asylee eligibility from this text as current.",
};

/** Format retrieved chunks as an authoritative source block for the prompt.
 *
 * The OBBBA supersession warnings are FEDERAL (Layer 1 — one copy, framework
 * §3); a state pack may append a state-specific addendum per section (e.g.
 * California's ABAWD resumption date), which renders after the federal note. */
export function formatRetrievedSources(chunks: RegChunk[], state?: string | null): string {
  if (chunks.length === 0) return "";
  const pack = getStatePack(state);
  const body = chunks
    .map((c) => {
      const federalWarn = OBBBA_SUPERSEDED[c.section];
      const stateNote = pack?.supersessions?.[c.section];
      const warn = federalWarn
        ? stateNote ? `${federalWarn} ${stateNote}` : federalWarn
        : undefined;
      const head = `### ${c.citation} — ${c.heading}\n(eCFR, eff. ${c.effective_date}; ${c.source_url})`;
      return warn ? `${head}\n${warn}\n${c.text}` : `${head}\n${c.text}`;
    })
    .join("\n\n");
  return (
    "## Verbatim regulatory source text (authoritative, except where marked SUPERSEDED)\n" +
    "Exact excerpts of the cited federal regulations, retrieved for this question. Quote and cite ONLY " +
    "from these excerpts for federal rules. BUT where an excerpt carries a 'SUPERSEDED IN PART' warning, " +
    "the eCFR text predates H.R.1/OBBBA and is stale — follow the warning and the OBBBA notes above, and " +
    "do NOT quote the stale subsection as current law. If the excerpts don't cover the question, say so " +
    "and point to the governing section rather than guessing.\n\n" +
    body
  );
}
