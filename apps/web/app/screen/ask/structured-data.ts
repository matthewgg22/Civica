// JSON-LD for the entry page, in whichever language that page is.
//
// Shared by the canonical English route and the localized ones so they cannot
// drift in shape. Every FAQ entry is generated from FORM_QUESTIONS through the
// SAME helpers the visible section uses — an engine that quotes either quotes
// the same sentence. Structured data that says something the page does not is
// cloaking, and is worth less than none.

import {
  FORM_QUESTIONS,
  CORPUS_EFFECTIVE_DATE,
} from "@civica/demeter-engine";
import { VERIFIED_STATES, ANSWER_LANGS, LANG_TAG, type AnswerLang } from "@civica/demeter-engine/packs";
import { formQuestionHeading, formQuestionAnswer } from "../../../components/SnapOverview";
import { askUrl } from "../../../lib/i18n/routes";

// The durable, mechanism-level questions. English only — these are hand-written
// rather than derived, and an untranslated string in a localized page's
// structured data is exactly the duplicate-content problem the localized routes
// exist to solve. Non-English pages carry the (fully translated) form-question
// set instead, which is the larger and more quotable half anyway.
const EN_GENERAL_FAQ = [
  {
    q: "What is SNAP?",
    a: "SNAP, the Supplemental Nutrition Assistance Program and formerly called food stamps, is a federal program administered by each state that provides monthly money for groceries on an EBT card. Applying is free.",
  },
  {
    q: "What decides whether I qualify for SNAP?",
    a: "Household size, your income after the deductions you are entitled to, and a short list of category rules. Deductions — rent, utilities, childcare, child support paid, and medical costs for members who are 60 or older or disabled — are applied before your income is compared to the limit, which is why gross income alone does not determine eligibility.",
  },
  {
    q: "Do SNAP rules differ by state?",
    a: "Yes. Federal regulation sets the floor and each state adds its own manual, utility allowances, and in some states an asset test. Guidance accurate in one state is frequently wrong in another.",
  },
  {
    q: "Can I get SNAP if I am working?",
    a: "Yes. SNAP is based on income after deductions rather than employment status, and many working households qualify. An earned income deduction applies specifically to money from a job.",
  },
  {
    q: "How fast can SNAP benefits arrive in an emergency?",
    a: "Households with very low income and resources, or whose housing costs exceed their income, may qualify for expedited service, which carries a much shorter federal processing deadline than a standard application. Your state agency screens every application for it.",
  },
];

/** The form-question set, in the reader's language. Lives on /questions now,
 *  which is where the visible cards moved — structured data must describe the
 *  page it is ON. Exported so questionsStructuredData is the only caller. */
export function formQuestionFaq(lang: AnswerLang): { q: string; a: string }[] {
  return FORM_QUESTIONS.map((q) => ({
    q: formQuestionHeading(q, lang),
    a: `${formQuestionAnswer(q, lang)} (${q.citation})`,
  }));
}

export function askStructuredData(
  lang: AnswerLang,
  name: string,
  description: string,
): string {
  // ONLY the general FAQ. The 17 form questions moved to /questions along with
  // their visible cards; leaving them in this page's JSON-LD would be claiming
  // content the page no longer renders, which is cloaking — the exact failure
  // the header of this file warns about. Non-English ask pages therefore carry
  // no FAQPage at all, because EN_GENERAL_FAQ is deliberately English-only.
  const faq = lang === "en" ? EN_GENERAL_FAQ : [];

  // schema.org `citation` accepts Text as well as a URL, and most pack sources
  // are NAMED instruments rather than links — filtering to URLs threw away the
  // provenance that makes this page credible.
  const citations = [
    "https://www.ecfr.gov/current/title-7/part-273",
    ...new Set(VERIFIED_STATES.flatMap((s) => s.verification.sources)),
  ];

  return JSON.stringify([
    {
      "@context": "https://schema.org",
      "@type": "WebApplication",
      name: "Demeter AI",
      applicationCategory: "GovernmentBenefitsApplication",
      description,
      url: askUrl(lang),
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      audience: { "@type": "Audience", audienceType: "SNAP applicants and recipients" },
      // Civica is the parent organization behind Demeter AI, not the
      // consumer-facing product name.
      publisher: { "@type": "Organization", name: "Civica" },
      inLanguage: ANSWER_LANGS.map((l) => LANG_TAG[l]),
      isAccessibleForFree: true,
      ...(CORPUS_EFFECTIVE_DATE ? { dateModified: CORPUS_EFFECTIVE_DATE } : {}),
      citation: citations,
    },
    // Emitted only when there is something to put in it. An empty FAQPage is
    // an invalid one.
    ...(faq.length > 0 ? [faqPage(lang, faq)] : []),
  ]);
}

function faqPage(lang: AnswerLang, faq: { q: string; a: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    // The language of THIS page, not the set — a FAQPage claiming four
    // languages while carrying one is a mismatch a validator will flag.
    inLanguage: LANG_TAG[lang],
    ...(CORPUS_EFFECTIVE_DATE ? { dateModified: CORPUS_EFFECTIVE_DATE } : {}),
    mainEntity: faq.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
}

/** /questions — the FAQPage that used to ride on the ask page, now on the page
 *  that actually renders the cards. Same helpers, so an engine quoting the
 *  markup quotes the sentence a reader sees. */
export function questionsStructuredData(lang: AnswerLang): string {
  return JSON.stringify([faqPage(lang, formQuestionFaq(lang))]);
}

// The page title/description used by the canonical English route, kept here so
// the route file and the structured data quote the same string.
export const EN_TITLE = "Demeter AI — verified SNAP answers, with the rule attached";
export const EN_DESCRIPTION =
  "Ask anything about SNAP (food stamps) and get an answer grounded in the actual rules — federal regulation plus adversarially verified state policy, every claim cited, and marked certain or uncertain so you know when to check.";
