// The questions the APPLICATION asks — and what they actually mean.
//
// People don't arrive at Demeter with a policy question. They arrive stuck on
// a specific line of a specific form: "purchase and prepare meals separately",
// "fleeing felon", "expedited service". That phrasing is bureaucratic and, to
// someone who has never seen it, genuinely undecipherable — which is exactly
// the moment they abandon the application.
//
// These entries do two jobs:
//
//   1. RETRIEVAL. Pasted form language routes to the regulation that governs
//      it, so "what does purchase and prepare separately mean" lands on
//      7 CFR 273.1 instead of guessing.
//   2. CLASSIFICATION. Each entry carries a topic, which is what the
//      confusion readout counts — so we learn WHICH form questions stop
//      people, in aggregate, without storing what anyone typed.
//
// Scope note: these are FEDERAL. Every state application asks them because
// 7 CFR 273.2 requires the underlying determination; only the wording moves.
// State-specific phrasing belongs in that state's pack, not here.

export interface FormQuestion {
  /** Stable id, also the analytics topic key. */
  topic: string;
  /** How the form (or the applicant) is likely to phrase it. Matched loosely. */
  phrasings: string[];
  /** The rule that decides it. */
  citation: string;
  /** Why the form is asking — one sentence, plain. */
  whyAsked: string;
}

export const FORM_QUESTIONS: FormQuestion[] = [
  {
    topic: "household_composition",
    phrasings: [
      "purchase and prepare",
      "buy and fix food together",
      "prepare meals separately",
      "eat together",
      "who is in your household",
      "do you share meals",
    ],
    citation: "7 CFR 273.1",
    whyAsked:
      "It decides who counts as one SNAP household. People who buy and prepare food together apply as one household even if they aren't related — and that changes both the income limit and the benefit.",
  },
  {
    topic: "homelessness",
    phrasings: ["experiencing homelessness", "are you homeless", "no permanent address", "shelter tonight"],
    citation: "7 CFR 273.9(d)(6)(i)",
    whyAsked:
      "Homelessness is not a disqualifier — it can raise your benefit. A household without stable housing may take a homeless shelter deduction instead of proving actual shelter costs, and you can get SNAP with no fixed address.",
  },
  {
    topic: "utility_costs",
    phrasings: [
      "heating or cooling separately",
      "pay for utilities separate from rent",
      "utility allowance",
      "do you pay a separate gas or electric bill",
      "energy assistance",
    ],
    citation: "7 CFR 273.9(d)(6)(iii)",
    whyAsked:
      "Paying any heating or cooling cost separately from rent usually qualifies you for the full standard utility allowance — often the single largest deduction on the application, and one people skip because they think it needs receipts.",
  },
  {
    topic: "student_status",
    phrasings: [
      "enrolled at least half time",
      "are you a student",
      "attending college",
      "half-time student",
      "higher education",
    ],
    citation: "7 CFR 273.5",
    whyAsked:
      "Only students enrolled at least half-time in higher education face the extra student rules — and even then many exemptions apply (working 20 hours, caring for a child, work-study, E&T programs). Part-time and high-school students are not covered by them at all.",
  },
  {
    topic: "expedited_service",
    phrasings: [
      "expedited service",
      "emergency food",
      "need food right away",
      "less than $150",
      "seven days",
      "how fast",
    ],
    citation: "7 CFR 273.2(i)",
    whyAsked:
      "This screens you for benefits within 7 days. Very low income and resources, or housing costs above your income, can qualify you — and the agency has to screen every application for it whether or not you ask.",
  },
  {
    topic: "missed_interview",
    phrasings: [
      "missed my interview",
      "missed the interview",
      "notice of missed interview",
      "a nomi letter",
      "nomi notice",
      "nobody called me for my interview",
      "no one called for my interview",
      "did i lose my application because i missed the call",
      "reschedule my interview",
      "they said i have to reapply",
    ],
    citation: "7 CFR 273.2(e)(3)",
    whyAsked:
      "A missed call is not an automatic denial. The county has to send you a written notice and give you until day 30 from your application date to reschedule — and if that notice never came, or came after the interview already happened, the denial doesn't hold up. You don't have to reapply; you can call to reschedule.",
  },
  {
    topic: "repeat_verification",
    phrasings: [
      "they asked for documents i already sent",
      "asked me to prove it again",
      "why do i need to send this again",
      "already gave them this",
      "denied for failure to provide",
      "keep asking for more proof",
    ],
    citation: "7 CFR 273.2(f)(4)",
    whyAsked:
      "The county can only ask for proof of something that's actually in question — not re-request what's already in your file, and not deny you for 'failure to provide' something you already gave them. If a document you sent is being asked for again, that's worth pushing back on, not resubmitting by default.",
  },
  {
    topic: "abawd_work_requirement",
    phrasings: [
      "80 hours a month",
      "20 hours a week",
      "work requirement notice",
      "able-bodied adult without dependents",
      "three months in three years",
      "time limit on my benefits",
      "countable month",
    ],
    citation: "7 CFR 273.24",
    whyAsked:
      "This is the ABAWD work rule: without a qualifying work activity or an exemption, benefits are limited to three countable months in a three-year period. Most adults never hit this rule at all — several exemptions apply (disability, caring for a child, pregnancy, and others) — and a late or missing notice can itself be grounds to challenge a cutoff.",
  },
  {
    topic: "denial_notice_validity",
    phrasings: [
      "the notice doesn't make sense",
      "my denial letter has two reasons",
      "the letter says something that isn't true",
      "wrong reason on my notice",
      "confusing termination letter",
      "does my denial letter have to be right",
    ],
    citation: "7 CFR 273.13",
    whyAsked:
      "A denial or termination notice has to state the real reason, in plain language, and if it lists more than one reason every single one has to be accurate — one wrong reason can invalidate the whole notice, not just that line. A letter that's confusing or doesn't match what actually happened is worth questioning, not just accepting.",
  },
  {
    topic: "self_employment",
    phrasings: [
      "self-employment",
      "self employed",
      "own business",
      "gig work",
      "rideshare",
      "1099",
      "odd jobs",
    ],
    citation: "7 CFR 273.11(a)",
    whyAsked:
      "Self-employment income counts after business costs, not before — so gross platform earnings are the wrong number to report. This is one of the most commonly miscalculated lines on the form.",
  },
  {
    topic: "voluntary_quit",
    phrasings: ["quit a job", "voluntarily quit", "left your job", "reduced your hours", "fired"],
    citation: "7 CFR 273.7",
    whyAsked:
      "Quitting a job without good cause can bring a penalty — but 'good cause' is broad (unsafe conditions, lack of childcare, transportation, discrimination), and being fired is not a voluntary quit.",
  },
  {
    topic: "drug_felony",
    phrasings: ["drug felony", "convicted of a felony", "drug conviction", "controlled substance"],
    citation: "7 CFR 273.11(m)",
    whyAsked:
      "Most states have opted out of the federal drug-felony ban entirely, and where a rule remains it usually turns on compliance with a treatment or probation condition. A conviction alone often does not disqualify you.",
  },
  {
    topic: "fleeing_felon",
    phrasings: ["fleeing felon", "active warrant", "outstanding warrant", "fleeing to avoid prosecution"],
    citation: "7 CFR 273.11(n)",
    whyAsked:
      "This disqualifies only the individual, never the whole household — and it requires an active intent to avoid prosecution, not simply the existence of an old warrant.",
  },
  {
    topic: "immigration_status",
    phrasings: [
      "immigration status",
      "non-citizen",
      "qualified alien",
      "green card",
      "public charge",
      "will this affect my status",
    ],
    citation: "7 CFR 273.4",
    whyAsked:
      "You can apply for eligible household members (including citizen children) without applying for yourself, and SNAP is not counted in the public-charge test. Only the people applying have to give immigration status.",
  },
  {
    topic: "ssn_requirement",
    phrasings: ["social security number", "ssn", "do I have to give my social"],
    citation: "7 CFR 273.6",
    whyAsked:
      "An SSN is required only for the people actually applying. Non-applicant household members do not have to provide one, and refusing for them cannot sink the whole application.",
  },
  {
    topic: "resources_assets",
    phrasings: ["resources", "assets", "bank account", "do you own a car", "savings", "vehicle"],
    citation: "7 CFR 273.8",
    whyAsked:
      "Most states waive the asset test entirely through broad-based categorical eligibility, so savings and vehicles frequently do not count at all — but this varies by state more than almost any other rule.",
  },
];

/** Loose match: the pasted phrasing appears anywhere in the question. */
export function matchFormQuestion(text: string): FormQuestion | null {
  const t = text.toLowerCase();
  let best: { q: FormQuestion; len: number } | null = null;
  for (const q of FORM_QUESTIONS) {
    for (const p of q.phrasings) {
      // Longest matching phrase wins, so "purchase and prepare" beats "prepare".
      // p is lowercased too: phrasings are written lowercase by convention, but
      // this makes matching correct even if one isn't (was a silent no-op before).
      if (t.includes(p.toLowerCase()) && (!best || p.length > best.len)) best = { q, len: p.length };
    }
  }
  return best?.q ?? null;
}

/** Topic label for analytics. Null when nothing matched — never guess. */
export function classifyQuestionTopic(text: string): string | null {
  return matchFormQuestion(text)?.topic ?? null;
}

/** Retrieval hints in the shape retrieval.ts already consumes. */
export const FORM_QUESTION_HINTS = FORM_QUESTIONS.map((q) => ({
  terms: q.phrasings,
  cites: [q.citation.replace(/^7 CFR /, "")],
}));
