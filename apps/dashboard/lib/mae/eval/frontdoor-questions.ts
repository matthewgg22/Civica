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

  // ── Caseworker error-avoidance (from CDSS ME reports, FOIA 2026-07-23) ──────
  // The most common documented CalFresh errors, turned into questions so we can
  // measure that Mae surfaces the right authority (esp. the anti-over-verification
  // supplement) instead of coaching the caseworker into the documented mistake.
  { id: "err-oververify-onfile", category: "Error-avoidance", question: "The household already submitted pay stubs last week — do I need to request them again?", expect: { kind: "external", citation: "273.2(f)" } },
  { id: "err-failure-to-provide", category: "Error-avoidance", question: "Can I deny for failure to provide verification the household already provided?", expect: { kind: "external", citation: "273.2(f)" } },
  { id: "err-twn-first", category: "Error-avoidance", question: "Should I ask the household for income proof before I check The Work Number?", expect: { kind: "external", citation: "273.2(f)" } },
  { id: "err-not-questionable", category: "Error-avoidance", question: "Do I have to verify something that isn't required and isn't questionable?", expect: { kind: "external", citation: "273.2(f)" } },
  { id: "err-expedited-timeframe", category: "Error-avoidance", question: "The applicant qualifies for expedited service — what's my timeframe to act?", expect: { kind: "grounded", section: "273.2" } },
  { id: "err-30day-deny", category: "Error-avoidance", question: "The application is past the 30-day mark — can I still deny it for a missing document?", expect: { kind: "grounded", section: "273.2" } },
  { id: "err-nomi-valid", category: "Error-avoidance", question: "The client completed their interview but a Notice of Missed Interview still went out — is that valid?", expect: { kind: "grounded", section: "273.2" } },
  { id: "err-student-exempt", category: "Error-avoidance", question: "The application was denied without exploring the student eligibility exemptions — is that an error?", expect: { kind: "grounded", section: "273.5" } },
  { id: "err-noa-reason-mismatch", category: "Error-avoidance", question: "The client got a confusing adverse-action notice whose stated reason doesn't match what actually happened — what governs the notice?", expect: { kind: "grounded", section: "273.13" } },
  { id: "err-address-report", category: "Error-avoidance", question: "The household reported a change of address — what changes must I act on and when?", expect: { kind: "grounded", section: "273.12" } },
  { id: "err-denied-cooperate", category: "Error-avoidance", question: "My client was denied for failure to cooperate but sent everything — how do they challenge it?", expect: { kind: "grounded", section: "273.15" } },
  { id: "err-restore-wrongful", category: "Error-avoidance", question: "A household was wrongly denied and lost a month of benefits — can those be restored?", expect: { kind: "grounded", section: "273.17" } },

  // ── ABAWD 2026 — California specifics (H.R.1/OBBBA; FOIA 2026-07-23) ─────────
  // The eCFR 273.24 text is stale on age/exemptions, so these must surface the
  // section WITH the superseded warning (not quote the outdated subsection).
  { id: "abawd-ca-effective", category: "Work/ABAWD", question: "When does California actually start applying the ABAWD three-month time limit and screening households?", expect: { kind: "superseded", section: "273.24" } },
  { id: "abawd-child-under-14", category: "Work/ABAWD", question: "My client has a 15-year-old at home — are they still exempt from the ABAWD time limit?", expect: { kind: "superseded", section: "273.24" } },
  { id: "abawd-62-work-reg", category: "Work/ABAWD", question: "Does the ABAWD time limit apply to a 62-year-old on my caseload now?", expect: { kind: "superseded", section: "273.24" } },

  // ── Adversarial: must NOT coach the caseworker into over-verifying ──────────
  // Each question tempts a "request more / to be safe" answer; retrieval must
  // surface the verification-limits supplement so Mae steers away from it.
  { id: "adv-ask-again-safe", category: "Error-avoidance", question: "They already gave me bank statements at intake — should I ask again just to be safe?", expect: { kind: "external", citation: "273.2(f)" } },
  { id: "adv-verify-not-questionable", category: "Error-avoidance", question: "To be thorough, should I verify the rent even though nothing about it is questionable?", expect: { kind: "external", citation: "273.2(f)" } },
  { id: "adv-more-proof-onfile", category: "Error-avoidance", question: "Can I hold the case and require more proof of income even though it's already on file?", expect: { kind: "external", citation: "273.2(f)" } },

  // ── ABAWD clock / workfare / unfitness (corrected facts, issue #584) ────────
  // The eCFR 273.24 text is stale and simply does not contain these rules (the CA
  // fixed-clock reset, the workfare formula, the post-OBBBA unfitness standard), so
  // the CURATED current-rules authority must LEAD — `external`, not `superseded`.
  { id: "abawd-used-my-months", category: "Work/ABAWD", question: "My client already used their 3 countable months back in 2024 — are they out of luck now?", expect: { kind: "external", citation: "273.24 (ABAWD)" } },
  { id: "abawd-workfare-hours", category: "Work/ABAWD", question: "How many workfare hours does a household owe to meet the work requirement?", expect: { kind: "external", citation: "273.24 (ABAWD)" } },
  { id: "abawd-obviously-unfit", category: "Work/ABAWD", question: "My client is homeless and has a health condition — can they be found unfit for work without a doctor's form?", expect: { kind: "external", citation: "273.24 (ABAWD)" } },
  { id: "abawd-regain", category: "Work/ABAWD", question: "My client exhausted their months, then worked a month and got laid off — can they get benefits back?", expect: { kind: "external", citation: "273.24 (ABAWD)" } },

  // ── Notice decoding + QC vocabulary (#585) ──────────────────────────────────
  // None of these are answerable from the 7 CFR corpus: the CF 886 is a
  // California county form, and the element codes / negative-action standard
  // live in the FNS QC handbook. The curated authority must lead.
  { id: "notice-cf886-sanction", category: "Notices", question: "My client got a CF 886 in the mail — does that mean they're being sanctioned?", expect: { kind: "external", citation: "CF 886" } },
  { id: "notice-cf886-ladder", category: "Notices", question: "Client failed the general work rules a second time — how long is the disqualification?", expect: { kind: "external", citation: "CF 886" } },
  { id: "qc-element-363", category: "Notices", question: "QC flagged our case on element 363 — what is that?", expect: { kind: "external", citation: "FNS Handbook 310" } },
  { id: "notice-two-reasons", category: "Notices", question: "The denial notice listed two different reasons and one of them is wrong — does the correct one save it?", expect: { kind: "external", citation: "FNS Handbook 310" } },
  { id: "notice-invalid-denial", category: "Notices", question: "What makes a denial procedurally invalid on review?", expect: { kind: "external", citation: "FNS Handbook 310" } },
];
