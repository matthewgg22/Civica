// Demeter Privacy Policy.
//
// SCOPE IS DELIBERATELY NARROW: the public Demeter chat and the things attached
// to it (saved conversations, the emailed outline, feedback). It does NOT cover
// the Civica application flow (/apply, /documents, /packet), which uploads
// documents and transmits a packet to an agency, and whose retention question
// (docs/snap/llm-retention-policy.md vs docs/snap/retention_policy.md — 0 days
// vs 7 years for document images) is unresolved. Writing one policy over both
// would have meant either describing the unresolved half vaguely, or stating a
// retention period nobody has actually decided.
//
// EVERY FACTUAL CLAIM BELOW WAS READ OUT OF THE CODE, not out of intent:
//   - IP salted-hashed and truncated ......... lib/demeter-usage.ts (ipBucket)
//   - structured PII redacted pre-flight ..... packages/demeter-engine/src/pii.ts
//   - names NOT redacted ..................... same file, documented tradeoff
//   - what the audit row holds ............... lib/demeter-audit-sink.ts
//   - anonymous chat, account only to resume . app/api/demeter/route.ts
//   - worksheet facts never persisted ........ migration 20260617, header note
//   - outline mails the session address only . app/api/demeter/email-outline
// If one of those changes, this file is wrong and must change with it.

import { CONTACT, ENTITY, RETENTION_DAYS, type LegalDocument } from "./types";

export const PRIVACY_POLICY: LegalDocument = {
  slug: "privacy",
  title: "Privacy Policy",
  lede: "What Demeter collects when you ask it a question, and what it does not.",
  lastUpdated: "2026-08-22",
  status: "draft",
  sections: [
    {
      id: "promises",
      heading: "The short version",
      blocks: [
        {
          kind: "callout",
          tone: "promise",
          text: "We do not sell your information, and we do not share it for advertising.",
        },
        {
          kind: "callout",
          tone: "promise",
          text: "We are not the government. We do not report you to any agency, and we do not give what you tell us to immigration authorities.",
        },
        {
          kind: "callout",
          tone: "promise",
          text: "We do not use your conversations to train AI models.",
        },
        {
          kind: "callout",
          tone: "promise",
          text: "You can use Demeter without an account and without giving your name.",
        },
        {
          kind: "p",
          text: "Those four sentences are the ones that matter most, so they are first. The rest of this page explains them, and tells you the one thing we do keep: a record of the questions asked and the answers given, so we can check whether Demeter is telling people the truth.",
        },
      ],
    },
    {
      id: "scope",
      heading: "What this policy covers",
      blocks: [
        {
          kind: "p",
          text: `This policy covers Demeter, the free SNAP question-and-answer service operated by ${ENTITY} — the chat, the application-questions pages, conversations you save to an account, the outline you can email yourself, and the feedback form.`,
        },
        {
          kind: "p",
          text: "It does not cover the separate Civica application tool, which collects documents and sends an application packet to a state agency. That tool has its own terms, and this policy does not describe it.",
        },
      ],
    },
    {
      id: "collect",
      heading: "What we collect, and why",
      blocks: [
        {
          kind: "table",
          columns: ["What", "Why we have it", "How long we keep it"],
          rows: [
            [
              "The question you type, and the answer Demeter gives",
              "To check whether Demeter's answers are accurate, and to fix them when they are not",
              `${RETENTION_DAYS.questionText} days (${RETENTION_DAYS.flaggedRow} days if the answer was flagged for review)`,
            ],
            [
              "A one-way scrambled version of your IP address",
              "To stop one source from overwhelming the service and to keep the monthly cost from running away",
              "The current rate-limit window and the current day",
            ],
            [
              "An anonymous session number",
              "To tell one conversation apart from another when we review accuracy",
              "With the accuracy record above",
            ],
            [
              "Your email address, only if you choose to make an account",
              "So you can come back to a saved conversation, and so we can email your outline to you",
              "Until you delete your account",
            ],
            [
              "Conversations you explicitly save",
              "So they are there when you come back",
              "Until you delete them",
            ],
            [
              "A partner organization's referral code, if you arrived through one",
              "So a community organization can see that people it referred were helped",
              "With the accuracy record above",
            ],
          ],
        },
        {
          kind: "p",
          text: "We do not collect your name, your Social Security number, your address, your date of birth, or your immigration status. Demeter does not ask for them, and you should not type them.",
        },
      ],
    },
    {
      id: "chat",
      heading: "What happens to what you type",
      blocks: [
        {
          kind: "p",
          text: "Before your question leaves our server, it passes through a filter that removes structured identifiers: Social Security numbers, phone numbers, email addresses, dates written as dates, and long account, EBT or case numbers. The filter runs before the question is sent to the AI model, before it is used to search our policy sources, and before it is written to our accuracy record.",
        },
        {
          kind: "callout",
          tone: "warning",
          text: "The filter does not remove names. Detecting names automatically is unreliable, and a filter that guessed would mangle real questions. Please do not type your name or anyone else's.",
        },
        {
          kind: "p",
          text: "The filtered question is then sent to Anthropic, the company whose AI model writes Demeter's answers. Under our agreement with Anthropic, they process the question to produce an answer and do not use it to train their models.",
        },
        {
          kind: "p",
          text: "We keep the filtered question and the answer because we make a specific promise about accuracy — that answers are grounded in real, cited regulations — and a promise nobody checks is just a slogan. The record lets us find wrong answers and fix them. It is not linked to your name, and unless you have made an account, it is not linked to you at all.",
        },
      ],
    },
    {
      id: "automatic",
      heading: "What we collect automatically",
      blocks: [
        {
          kind: "p",
          text: "We never store your raw IP address. When a request arrives, the address is combined with a secret value and run through a one-way hash, and only a short piece of the result is kept. That fragment lets us count requests from the same source without being able to work backward to the address itself.",
        },
        {
          kind: "p",
          text: "We use it for two things only: limiting how many questions can be asked in a minute, and limiting how much the service can spend in a day. It is not used to identify you, build a profile, or track you across other websites.",
        },
        {
          kind: "p",
          text: "If the site hits an error, a report goes to Sentry, our error-monitoring provider, so we can fix the bug. We configure it to strip personal information before the report is sent.",
        },
        {
          kind: "p",
          text: "We do not use advertising cookies, and we do not embed advertising or analytics trackers that follow you to other sites.",
        },
      ],
    },
    {
      id: "accounts",
      heading: "Accounts are optional",
      blocks: [
        {
          kind: "p",
          text: "The chat is free and anonymous, and it stays that way — you are never made to sign in to ask a question. An account does exactly one thing: it lets you come back to a conversation you already had.",
        },
        {
          kind: "p",
          text: "If you make one, we collect your email address and nothing else. You sign in with a link we email you, so there is no password for us to store or for anyone to steal.",
        },
        {
          kind: "p",
          text: "Saved conversations are protected at the database level, not just by our code: the database itself refuses to return a conversation to anyone but the account that saved it.",
        },
        {
          kind: "p",
          text: "The working estimate Demeter builds up as you talk — your household, income and rent figures — is deliberately never saved to our servers, even when you save the conversation. It lives in your browser, and it is rebuilt from the conversation if you come back.",
        },
      ],
    },
    {
      id: "email",
      heading: "The outline we email you",
      blocks: [
        {
          kind: "p",
          text: "If you ask Demeter to email you the outline of your application, it goes to the email address on your account and to no other address. There is no field to type a different recipient, on purpose: the outline gathers your household and income details into one document, and a form that let anyone type any address would be a way to mail someone else's situation anywhere.",
        },
        {
          kind: "p",
          text: "The email is delivered by Resend, our email provider.",
        },
      ],
    },
    {
      id: "immigration",
      heading: "Immigration status",
      blocks: [
        {
          kind: "p",
          text: "Fear of immigration consequences keeps eligible families — especially families where some members are citizens and some are not — from applying for food assistance they are legally entitled to. So we want to be direct about this.",
        },
        {
          kind: "callout",
          tone: "promise",
          text: "We are not a government agency. We are not part of the Department of Homeland Security, USCIS, or any immigration authority, and we do not share information with them.",
        },
        {
          kind: "p",
          text: "Demeter does not ask for your immigration status and does not store it. If you mention it while asking a question, it lives in the accuracy record for the same short period as everything else and is not connected to your identity.",
        },
        {
          kind: "p",
          text: "Asking Demeter a question is not an application, is not reported to anyone, and creates no record with any government agency.",
        },
      ],
    },
    {
      id: "sharing",
      heading: "Who else sees this",
      blocks: [
        {
          kind: "p",
          text: "We share information with the companies that run the service for us, and with nobody else. Each is bound by contract to use it only to provide their service to us:",
        },
        {
          kind: "ul",
          items: [
            "Anthropic — the AI model that writes the answers",
            "Supabase — our database and sign-in system",
            "Vercel — hosting for the website",
            "Resend — sending the outline email",
            "Sentry — error monitoring",
          ],
        },
        {
          kind: "p",
          text: "We do not sell personal information. We do not share it for advertising or for cross-context behavioral advertising, as those terms are defined by California law. We have no advertisers, and we do not license user data to anyone.",
        },
        {
          kind: "p",
          text: "We may publish aggregate figures — for example, how many questions were asked about a given topic, or how often answers cited a verified state source. These are counts, and they cannot be traced back to any person.",
        },
      ],
    },
    {
      id: "legal-requests",
      heading: "Government and legal requests",
      blocks: [
        {
          kind: "p",
          text: "We have never received a government request for user information. If we receive one, we will require valid legal process, disclose only what that process actually compels, and — unless a court forbids it or there is a risk to someone's safety — tell the affected person.",
        },
        {
          kind: "p",
          text: "The strongest protection here is not a promise, it is the design: the chat is anonymous, the IP address is never stored in a form we can reverse, and the questions we hold have had identifiers stripped out. For most conversations there is simply no identity for us to hand over.",
        },
        {
          kind: "p",
          text: "Federal law separately protects the confidentiality of SNAP applicant information (7 U.S.C. § 2020(e)(8) and 7 C.F.R. § 272.1(c)). Where we handle information for a state agency or a partner organization under an agreement, we handle it under those restrictions as well as this policy.",
        },
      ],
    },
    {
      id: "retention",
      heading: "How long we keep things",
      blocks: [
        {
          kind: "p",
          text: "Three different rules, depending on what it is.",
        },
        {
          kind: "ul",
          items: [
            `Deleted automatically: the text of questions and answers in our accuracy record, after ${RETENTION_DAYS.questionText} days. If an answer was flagged for review — for example, because it cited something we could not verify — the row is kept for ${RETENTION_DAYS.flaggedRow} days so a person can look at it.`,
            "Kept until you delete it: your account, and any conversation you chose to save. Delete either one and it is gone from our systems within 30 days.",
            "Kept longer, for narrow reasons: records we need to keep to meet a legal obligation, to resolve a dispute, or to deal with abuse of the service. We keep only what the reason requires, and only while it applies.",
          ],
        },
        {
          kind: "p",
          text: "Counts and measurements that identify nobody — how many questions were asked, how often citations verified — are kept indefinitely, because they are how we show the service works.",
        },
      ],
    },
    {
      id: "rights",
      heading: "Your choices and your rights",
      blocks: [
        {
          kind: "p",
          text: "In the chat, you can start a new conversation at any time. That clears the conversation from your browser. It does not erase the accuracy record, which expires on its own schedule above — we say so plainly rather than letting a button imply more than it does.",
        },
        {
          kind: "p",
          text: "If you have an account, you can delete any saved conversation, or delete the account entirely, from your account page.",
        },
        {
          kind: "p",
          text: "Depending on where you live, you may have the right to know what personal information we hold about you, to get a copy, to correct it, to delete it, and not to be treated differently for asking. To exercise any of these rights, email us at " + CONTACT.privacy + ".",
        },
        {
          kind: "p",
          text: "One honest limitation: for anonymous chat we usually cannot connect a request to a specific conversation, because we did not keep anything that ties the conversation to you. We will not ask you for identifying information just to create a link that did not exist before.",
        },
      ],
    },
    {
      id: "do-not-sell",
      heading: "Do not sell or share my personal information",
      blocks: [
        {
          kind: "p",
          text: "We do not sell personal information, and we do not share it for cross-context behavioral advertising. There is nothing to opt out of, and this is a statement of practice, not a setting we could quietly change without updating this page.",
        },
        {
          kind: "p",
          text: "If you believe otherwise, tell us at " + CONTACT.privacy + " and we will look into it and answer you.",
        },
      ],
    },
    {
      id: "children",
      heading: "Children and teenagers",
      blocks: [
        {
          kind: "p",
          text: "Demeter answers questions about a household benefit, and teenagers are part of households — some of them are the person in the family who reads the mail and figures out the forms. So we do not bar anyone from asking a question.",
        },
        {
          kind: "p",
          text: "But we do not knowingly collect personal information from children under 13, and accounts are not available to them. If you believe a child under 13 has given us personal information, email " + CONTACT.privacy + " and we will delete it.",
        },
      ],
    },
    {
      id: "changes",
      heading: "Changes to this policy",
      blocks: [
        {
          kind: "p",
          text: "If we change this policy we will update the date at the top. If a change materially reduces the protections described here, we will say so prominently on the site rather than relying on you to notice a new date.",
        },
      ],
    },
    {
      id: "contact",
      heading: "Contact us",
      blocks: [
        {
          kind: "p",
          text: `Demeter is operated by ${ENTITY}. For any privacy question, or to exercise a right described above, email ${CONTACT.privacy}.`,
        },
      ],
    },
  ],
};
