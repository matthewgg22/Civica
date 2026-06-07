// Front-door evaluation set — the real "do I even qualify / how does this work"
// questions caseworkers and applicants actually ask, grouped as they come up at
// intake. Each item records the EXPECTED grounding so we can measure whether
// Mae's reference layer surfaces the right authority (and flag where it can't).
//
// `expect` kinds:
//   grounded   — federal SNAP question; retrieval should surface `section`.
//   superseded — section is in the corpus but the verbatim eCFR text predates
//                H.R.1/OBBBA; retrieval must surface it WITH the superseded
//                warning so Mae states the current rule, not the stale text.
//   defer      — not answerable from the USDA 7 CFR corpus (different agency/title,
//                a state option, or operational). Mae should defer/caveat, not
//                cite a federal section as if it covered it. `reason` documents why.
//
// This is the scaffold for a measured eval: today it scores RETRIEVAL grounding
// (no API key needed); once Mae is activated, the same set feeds an answer-quality
// + citation-accuracy LLM eval.

export type FrontDoorExpectation =
  | { kind: "grounded"; section: string }
  | { kind: "superseded"; section: string }
  | { kind: "external"; citation: string } // correct authority is a curated non-7-CFR-273 cite
  | { kind: "defer"; reason: string };

export interface FrontDoorCase {
  id: string;
  category: string;
  question: string;
  expect: FrontDoorExpectation;
}

export const FRONTDOOR_EVAL: FrontDoorCase[] = [
  // ── Eligibility / "do I even qualify" ──────────────────────────────────────
  { id: "elig-net-vs-gross", category: "Eligibility", question: "Do I make too much to qualify for SNAP?", expect: { kind: "grounded", section: "273.9" } },
  { id: "elig-what-is-income", category: "Eligibility", question: "What counts as income for SNAP — does SSI or child support received count?", expect: { kind: "grounded", section: "273.9" } },
  { id: "elig-assets", category: "Eligibility", question: "Do my savings, car, or house disqualify me?", expect: { kind: "grounded", section: "273.8" } },
  { id: "elig-cat-elig", category: "Eligibility", question: "I already get TANF and SSI — do I qualify automatically (categorical eligibility)?", expect: { kind: "grounded", section: "273.2" } },
  { id: "elig-how-much", category: "Eligibility", question: "How much SNAP will I actually get — what is the maximum allotment by household size?", expect: { kind: "grounded", section: "273.10" } },

  // ── Immigration & mixed-status ─────────────────────────────────────────────
  { id: "imm-public-charge", category: "Immigration", question: "Will applying for SNAP hurt my immigration status or count as public charge?", expect: { kind: "external", citation: "8 CFR 212.21" } },
  { id: "imm-citizen-kids", category: "Immigration", question: "I'm undocumented — can I apply for my U.S.-citizen kids (mixed-status household)?", expect: { kind: "grounded", section: "273.11" } },
  { id: "imm-ssn", category: "Immigration", question: "Do I have to give a Social Security Number for everyone in the household?", expect: { kind: "grounded", section: "273.6" } },
  { id: "imm-lpr-5yr", category: "Immigration", question: "I'm a lawful permanent resident — am I eligible, and what about the five-year bar?", expect: { kind: "superseded", section: "273.4" } },
  { id: "imm-ice-confidentiality", category: "Immigration", question: "Will ICE or immigration find out if I apply for SNAP?", expect: { kind: "grounded", section: "272.1" } },

  // ── Work requirements & ABAWD (H.R.1 changed these) ────────────────────────
  { id: "abawd-lose-june", category: "Work/ABAWD", question: "Am I subject to the work requirement — will I lose SNAP after three months starting June 2026?", expect: { kind: "superseded", section: "273.24" } },
  { id: "abawd-age", category: "Work/ABAWD", question: "I'm 60 — does the ABAWD time limit apply to me now?", expect: { kind: "superseded", section: "273.24" } },
  { id: "abawd-vet-homeless-foster", category: "Work/ABAWD", question: "I'm a veteran / homeless / aged out of foster care — aren't I exempt from the time limit?", expect: { kind: "superseded", section: "273.24" } },
  { id: "abawd-80-hours", category: "Work/ABAWD", question: "What counts toward my 80 hours a month for the work requirement?", expect: { kind: "superseded", section: "273.24" } },
  { id: "abawd-medically-unfit", category: "Work/ABAWD", question: "I have a health condition but no formal disability — am I exempt from the time limit?", expect: { kind: "superseded", section: "273.24" } },

  // ── Self-employment & non-standard income ──────────────────────────────────
  { id: "se-gig", category: "Self-employment", question: "I drive for Uber and do gig work — how do I report self-employment income?", expect: { kind: "grounded", section: "273.11" } },
  { id: "se-variable", category: "Self-employment", question: "My income changes every month — what income do I put down?", expect: { kind: "grounded", section: "273.10" } },
  { id: "se-deductions", category: "Self-employment", question: "What expenses can I deduct from my SNAP income?", expect: { kind: "grounded", section: "273.9" } },

  // ── Documents & verification ───────────────────────────────────────────────
  { id: "doc-what", category: "Documents", question: "What documents do I need to bring to apply for SNAP?", expect: { kind: "grounded", section: "273.2" } },
  { id: "doc-missing", category: "Documents", question: "I don't have a pay stub or ID — can I still apply?", expect: { kind: "grounded", section: "273.2" } },
  { id: "doc-expedited", category: "Documents", question: "I have nothing and need food now — how fast can I get SNAP (expedited)?", expect: { kind: "grounded", section: "273.2" } },

  // ── Application & interview mechanics ───────────────────────────────────────
  { id: "mech-interview", category: "Mechanics", question: "How does the SNAP interview work and what will they ask?", expect: { kind: "grounded", section: "273.2" } },
  { id: "mech-account-vs-apply", category: "Mechanics", question: "I created a BenefitsCal account — does that mean I applied?", expect: { kind: "defer", reason: "Portal mechanics are operational (BenefitsCal), not a federal regulation." } },
  { id: "mech-status", category: "Mechanics", question: "Where's my application — has it been processed yet?", expect: { kind: "defer", reason: "Status-checking is operational casework; 273.2(g) sets timeliness but not portal status." } },
  { id: "mech-auth-rep", category: "Mechanics", question: "Can you fill out and submit the application for me (authorized representative)?", expect: { kind: "grounded", section: "273.2" } },

  // ── Keeping benefits ───────────────────────────────────────────────────────
  { id: "keep-reporting", category: "Keeping benefits", question: "What changes do I have to report, and when — including ones that raise my benefit?", expect: { kind: "grounded", section: "273.12" } },
  { id: "keep-notice", category: "Keeping benefits", question: "I got a confusing notice and my benefits dropped — what happened?", expect: { kind: "grounded", section: "273.13" } },
  { id: "keep-recert", category: "Keeping benefits", question: "When do I have to recertify, and what happens if I miss it?", expect: { kind: "grounded", section: "273.14" } },
  { id: "keep-ebt", category: "Keeping benefits", question: "My EBT card or balance has a problem — who do I call?", expect: { kind: "external", citation: "EBT" } },
];
