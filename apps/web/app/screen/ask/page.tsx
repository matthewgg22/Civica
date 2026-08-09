// /screen/ask — the public Demeter chat, and the page the whole product is
// judged on. Structure (2026-08-09 rebuild):
//
//   lede  →  chat  →  depth  →  JSON-LD
//
// The lede explains SNAP before the page asks for input; the chat sits high
// enough to still be the product; the depth below carries the legitimacy and
// GEO weight. Everything except the chat is server-rendered, because content
// that only exists after hydration is content a generative search engine never
// sees — and being quotable BY those engines is an explicit goal here, not a
// side effect.
//
// /screen is the whole Demeter AI public surface: this route is the "ask a
// question" entry point (no sign-in), /screen/session is the accounts-gated
// case-file builder. The old /demeter path 301s here.

import type { Metadata } from "next";
import { VERIFIED_STATES } from "@civica/demeter-engine/packs";
import { DemeterChat } from "../../../components/DemeterChat";
import { SnapLede, SnapDetail } from "../../../components/SnapOverview";

const TITLE = "Demeter AI — verified SNAP answers, with the rule attached";
const DESCRIPTION =
  "Ask anything about SNAP (food stamps) and get an answer grounded in the actual rules — federal regulation plus adversarially verified state policy, every claim cited, and marked certain or uncertain so you know when to check.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: { title: TITLE, description: DESCRIPTION, type: "website" },
};

// Structured data for generative search. Two objects, both answering a
// question an AI engine actually asks when deciding whether to cite a page:
// "what is this thing" (WebApplication, free, no account) and "does it contain
// real answers" (FAQPage). The FAQ entries are deliberately the durable,
// mechanism-level questions — nothing here carries a dollar figure that goes
// stale at the October COLA, for the same reason SnapOverview carries none.
function structuredData(): string {
  const faq = [
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
  return JSON.stringify([
    {
      "@context": "https://schema.org",
      "@type": "WebApplication",
      name: "Demeter AI",
      applicationCategory: "GovernmentBenefitsApplication",
      description: DESCRIPTION,
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      audience: { "@type": "Audience", audienceType: "SNAP applicants and recipients" },
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faq.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    },
  ]);
}

export default async function ScreenAskPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string; q?: string }>;
}) {
  const { state, q } = await searchParams;
  const initialState =
    state && VERIFIED_STATES.some((s) => s.code === state.toUpperCase())
      ? state.toUpperCase()
      : null;

  return (
    <main className="dmpage">
      <div className="dmpage__inner">
        <SnapLede />
        <div className="dmpage__chat">
          <DemeterChat
            states={VERIFIED_STATES}
            initialState={initialState}
            initialQuestion={q ?? null}
          />
        </div>
        <SnapDetail states={VERIFIED_STATES} />
      </div>
      <script
        type="application/ld+json"
        // Server-rendered constant built from a literal above — no user input
        // reaches this, so there is no injection surface.
        dangerouslySetInnerHTML={{ __html: structuredData() }}
      />
    </main>
  );
}
