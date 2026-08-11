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
  /** State pack the question routes through. Omitted = default (CA). Every
   *  state pack must contribute cases here — the framework's per-state gate
   *  requires ≥12, with ≥3 that must resolve to STATE authority. */
  state?: string;
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

  // ── Applicant-voiced companions to the FOIA cases above ─────────────────────
  // Every case above this line that came out of the 2026-07-23 FOIA production
  // (Error-avoidance, Work/ABAWD, Notices) was written caseworker-side — "my
  // client", "should I ask" — from when Mae served the dashboard staff chat.
  // Demeter's primary surface post-pivot is the public applicant chat, and
  // nobody re-voiced this content for the person actually typing it in. These
  // mirror the same FOIA facts/citations, first person, worried-and-confused
  // register instead of clinical.
  { id: "rights-oververify-onfile", category: "Applicant rights", question: "I already gave them my bank statements — why are they asking for them again?", expect: { kind: "external", citation: "273.2(f)" } },
  { id: "rights-failure-to-provide", category: "Applicant rights", question: "Can they deny me for not providing something I already sent them?", expect: { kind: "external", citation: "273.2(f)" } },
  { id: "rights-twn-first", category: "Applicant rights", question: "Do I have to send pay stubs if they can already look up my income electronically?", expect: { kind: "external", citation: "273.2(f)" } },
  { id: "rights-not-questionable", category: "Applicant rights", question: "Do I have to prove something on my application that they haven't said is a problem?", expect: { kind: "external", citation: "273.2(f)" } },
  { id: "rights-nomi-valid", category: "Applicant rights", question: "I did my interview, but I still got a letter saying I missed it — is that even allowed?", expect: { kind: "grounded", section: "273.2" } },
  { id: "rights-30day-deny", category: "Applicant rights", question: "My application is past the 30-day mark — can they still deny it for a missing document?", expect: { kind: "grounded", section: "273.2" } },
  { id: "rights-reapply-after-miss", category: "Applicant rights", question: "Nobody called me for my interview — do I have to start my application over?", expect: { kind: "grounded", section: "273.2" } },
  { id: "rights-noa-two-reasons", category: "Applicant rights", question: "My denial notice listed two different reasons and one of them is wrong — does the correct one save it?", expect: { kind: "external", citation: "FNS Handbook 310" } },
  { id: "rights-cf886-sanction", category: "Applicant rights", question: "I got a CF 886 letter in the mail — does that mean I'm losing my food stamps?", expect: { kind: "external", citation: "CF 886" } },
  { id: "rights-abawd-hours", category: "Applicant rights", question: "How many workfare hours do I owe to meet the work requirement?", expect: { kind: "external", citation: "273.24 (ABAWD)" } },

  // ── Washington pack (Wave 1 — first new state; framework gate: ≥12 cases) ──
  // All routed with state:"WA". The federal-floor control (wa-federal-benefit)
  // proves the pack does NOT hijack questions the federal corpus should answer.
  { id: "wa-program-name", category: "WA", question: "What is SNAP called in Washington and where do you apply online?", expect: { kind: "external", citation: "Basic Food" }, state: "WA" },
  { id: "wa-bbce-200", category: "WA", question: "What is the income limit for Basic Food categorical eligibility in Washington?", expect: { kind: "external", citation: "388-414-0001" }, state: "WA" },
  { id: "wa-asset-test", category: "WA", question: "Does a Basic Food household in Washington have an asset limit on savings?", expect: { kind: "external", citation: "388-470-0005" }, state: "WA" },
  { id: "wa-sua-values", category: "WA", question: "What are Washington's standard utility allowance amounts for Basic Food?", expect: { kind: "external", citation: "388-450-0195" }, state: "WA" },
  { id: "wa-sua-actual", category: "WA", question: "Can a Washington household claim their actual utility bills instead of the standard utility allowance?", expect: { kind: "external", citation: "388-450-0195" }, state: "WA" },
  { id: "wa-no-smd", category: "WA", question: "Does Washington have a standard medical deduction for elderly households?", expect: { kind: "external", citation: "388-450-0185" }, state: "WA" },
  { id: "wa-abawd-clock", category: "WA", question: "My Washington client used their three ABAWD months in 2024 — when does their clock reset?", expect: { kind: "external", citation: "388-444" }, state: "WA" },
  { id: "wa-abawd-waiver", category: "WA", question: "Is any part of Washington waived from the ABAWD time limit right now?", expect: { kind: "external", citation: "388-444" }, state: "WA" },
  { id: "wa-abawd-regain", category: "WA", question: "How does a Washington ABAWD regain eligibility after timing out?", expect: { kind: "external", citation: "388-444" }, state: "WA" },
  { id: "wa-mcr", category: "WA", question: "When is the mid-certification review due for a Washington Basic Food household?", expect: { kind: "external", citation: "388-418" }, state: "WA" },
  { id: "wa-esap-cert", category: "WA", question: "How long is the certification period for an elderly household in Washington under ESAP?", expect: { kind: "external", citation: "388-416" }, state: "WA" },
  { id: "wa-washcap", category: "WA", question: "My client gets SSI in Washington — do they need a separate food benefits interview?", expect: { kind: "external", citation: "388-492" }, state: "WA" },
  { id: "wa-heat-and-eat", category: "WA", question: "Does receiving LIHEAP qualify a Washington household for the full utility allowance?", expect: { kind: "external", citation: "388-450-0195" }, state: "WA" },
  { id: "wa-federal-benefit", category: "WA", question: "How is the monthly benefit amount calculated from net income?", expect: { kind: "grounded", section: "273.10" }, state: "WA" },

  // ── Texas pack (Wave 1, state two — the BBCE-with-asset-test state) ─────────
  { id: "tx-program-name", category: "TX", question: "What is SNAP called in Texas and where do you apply online?", expect: { kind: "external", citation: "SNAP Food Benefits" }, state: "TX" },
  { id: "tx-bbce-165", category: "TX", question: "What is the categorical eligibility income limit for SNAP in Texas?", expect: { kind: "external", citation: "A-1341" }, state: "TX" },
  { id: "tx-asset-under-bbce", category: "TX", question: "Does categorical eligibility remove the asset test for a Texas SNAP household?", expect: { kind: "external", citation: "A-1238" }, state: "TX" },
  { id: "tx-vehicle-rule", category: "TX", question: "How does Texas count a household's vehicle toward the SNAP resource limit?", expect: { kind: "external", citation: "A-1238" }, state: "TX" },
  { id: "tx-sua-values", category: "TX", question: "What are the Texas utility standard amounts for SNAP?", expect: { kind: "external", citation: "A-1429" }, state: "TX" },
  { id: "tx-sua-actual", category: "TX", question: "Can a Texas household deduct their actual utility bills instead of the standard?", expect: { kind: "external", citation: "A-1429" }, state: "TX" },
  { id: "tx-sme", category: "TX", question: "How does the standard medical deduction work for an elderly Texan on SNAP?", expect: { kind: "external", citation: "A-1428" }, state: "TX" },
  { id: "tx-abawd-clock", category: "TX", question: "When does the 36-month ABAWD clock start for a Texas client?", expect: { kind: "external", citation: "A-1910" }, state: "TX" },
  { id: "tx-abawd-cutover", category: "TX", question: "When did the new ABAWD age rules take effect in Texas?", expect: { kind: "external", citation: "A-1910" }, state: "TX" },
  { id: "tx-abawd-60-64", category: "TX", question: "Is a 62-year-old in Texas subject to the SNAP time limit or exempt from work rules?", expect: { kind: "external", citation: "A-1910" }, state: "TX" },
  { id: "tx-certs-sr", category: "TX", question: "How long is a streamlined reporting household certified for in Texas?", expect: { kind: "external", citation: "A-2324" }, state: "TX" },
  { id: "tx-tsap", category: "TX", question: "How does an elderly Texan get on the simplified TSAP application track?", expect: { kind: "external", citation: "B-477" }, state: "TX" },
  { id: "tx-expedited", category: "TX", question: "How fast can an expedited SNAP household in Texas get benefits?", expect: { kind: "external", citation: "A-140" }, state: "TX" },
  { id: "tx-federal-benefit", category: "TX", question: "How is the monthly benefit amount calculated from net income?", expect: { kind: "grounded", section: "273.10" }, state: "TX" },
  // --- New York (Wave 1, state three — three BBCE tiers + the NYC county layer) ---
  { id: "ny-program-name", category: "NY", question: "Who runs SNAP in New York and where do I apply?", expect: { kind: "external", citation: "OTDA" }, state: "NY" },
  { id: "ny-nyc-portal", category: "NY", question: "I live in Brooklyn — do I use myBenefits to apply for SNAP?", expect: { kind: "external", citation: "ACCESS HRA" }, state: "NY" },
  { id: "ny-income-earned", category: "NY", question: "What's the SNAP income limit in New York if I have a job?", expect: { kind: "external", citation: "16-ADM-06" }, state: "NY" },
  { id: "ny-income-elderly", category: "NY", question: "My mom is 68 — what income limit applies to her New York SNAP application?", expect: { kind: "external", citation: "GIS 25DC059" }, state: "NY" },
  { id: "ny-asset-test", category: "NY", question: "Do I have to be under a savings limit to get SNAP in New York?", expect: { kind: "external", citation: "07-ADM-09" }, state: "NY" },
  { id: "ny-sua-regional", category: "NY", question: "What's the utility allowance for SNAP in the Bronx compared to upstate New York?", expect: { kind: "external", citation: "GIS 25DC059" }, state: "NY" },
  { id: "ny-heat-and-eat", category: "NY", question: "Does getting HEAP still qualify me for the bigger heating utility allowance in New York?", expect: { kind: "external", citation: "GIS 25DC061" }, state: "NY" },
  { id: "ny-child-support", category: "NY", question: "I pay child support — does that lower the income New York counts for SNAP?", expect: { kind: "external", citation: "§13" }, state: "NY" },
  { id: "ny-abawd-window", category: "NY", question: "When does the ABAWD 36-month clock start and end in New York?", expect: { kind: "external", citation: "25-ADM-03" }, state: "NY" },
  { id: "ny-abawd-waiver", category: "NY", question: "Is the SNAP work-requirement time limit waived anywhere in New York right now?", expect: { kind: "external", citation: "GIS 26DC012" }, state: "NY" },
  { id: "ny-esap", category: "NY", question: "Is there a simplified SNAP application track for seniors in New York?", expect: { kind: "external", citation: "GIS 21DC079" }, state: "NY" },
  { id: "ny-expedited", category: "NY", question: "How fast can I get emergency SNAP benefits in New York?", expect: { kind: "external", citation: "387.8" }, state: "NY" },
  { id: "ny-periodic-report", category: "NY", question: "Do I have to send in a report in the middle of my SNAP certification period in New York?", expect: { kind: "external", citation: "387.17" }, state: "NY" },
  { id: "ny-federal-benefit", category: "NY", question: "How is the monthly benefit amount calculated from net income?", expect: { kind: "grounded", section: "273.10" }, state: "NY" },
  // --- Georgia (Wave 2, state one — the BBCE asset-relief-only case) ---
  { id: "ga-program-name", category: "GA", question: "Who runs food stamps in Georgia and where do I apply?", expect: { kind: "external", citation: "DFCS" }, state: "GA" },
  { id: "ga-gateway", category: "GA", question: "Can I apply for SNAP online in Georgia?", expect: { kind: "external", citation: "Georgia Gateway" }, state: "GA" },
  { id: "ga-income-limit", category: "GA", question: "What's the gross income limit for SNAP in Georgia?", expect: { kind: "external", citation: "3210" }, state: "GA" },
  { id: "ga-elderly-200", category: "GA", question: "My retired parents are over the normal income limit — can they still get SNAP in Georgia?", expect: { kind: "external", citation: "3210" }, state: "GA" },
  { id: "ga-vehicle", category: "GA", question: "Will my car count against me for food stamps in Georgia?", expect: { kind: "external", citation: "3405" }, state: "GA" },
  { id: "ga-sua", category: "GA", question: "What's the utility allowance for SNAP in Georgia?", expect: { kind: "external", citation: "3617" }, state: "GA" },
  { id: "ga-smd", category: "GA", question: "Is there a standard medical deduction for seniors on SNAP in Georgia?", expect: { kind: "external", citation: "3614" }, state: "GA" },
  { id: "ga-child-support", category: "GA", question: "I pay child support — does Georgia count that against my SNAP income?", expect: { kind: "external", citation: "3616" }, state: "GA" },
  { id: "ga-abawd-window", category: "GA", question: "When does the ABAWD 36-month clock start and end in Georgia?", expect: { kind: "external", citation: "3355" }, state: "GA" },
  { id: "ga-abawd-waiver", category: "GA", question: "Is the SNAP work-requirement time limit waived anywhere in Georgia?", expect: { kind: "external", citation: "3355" }, state: "GA" },
  { id: "ga-senior-snap", category: "GA", question: "Is there a simplified SNAP application track for seniors in Georgia?", expect: { kind: "external", citation: "3725" }, state: "GA" },
  { id: "ga-expedited", category: "GA", question: "How fast can I get emergency food stamps in Georgia?", expect: { kind: "external", citation: "3110" }, state: "GA" },
  { id: "ga-periodic-report", category: "GA", question: "Do I still have to send in the periodic report for my Georgia SNAP case?", expect: { kind: "external", citation: "3730" }, state: "GA" },
  { id: "ga-federal-benefit", category: "GA", question: "How is the monthly benefit amount calculated from net income?", expect: { kind: "grounded", section: "273.10" }, state: "GA" },
  // --- Michigan (Wave 2 — the table-not-rule-text SUA case; DVPS-conferred BBCE) ---
  { id: "mi-program-name", category: "MI", question: "Who runs food assistance in Michigan and where do I apply?", expect: { kind: "external", citation: "MDHHS" }, state: "MI" },
  { id: "mi-portal", category: "MI", question: "Can I apply for FAP online in Michigan?", expect: { kind: "external", citation: "MI Bridges" }, state: "MI" },
  { id: "mi-income-limit", category: "MI", question: "What's the income limit for FAP in Michigan?", expect: { kind: "external", citation: "BEM 213" }, state: "MI" },
  { id: "mi-cat-elig-dvps", category: "MI", question: "I got help with a utility bill from Michigan DHS — does that change my SNAP income limit?", expect: { kind: "external", citation: "BEM 213" }, state: "MI" },
  { id: "mi-vehicle", category: "MI", question: "Will my car count against me for food assistance in Michigan?", expect: { kind: "external", citation: "BEM 400" }, state: "MI" },
  { id: "mi-sua", category: "MI", question: "What's the heat and utility standard for FAP in Michigan?", expect: { kind: "external", citation: "RFT 255" }, state: "MI" },
  { id: "mi-smd", category: "MI", question: "Is there a standard medical deduction for seniors on FAP in Michigan?", expect: { kind: "external", citation: "BEM 554" }, state: "MI" },
  { id: "mi-child-support", category: "MI", question: "Do I have to cooperate with child support enforcement to get FAP in Michigan?", expect: { kind: "external", citation: "BEM 255" }, state: "MI" },
  { id: "mi-abawd-window", category: "MI", question: "When does the ABAWD/TLFA 36-month clock start and end in Michigan?", expect: { kind: "external", citation: "BEM 620" }, state: "MI" },
  { id: "mi-abawd-waiver", category: "MI", question: "Is the SNAP work-requirement time limit waived anywhere in Michigan?", expect: { kind: "external", citation: "BEM 620" }, state: "MI" },
  { id: "mi-restaurant-meals", category: "MI", question: "Can I use my Bridge Card to buy a hot meal at a restaurant in Michigan?", expect: { kind: "external", citation: "BAM 119" }, state: "MI" },
  { id: "mi-expedited", category: "MI", question: "How fast can I get emergency food assistance in Michigan?", expect: { kind: "external", citation: "BAM 117" }, state: "MI" },
  { id: "mi-simplified-reporting", category: "MI", question: "Do I have to report every income change during my Michigan FAP certification period?", expect: { kind: "external", citation: "BAM 200" }, state: "MI" },
  { id: "mi-federal-benefit", category: "MI", question: "How is the monthly benefit amount calculated from net income?", expect: { kind: "grounded", section: "273.10" }, state: "MI" },
  // --- Illinois (Wave 2 — two-tier BBCE screen, 4-tier SUA, an engine bug found + fixed along the way) ---
  { id: "il-program-name", category: "IL", question: "What agency runs SNAP in Illinois and where do I apply?", expect: { kind: "external", citation: "ABE" }, state: "IL" },
  { id: "il-income-limit", category: "IL", question: "What's the income limit for SNAP in Illinois?", expect: { kind: "external", citation: "WAG 13-01-01-a" }, state: "IL" },
  { id: "il-qualifying-member-screen", category: "IL", question: "My mother is 62 and lives with us — does that change our SNAP income limit in Illinois?", expect: { kind: "external", citation: "PM 05-07-00" }, state: "IL" },
  { id: "il-asset-limit", category: "IL", question: "Is there an asset or savings limit for SNAP in Illinois?", expect: { kind: "external", citation: "PM 07-04-01" }, state: "IL" },
  { id: "il-sua", category: "IL", question: "What's the utility allowance for SNAP in Illinois?", expect: { kind: "external", citation: "WAG 13-01-08-b" }, state: "IL" },
  { id: "il-smd", category: "IL", question: "Is there a standard medical deduction for seniors on SNAP in Illinois?", expect: { kind: "external", citation: "PM 13-01-05" }, state: "IL" },
  { id: "il-child-support", category: "IL", question: "Does paying child support lower my countable income for SNAP in Illinois?", expect: { kind: "external", citation: "PM 13-01-07" }, state: "IL" },
  { id: "il-abawd-waiver", category: "IL", question: "Is the SNAP work-requirement time limit waived anywhere in Illinois right now?", expect: { kind: "external", citation: "PM 03-16-00" }, state: "IL" },
  { id: "il-drug-felony", category: "IL", question: "I have a drug felony conviction — can I still get SNAP in Illinois?", expect: { kind: "external", citation: "305 ILCS 5/1-10" }, state: "IL" },
  { id: "il-restaurant-meals", category: "IL", question: "Can I use my Illinois Link card to buy a hot meal at a restaurant?", expect: { kind: "external", citation: "PM 06-32-00" }, state: "IL" },
  { id: "il-expedited", category: "IL", question: "How fast can I get emergency SNAP benefits in Illinois?", expect: { kind: "external", citation: "PM 02-08-00" }, state: "IL" },
  { id: "il-cert-period", category: "IL", question: "How long does my SNAP approval last in Illinois before I have to redo it?", expect: { kind: "external", citation: "PM 17-05-02" }, state: "IL" },
  { id: "il-federal-benefit", category: "IL", question: "How is the monthly benefit amount calculated from net income?", expect: { kind: "grounded", section: "273.10" }, state: "IL" },
  // --- Florida (Wave 2 — flat 200% BBCE, 3-tier SUA mid-revision, engine RMP check confirmed correct, ABAWD-waiver + a bonus WA finding both flagged) ---
  { id: "fl-program-name", category: "FL", question: "What agency runs SNAP in Florida and where do I apply?", expect: { kind: "external", citation: "MyACCESS" }, state: "FL" },
  { id: "fl-income-limit", category: "FL", question: "What's the income limit for SNAP in Florida?", expect: { kind: "external", citation: "FS 2010.0201" }, state: "FL" },
  { id: "fl-asset-limit", category: "FL", question: "Is there an asset or savings limit for SNAP in Florida?", expect: { kind: "external", citation: "FS 1610.0200" }, state: "FL" },
  { id: "fl-sua", category: "FL", question: "What's the standard utility allowance for SNAP in Florida?", expect: { kind: "external", citation: "FS 2410.0344" }, state: "FL" },
  { id: "fl-medical-deduction", category: "FL", question: "I'm disabled and have medical bills — do I get a deduction for SNAP in Florida?", expect: { kind: "external", citation: "FS 2410.0353" }, state: "FL" },
  { id: "fl-child-support", category: "FL", question: "Does paying child support lower my countable income for SNAP in Florida?", expect: { kind: "external", citation: "FS 2410.0329" }, state: "FL" },
  { id: "fl-abawd-waiver", category: "FL", question: "Is the SNAP work-requirement time limit waived anywhere in Florida right now?", expect: { kind: "external", citation: "DCF ABAWD FAQ" }, state: "FL" },
  { id: "fl-drug-felony", category: "FL", question: "I have a drug felony conviction — can I still get SNAP in Florida?", expect: { kind: "external", citation: "Fla. Stat. § 414.095" }, state: "FL" },
  { id: "fl-restaurant-meals", category: "FL", question: "Can I use my EBT card to buy a hot meal at a restaurant in Florida?", expect: { kind: "external", citation: "Restaurant Meals Program" }, state: "FL" },
  { id: "fl-expedited", category: "FL", question: "How fast can I get emergency SNAP benefits in Florida?", expect: { kind: "external", citation: "FS 0610.0102" }, state: "FL" },
  { id: "fl-cert-period", category: "FL", question: "How long does my SNAP approval last in Florida before I have to redo it?", expect: { kind: "external", citation: "FS 0810.0400" }, state: "FL" },
  { id: "fl-federal-benefit", category: "FL", question: "How is the monthly benefit amount calculated from net income?", expect: { kind: "grounded", section: "273.10" }, state: "FL" },
  // --- Massachusetts (Wave 2 — the two-cycle freshness case; resolved a prior SUA verification gap and two engine-comment errors along the way) ---
  { id: "ma-program-name", category: "MA", question: "What agency runs SNAP in Massachusetts and where do I apply?", expect: { kind: "external", citation: "What is SNAP?" }, state: "MA" },
  { id: "ma-income-limit", category: "MA", question: "What's the income limit for SNAP in Massachusetts?", expect: { kind: "external", citation: "106 CMR 364.976" }, state: "MA" },
  { id: "ma-asset-limit", category: "MA", question: "Is there an asset or savings limit for SNAP in Massachusetts?", expect: { kind: "external", citation: "Assets Overview - SNAP" }, state: "MA" },
  { id: "ma-sua", category: "MA", question: "What's the standard utility allowance for SNAP in Massachusetts?", expect: { kind: "external", citation: "106 CMR 364.945" }, state: "MA" },
  { id: "ma-smd", category: "MA", question: "Is there a standard medical deduction for seniors on SNAP in Massachusetts?", expect: { kind: "external", citation: "106 CMR 364.500" }, state: "MA" },
  { id: "ma-child-support", category: "MA", question: "Does paying child support lower my SNAP benefit in Massachusetts?", expect: { kind: "external", citation: "106 CMR 364.500" }, state: "MA" },
  { id: "ma-abawd-waiver", category: "MA", question: "Is the SNAP work-requirement time limit currently waived anywhere in Massachusetts?", expect: { kind: "external", citation: "OLGT 2025-31" }, state: "MA" },
  { id: "ma-drug-felony", category: "MA", question: "I have a drug felony conviction — can I still get SNAP in Massachusetts?", expect: { kind: "external", citation: "OLGT 2024-45" }, state: "MA" },
  { id: "ma-restaurant-meals", category: "MA", question: "Can I use my EBT card to buy a hot meal at a restaurant in Massachusetts?", expect: { kind: "external", citation: "OLGT 2023-85" }, state: "MA" },
  { id: "ma-expedited", category: "MA", question: "How fast can I get emergency SNAP benefits in Massachusetts?", expect: { kind: "external", citation: "Screening for Expedited Service" }, state: "MA" },
  { id: "ma-cert-period", category: "MA", question: "How long does my SNAP approval last in Massachusetts before I have to recertify?", expect: { kind: "external", citation: "Simplified Reporting - Overview" }, state: "MA" },
  { id: "ma-federal-benefit", category: "MA", question: "How is the monthly benefit amount calculated from net income?", expect: { kind: "grounded", section: "273.10" }, state: "MA" },

  // Nevada — 8th verified state (docs/plans/mae-state-corpus-framework.md, Wave 2).
  { id: "nv-program-name", category: "NV", question: "What agency runs SNAP in Nevada and where do I apply?", expect: { kind: "external", citation: "Access Nevada" }, state: "NV" },
  { id: "nv-income-limit", category: "NV", question: "What's the income limit for SNAP in Nevada?", expect: { kind: "external", citation: "C-210.1" }, state: "NV" },
  { id: "nv-expanded-cat-elig", category: "NV", question: "Is there a higher income limit for SNAP in Nevada if I'm categorically eligible?", expect: { kind: "external", citation: "A-180.2" }, state: "NV" },
  { id: "nv-asset-limit", category: "NV", question: "Is there an asset or savings limit for SNAP in Nevada?", expect: { kind: "external", citation: "A-520" }, state: "NV" },
  { id: "nv-vehicle", category: "NV", question: "Does my car count against me for SNAP in Nevada?", expect: { kind: "external", citation: "A-550" }, state: "NV" },
  { id: "nv-sua", category: "NV", question: "What's the utility allowance for SNAP in Nevada?", expect: { kind: "external", citation: "A-660.5.1.1" }, state: "NV" },
  { id: "nv-medical-deduction", category: "NV", question: "Is there a standard medical deduction for seniors on SNAP in Nevada?", expect: { kind: "external", citation: "A-660.3" }, state: "NV" },
  { id: "nv-child-support", category: "NV", question: "Does paying child support lower my countable income for SNAP in Nevada?", expect: { kind: "external", citation: "A-660.4" }, state: "NV" },
  { id: "nv-abawd-waiver", category: "NV", question: "Is the SNAP work-requirement time limit waived anywhere in Nevada right now?", expect: { kind: "external", citation: "B-472" }, state: "NV" },
  { id: "nv-drug-felony", category: "NV", question: "I have a drug felony conviction — can I still get SNAP in Nevada?", expect: { kind: "external", citation: "NRS 422A.345" }, state: "NV" },
  { id: "nv-expedited", category: "NV", question: "How fast can I get emergency SNAP benefits in Nevada?", expect: { kind: "external", citation: "A-141" }, state: "NV" },
  { id: "nv-cert-period", category: "NV", question: "How long does my SNAP approval last in Nevada before I have to redo it?", expect: { kind: "external", citation: "A-1823.2" }, state: "NV" },
  { id: "nv-federal-benefit", category: "NV", question: "How is the monthly benefit amount calculated from net income?", expect: { kind: "grounded", section: "273.10" }, state: "NV" },
];
