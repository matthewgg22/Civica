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

// Topics the USDA 7 CFR corpus should NOT answer with a federal eligibility
// section. Each either injects a curated correct authority and/or suppresses a
// distractor section, so the result is the right cite — or nothing — not a
// wrong 7 CFR hit.
const EXTERNAL_TOPICS: ExternalTopic[] = [
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
    // EBT card mechanics are operational, not a policy citation.
    terms: ["ebt card", "ebt balance", "ebt", "my card", "lost card", "stolen card", "card problem", "skimming", "skimmed", "who do i call"],
    suppressSections: ["273.8"],
    curated: curatedAuthority(
      "Operational — EBT customer service (issuance: 7 CFR 274)",
      "EBT card / balance problems — not a policy question",
      "EBT card issues (lost or stolen card, PIN reset, balance, transaction disputes, skimming/stolen benefits) are handled by EBT Customer Service, not by a policy citation. California EBT Customer Service: 1-888-328-2656 (24/7) — advise the client to call immediately to freeze a lost/stolen card. The general benefit-issuance rules are at 7 CFR 274; stolen-EBT replacement policy has changed recently, so confirm current CDSS guidance.",
      "https://www.ecfr.gov/current/title-7/part-274",
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
  {
    // Eligible foods (hot food / household goods) is 7 CFR 271.2, which isn't in
    // the corpus — give the rule directly and suppress the asset distractor.
    terms: ["hot food", "household goods", "use snap for", "use my benefits for", "buy with snap", "can i buy", "eligible food", "eligible items", "what can i buy"],
    suppressSections: ["273.8"],
    curated: curatedAuthority(
      "7 CFR 271.2 (definition of eligible food)",
      "What SNAP can / cannot buy",
      "SNAP buys staple grocery food: fruits, vegetables, meat, dairy, bread, cereals, snacks, and seeds/plants that produce food. It CANNOT buy: hot foods or foods prepared for immediate consumption at the point of sale, alcohol, tobacco, vitamins/medicines/supplements, or any nonfood household goods (soap, paper products, pet food, hygiene items). The governing definition is 7 CFR 271.2 (\"eligible food\"). Exception: the Restaurant Meals Program (statewide in California per AB 942) lets certain elderly, disabled, or homeless recipients buy prepared meals at participating restaurants. Confirm current CDSS RMP details.",
      "https://www.ecfr.gov/current/title-7/section-271.2",
    ),
  },
];

// Civica-curated CURRENT-RULE supplements. Unlike EXTERNAL_TOPICS (which redirect
// AWAY from the USDA corpus), these SUPPLEMENT the eCFR text with post-OBBBA
// current rules and California operational guidance the raw regulation lacks. They
// lead the results (like the curated externals) so Mae sees the current rule
// first, while the eCFR section — and any SUPERSEDED warning — still follows.
// Sourced from the 2026-07-23 CDSS/LA County FOIA production (see repo
// FOIA_DATA_AUDIT_2026-07-23.md + docs/plans/mae-foia-training-tasks.md, tasks A1/A2).
const CURATED_SUPPLEMENTS: ExternalTopic[] = [
  {
    // A1 — ABAWD current rules (post H.R.1 / OBBBA §10102). The eCFR 273.24 text is
    // stale (see OBBBA_SUPERSEDED); this injects the CURRENT spec. The citation keeps
    // "273.24" so section routing + retrieval tests still resolve to the ABAWD section.
    terms: [
      "abawd", "able-bodied", "able bodied", "time limit", "three months", "three-month",
      "3 months", "80 hours", "eighty hours", "work requirement", "work requirements",
      "18 to 64", "55 to 64", "60 to 64", "aged out", "work-requirement exemption",
      "abawd exemption", "lose snap after", "lose benefits after",
      // countable-month / clock / regaining / workfare fact patterns
      "countable month", "countable months", "used my 3 months", "used my three months",
      "already used", "ran out of months", "workfare", "regain", "regaining",
      "get benefits back", "prorated month", "obviously unfit", "unfit for work",
    ],
    curated: curatedAuthority(
      "7 CFR 273.24 (ABAWD) — CURRENT rules per H.R.1 / OBBBA §10102 (Pub. L. 119-21); CDSS ACL 25-93",
      "ABAWD time limit — CURRENT rules (post-OBBBA), California",
      "The ABAWD time limit (3 countable months of SNAP in a 36-month period unless meeting the work rule) now applies to adults 18 through 64. Age edges differ BY STATE: in California a person is no longer an ABAWD the first of the month after their 65th birthday; Texas ends it the month the person turns 65 — do not state one nationally. Work rule: 80 hours/month (~20/week) of work, approved E&T, community service/volunteering, or workfare. WORKFARE HOURS = the household's monthly allotment ÷ the HIGHEST applicable minimum wage (state, county, or city), rounded DOWN, and workfare is NOT combinable with other qualifying activities. Note stand-alone E&T job search / job club is a NON-qualifying activity (countable only up to 9 hours), so 'approved E&T' does not automatically satisfy the 80 hours. CURRENT ABAWD time-limit exemptions and how to verify each: (1) exempt from work registration [MPP 63-407] — no separate proof; (2) under 18 or over 64 — date of birth; (3) physically or mentally unfit — receipt of or pending application for a disability benefit (SSI/SSDI/VA/workers' comp); OR 'obviously unfit', which is determined by the worker at interview and needs only detailed case notes; OR, for non-obvious unfitness, form CF 887 or a WRITTEN OR VERBAL statement from a medical or mental-health professional (physicians, nurse practitioners, dentists, social workers). IMPORTANT: homelessness, drug/alcohol addiction, and domestic violence are now only INDICATORS of possible unfitness — they must be tied to physical/mental unfitness, they are not exemptions in themselves; (4) responsible for a dependent CHILD UNDER 14 (narrowed by OBBBA from under 18); (5) pregnant — client statement is sufficient; (6) participating at least half-time in an Office of Refugee Resettlement (ORR) training program; (7) an Indian, Urban Indian, or California Indian eligible for Indian Health Service — NEW under OBBBA (verification pending final FNS guidance). ELIMINATED by OBBBA (no longer exemptions): veterans, people experiencing homelessness, and former foster youth. COUNTABLE MONTHS: a month counts only if the person received a full month of benefits while not exempt, not meeting the work rule, and not in a waived area. NON-countable: a prorated/partial month, any month in which an exemption applied during ANY part of the month, good cause (illness, household emergency, lack of transportation, disaster, discrimination claim, unpredictable last-minute work hours), and discretionary exemptions. CALIFORNIA CLOCK — CRITICAL: California uses a FIXED statewide 36-month period, and the period that ran 2023-01-01 through 2025-12-31 HAS ENDED. Countable months from that period do NOT carry into the new one, so a person who 'used their 3 months' before 2026 starts fresh. Confirm the current period's exact dates against the operative CDSS ACL. REGAINING ELIGIBILITY: a person regains by working 30 consecutive days, becoming exempt, moving to a waived area, or the 36-month period ending; regaining is unlimited but requires a new application. CALIFORNIA timing: statewide ABAWD screening BEGINS 2026-06-01 (per CDSS ACL 25-93) — this is the operative date, NOT the 2025-07-04 federal signing; the prior statewide waiver expired 2026-01-31 and only a few counties still hold a waiver, so confirm the specific county. Required forms: CF 886 (CalFresh Notice of Work Rules — a verbal explanation AND the written notice must be given before the time limit is applied) and CF 377.11E (ABAWD exemption screening). Some specifics (tribal-exemption and child-under-14 verification) remain pending FNS guidance — treat them as pending, not settled. Confirm the current FNS ABAWD memo, CDSS ACL, and the county waiver status for any individual case.",
      "https://www.ecfr.gov/current/title-7/section-273.24",
    ),
  },
  {
    // A2 — verification limits / anti-over-verification. Triggers are narrow (the
    // over-verification fact pattern) so generic "what documents do I need" questions
    // still route to the plain 273.2(f) corpus chunk instead of this supplement.
    terms: [
      "already provided", "already sent", "already submitted", "already gave", "already on file",
      "on file", "already have it", "request again", "request them again", "re-request", "rerequest",
      "ask again", "over-verify", "over verify", "over-verification", "over verification",
      "unnecessary verification", "redundant verification", "not questionable", "isn't questionable",
      "questionable", "failure to provide", "the work number", "work number", "twn",
    ],
    curated: curatedAuthority(
      "7 CFR 273.2(f) — verification limits; CDSS MPP 63-300, ACL 20-48 / 20-135 / 21-24, ACIN I-45-11",
      "Verification limits — do not over-verify",
      "The single most common documented CalFresh error (CDSS Management Evaluation reviews, 2024-2025, present in 37 of 38 counties) is OVER-VERIFICATION: requesting verification the household already provided, or that is not required and not questionable. Rules: verify only what is REQUIRED (income, ineligible-noncitizen status, disability claimed for a deduction, and the other mandatory items) OR what is QUESTIONABLE — inconsistent with other statements or known facts — and when you treat something as questionable the case record must document WHY (7 CFR 273.2(f)(1)-(2) and 273.2(f)(6); California MPP 63-300.5(j), ACL 20-48, ACL 21-24, ACIN I-45-11). Do not limit the household to ONE type of verification when several would do (ACL 21-24; ACIN I-45-11), and request only the last 30 days of income (7 CFR 273.10(c)(1)(ii); ACL 20-48). Use data already available BEFORE asking the household — e.g. check The Work Number (TWN) for employer-reported wages before requesting pay stubs — but TWN data must be CONFIRMED WITH THE HOUSEHOLD before it is used to budget, and TWN should not be pulled when the household has supplied no income information at all (ACL 23-53). Never re-request a document already in the case file, and never deny for 'failure to provide' verification the household in fact provided. Give the household a written request (CW 2200) and a minimum of 10 calendar days to respond (7 CFR 273.2(f)(5)); do not hold up an expedited-service household for non-required verification (273.2(i); ACL 16-14). Over-verification both inflates the payment/procedural error rate and wrongly denies eligible households — verify for correctness, not for volume.",
      "https://www.ecfr.gov/current/title-7/section-273.2",
    ),
  },
  {
    // A5 — CF 886 decoder. When a household says "I got this form", Mae should be
    // able to read it back to them. The eCFR has nothing about a California
    // county form, so this is the only place the content can come from.
    // Source: R012680 CF 886 (rev 8/25) + the CDSS ABAWD policy deck.
    terms: [
      "cf 886", "cf886", "notice of work rules", "work rules notice", "work rules letter",
      "got this form", "got this notice", "this form in the mail", "cf 377.11e", "377.11e",
      "work rule sanction", "disqualified from work rules", "how long am i disqualified",
      // Sanction-length questions: the CF 886 ladder (1/3/6 months) is the right
      // answer, and 273.16 (intentional program violation — 12mo/24mo/permanent)
      // is a materially WRONG one. Scoped to work-rules phrasing so genuine IPV
      // questions still route to 273.16.
      "general work rules", "failed the work rules", "work rule disqualification",
    ],
    curated: curatedAuthority(
      "CF 886 (CalFresh Notice of Work Rules, rev. 8/25); CDSS ACL 22-74",
      "CF 886 — what the work-rules notice actually says",
      "The CF 886 is the CalFresh Notice of Work Rules. It is INFORMATIONAL, not a sanction: it opens 'This letter is to tell you about the CalFresh work rules. If you don't follow these rules, your household's CalFresh benefits may decrease or stop.' It is issued to ALL household members — including exempt ones — at application, at recertification, and whenever a work requirement is newly imposed, and the county must ALSO give a verbal explanation (ACL 22-74). Receiving it does not mean the person is out of compliance. HOW TO READ IT: it has TWO sections with fill-in-the-blank personalization. Section 1 = the general work rules (work registration, ages 16-59); Section 2 = the ABAWD time limit. Each names who must comply and who is excused ('____, you are excused because you are ____') — the person's own name may appear on the excused line, so read the blanks before assuming anything. Check for the COUNTY WAIVER BOX: 'You are living in a county where the ABAWD work requirement is waived. This means you do not have to meet the ABAWD work requirement at this time. We will let you know when the waiver ends.' CONSEQUENCES: for the general work rules the disqualification ladder is 1st failure = 1 month, 2nd = 3 months, 3rd = 6 months; someone excused because they work 30+ hours/week must not voluntarily quit or reduce hours. For Section 2, ABAWDs not working or excused can get CalFresh for only 3 months in the period the county fills in. REPORTING within 10 days: income over the IRT, substantial lottery/gambling winnings, and work hours dropping below 20/week or 80/month. GOOD REASON is invited on the form itself: 'Good reasons include things out of your control like illness, no childcare for a child younger than age 12, or work conditions that are unreasonable' — and 'If the county determines that you have a good reason, there will be no change to your CalFresh benefits.' The CF 886 is a Required Form, No Substitute Permitted, and the verbal plus written notice must be given BEFORE the time limit is applied — a CF 886 that was never issued is a real procedural defense. The companion screening form is the CF 377.11E.",
      "https://www.cdss.ca.gov/cdssweb/entres/forms/English/CF886.pdf",
    ),
  },
  {
    // A6 — QC element glossary. Answers "why was my case flagged on element 363?"
    // Numeric-only triggers are avoided: a bare "363" in a question is more often
    // a dollar amount than an element code.
    terms: [
      "element code", "element codes", "qc element", "error element", "which element",
      "flagged on element", "element 311", "element 363", "element 150", "element 161",
      "fns 380", "quality control element",
    ],
    curated: curatedAuthority(
      "FNS Handbook 310 (QC Review Handbook) — element codes; 7 CFR 275.12",
      "QC error element codes — what the number means",
      "Federal quality control codes each finding to an ELEMENT number (the FNS-380 taxonomy in FNS Handbook 310). Non-financial: 110 age, 111 student status, 130 citizenship/non-citizen status, 140 residency, 150 household composition, 151 recipient disqualification, 160 employment & training, 161 time-limited participation (the ABAWD clock), 162 work registration, 163 voluntary quit, 164 workfare, 165 employment status, 166 acceptance of employment, 170 SSN. Resources: the 200-299 band (222 vehicles, 225 combined resources). Earned income: 311 wages and salaries, 312 self-employment, 314 other earned income, 321 earned-income deduction, 323 dependent care. Unearned income: 331 RSDI, 332 veterans benefits, 333 SSI, 334 unemployment compensation, 335 workers' compensation, 342-347 other unearned, 350 child support received. Deductions: 361 standard deduction, 363 shelter, 364 standard utility allowance, 365 medical, 366 child-support deduction. In California's FY2023 QC data the largest error elements were 363 shelter and 311 wages, together about 61% of errored cases — which is why those two are where a pre-submission check pays off most. Note the element identifies WHERE the error was found, not who caused it; the separate agency/client responsibility coding answers that.",
      "https://www.fns.usda.gov/snap/quality-control",
    ),
  },
  {
    // A7 — negative-action validity. The federal backbone under the CalSAWS
    // reason-code-mismatch guardrail already in the system prompt.
    // NOTE on trigger scope: an earlier draft also matched "reason doesn't match"
    // and "wrong reason on the notice". Those hijacked questions about what a
    // notice must CONTAIN, which belong to 7 CFR 273.13 (notice of adverse
    // action) — the corpus answers those better. These triggers are scoped to
    // questions about whether an action is VALID, which 273.13 does not cover.
    terms: [
      "invalid denial", "invalid notice", "procedurally invalid", "is this denial valid",
      "was this denial proper", "negative action", "two different reasons",
      "conflicting reasons", "multiple reasons", "adequate notice", "notice not sent",
    ],
    curated: curatedAuthority(
      "FNS Handbook 310 §1310, §1350.2, §1360 — negative-action validity",
      "When a denial or termination is procedurally invalid",
      "Federal QC reviews every negative action (denial, termination, suspension) against five requirements. A VALID negative action must: (1) rest on a correct reason; (2) be documented in the case record — 'when the case record does not include documentation for the specific negative action under review, the action must be coded as invalid'; (3) be communicated in easily understandable language, in the household's preferred language; (4) be procedurally correct — every prerequisite step actually taken; and (5) be noticed timely. THE RULE THAT DECIDES MOST DISPUTES: if a notice lists MULTIPLE reasons, ALL of them must be accurate — a single wrong reason invalidates the whole action (§1350.2). So a denial notice that names a reason contradicted by the case record, or two notices for the same action giving different reasons, does not stand. Specific to missed interviews: a Notice of Missed Interview is REQUIRED before any negative action based on a missed interview (§1320), a NOMI issued AFTER the denial is invalid, and the county must have attempted contact at the number in the file and documented that attempt. For a caseworker: check the reason against the record before the notice goes out. For an applicant: these are the grounds a fair hearing turns on — and if a required notice was never sent at all, the appeal clock has not started.",
      "https://www.fns.usda.gov/snap/quality-control",
    ),
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
  const { k = 6, charBudget = 10_000, maxChunkChars = 3_500, minScore = DEFAULT_MIN_SCORE } = opts;
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
  for (const topic of [...EXTERNAL_TOPICS, ...CURATED_SUPPLEMENTS]) {
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
    "⚠️ SUPERSEDED IN PART by H.R.1 / OBBBA (Pub. L. 119-21, eff. 2025-07-04). The eCFR text below PREDATES the statute and is outdated on age and exemptions: the ABAWD time-limit age ceiling is now 64 (exempt only if under 18 or 65+) — the \"55 years of age or older\" exemption below is NO LONGER CURRENT; and the exemptions for veterans, people experiencing homelessness, and former foster youth were ELIMINATED (an exemption for Indian / Urban Indian / California Indian individuals was added). The 80-hour work definition is unchanged. Cite the statute / current FNS ABAWD memo for age and exemptions — do NOT quote this subsection as current. (California: statewide time limits resumed 2026-06-01 per CDSS ACL 25-93; only a few counties hold a waiver — confirm the specific county.)",
  "273.4":
    "⚠️ SUPERSEDED IN PART by H.R.1 / OBBBA (Pub. L. 119-21). The eligible non-citizen categories in the text below PREDATE the statute: eligibility was narrowed — refugees, asylees, and TPS holders were REMOVED. The current eligible set is U.S. nationals, LPRs, Cuban/Haitian entrants, and COFA migrants (FNS Alien Eligibility memo, 2025-10-31). Do not state refugee/asylee eligibility from this text as current.",
};

/** Format retrieved chunks as an authoritative source block for the prompt. */
export function formatRetrievedSources(chunks: RegChunk[]): string {
  if (chunks.length === 0) return "";
  const body = chunks
    .map((c) => {
      const warn = OBBBA_SUPERSEDED[c.section];
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
