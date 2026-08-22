// Demeter Safety & Grounding Notice.
//
// The third document, and the one with no equivalent in most companies' legal
// packages. Its job is to describe HOW AN ANSWER IS MADE, in enough detail that
// a reader — an applicant, a caseworker, a program officer, a funder — can
// judge how much weight to put on one.
//
// THE HARD RULE FOR THIS FILE: it may only describe behavior that exists in the
// code today. A published safety protocol that overclaims is worse than none,
// because it is relied upon precisely when someone is in trouble.
//
// So, specifically, on crisis handling: the distress gate
// (packages/demeter-engine/src/distress.ts) detects acute FOOD and HOUSING
// crisis phrasing in English and Spanish, and makes the answer lead with
// expedited-service rights, 211, and stolen-benefit steps. It does NOT detect
// self-harm, suicidal ideation, or domestic violence. This document therefore
// gives those resources UNCONDITIONALLY and states plainly that Demeter cannot
// detect an emergency, rather than implying a protocol that does not exist.
// Closing that gap is tracked separately; when it lands, this section changes
// with it and not before.

import { ENTITY, type LegalDocument } from "./types";

export const SAFETY_NOTICE: LegalDocument = {
  slug: "safety",
  title: "Safety and How Demeter Answers",
  lede: "Where Demeter's answers come from, how far to trust them, and where to go when you need a person.",
  lastUpdated: "2026-08-22",
  status: "draft",
  sections: [
    {
      id: "urgent",
      heading: "If you need food today",
      blocks: [
        {
          kind: "callout",
          tone: "warning",
          text: "Call 211, or visit 211.org, for food banks and community meals near you. No paperwork, no application, no wait.",
        },
        {
          kind: "p",
          text: "If you apply for SNAP and qualify for expedited service — which generally means very low income and few resources — federal rules require benefits to be available within 7 days. Say when you apply that you have almost nothing coming in. Many states move faster than 7 days.",
        },
        {
          kind: "p",
          text: "If your benefits were stolen, skimmed, or cut off, contact your state agency right away and ask about replacement and about appealing. Appealing a denial is free.",
        },
        {
          kind: "p",
          text: "When a question mentions an immediate food or housing crisis, Demeter is built to lead with these options before it explains any rules. That check looks for common phrasings in English and Spanish; it will not catch every way a person might say it.",
        },
      ],
    },
    {
      id: "crisis",
      heading: "If you are in danger or thinking about harming yourself",
      blocks: [
        {
          kind: "callout",
          tone: "warning",
          text: "Demeter is not a crisis service and cannot reliably tell when someone is in an emergency. Please contact a person.",
        },
        {
          kind: "ul",
          items: [
            "Suicide and Crisis Lifeline — call or text 988, any time, free and confidential.",
            "National Domestic Violence Hotline — call 1-800-799-7233, or text START to 88788.",
            "Emergency — call 911.",
          ],
        },
        {
          kind: "p",
          text: "Demeter answers questions about a food assistance program. It is not a counselor, not a therapist, and not a substitute for one. It does not detect self-harm or abuse, and it should never be relied on to.",
        },
      ],
    },
    {
      id: "ai",
      heading: "Demeter is AI, and it can be wrong",
      blocks: [
        {
          kind: "p",
          text: "You are talking to a computer program, not a caseworker. It can misread a rule, miss one your state applies, or be out of date. It can also be wrong confidently, in fluent and reasonable-sounding language — that is the failure mode of this kind of system, and it is the reason for everything described below.",
        },
        {
          kind: "p",
          text: "Nothing Demeter says is a decision about your case. Only your state SNAP agency decides that.",
        },
      ],
    },
    {
      id: "how",
      heading: "How an answer is built",
      blocks: [
        {
          kind: "p",
          text: "Demeter does not answer from memory. Each question is used to search a collection of source documents — federal SNAP regulations from the Electronic Code of Federal Regulations, and, for states we have verified, that state's own policy manual. The passages that come back are what the answer is written from.",
        },
        {
          kind: "p",
          text: "Every source snapshot carries a date, and the date the answer was grounded on is recorded with it. Rules change; an answer is only as current as the snapshot behind it.",
        },
        {
          kind: "p",
          text: "After an answer is written, its citations are checked against the sources. If a citation cannot be verified, Demeter tries again; if it still cannot, the answer is degraded rather than shipped as if it were solid — you see a weaker claim instead of a confident one resting on a citation that does not exist.",
        },
        {
          kind: "p",
          text: "Each answer then carries a one-line verdict: a ✓ when the claim is grounded in a verified citation, or a ⚠ when it is not, with the reason and the citations to check for yourself. When Demeter makes no rule-based claim at all, there is no banner, because there is nothing for you to verify.",
        },
      ],
    },
    {
      id: "states",
      heading: "States, and the federal floor",
      blocks: [
        {
          kind: "p",
          text: "SNAP is federal rules administered by states, and states differ in ways that change real answers — income limits, deductions, work requirements, and which exemptions apply.",
        },
        {
          kind: "p",
          text: "If you have not told Demeter your state, it answers with federal rules only, and says so. It never guesses a state for you: an answer confidently given for the wrong state is worse than a general one.",
        },
        {
          kind: "p",
          text: 'A "verified" state is one whose own policy manual we have loaded and checked, so answers for it can cite that state\'s source. For other states you get the federal floor, with a note that your local agency is the one to confirm with.',
        },
        {
          kind: "p",
          text: "Puerto Rico, American Samoa, and the Northern Mariana Islands do not run SNAP at all — they operate block-grant nutrition assistance programs with their own eligibility rules. Demeter answers questions from those places with a direct hand-off rather than applying SNAP rules that do not exist there.",
        },
      ],
    },
    {
      id: "wrong",
      heading: "When to be extra careful",
      blocks: [
        {
          kind: "p",
          text: "Be more skeptical, and confirm with your agency or a local organization, when:",
        },
        {
          kind: "ul",
          items: [
            "The answer carries a ⚠ rather than a ✓.",
            "Your state is not one of the verified ones, so the answer is the federal floor.",
            "Your situation involves rules that change often or vary locally — work requirements and their exemptions, student eligibility, non-citizen eligibility, or how a specific kind of income is counted.",
            "The stakes are high and immediate: an appeal deadline, a recertification date, or a decision about whether to apply at all.",
            "Anything Demeter says conflicts with what your agency told you. The agency is the authority; Demeter is not.",
          ],
        },
        {
          kind: "p",
          text: "If Demeter suggests you may not qualify, that is not a denial and it is not a reason to skip applying. Applying is free, only the agency can decide, and people are approved every day who assumed they would not be.",
        },
      ],
    },
    {
      id: "accuracy",
      heading: "How we check ourselves",
      blocks: [
        {
          kind: "p",
          text: "We keep a short-lived record of each question and answer, with personal identifiers stripped out, together with the citations the answer used, whether they verified, and which source snapshot it was grounded on. That record is what makes an accuracy claim checkable rather than merely asserted. The Privacy Policy explains how long it is kept and what is removed from it.",
        },
        {
          kind: "p",
          text: "Answers whose citations could not be verified are flagged and reviewed by a person.",
        },
        {
          kind: "p",
          text: "If Demeter told you something wrong, please tell us — use the feedback link in the footer. A wrong answer about benefits is not an abstraction, and reports are how they get found and fixed.",
        },
      ],
    },
    {
      id: "languages",
      heading: "Languages",
      blocks: [
        {
          kind: "p",
          text: "Demeter answers in English and Spanish. When an answer contains figures, the two versions are checked against each other so the numbers cannot drift apart between languages.",
        },
        {
          kind: "p",
          text: "This notice and our other legal documents are currently published in English only. If you would like them in another language, write to us and we will help.",
        },
      ],
    },
    {
      id: "human",
      heading: "Where to get help from a person",
      blocks: [
        {
          kind: "ul",
          items: [
            "Your state SNAP agency — the only office that can decide your case, and the place to apply, appeal, or report stolen benefits.",
            "211, or 211.org — food banks, community meals, and local help, right now.",
            "Local legal aid — free help if your benefits were denied, cut, or stopped and you think it was wrong.",
            "Community organizations near you that help with applications, in person.",
          ],
        },
        {
          kind: "p",
          text: `Demeter is operated by ${ENTITY}. It is free, it carries no advertising, and nobody pays to influence what it tells you.`,
        },
      ],
    },
  ],
};
