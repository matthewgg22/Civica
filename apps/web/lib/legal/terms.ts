// Demeter Terms of Service.
//
// TWO THINGS IN HERE ARE NOT BOILERPLATE AND SHOULD NOT BE EDITED CASUALLY.
//
// 1. §2, "Demeter does not decide your case." This is the single most important
//    clause in the document and it is conspicuous on purpose. It is also the
//    clause that protects the READER, not just us: a person who believes an
//    estimate is a decision may not file an application, and the cost of that
//    error lands on someone who needed food assistance. It mirrors the product
//    copy in the footer and under the chat composer, and those three should be
//    changed together or not at all.
//
// 2. §13, arbitration. Included in standard form at the operator's explicit
//    direction after the tradeoff was raised — a class waiver and jury waiver
//    against a population applying for food assistance carries reputational and
//    referral-partnership risk that a fee-free service does not offset on its
//    own. Recorded here so the decision is legible later, not to relitigate it.
//    The 30-day opt-out in §13.10 is the mitigation and must stay workable.
//
// PLACEHOLDERS: [MAILING ADDRESS] appears where a physical address is legally
// required (arbitration notice). The claims test fails the build if a document
// with status "published" still contains a bracketed placeholder.

import { CONTACT, ENTITY, type LegalDocument } from "./types";

export const TERMS_OF_SERVICE: LegalDocument = {
  slug: "terms",
  title: "Terms of Service",
  lede: "The agreement between you and Civica Technologies LLC for using Demeter.",
  lastUpdated: "2026-08-22",
  status: "draft",
  sections: [
    {
      id: "agreement",
      heading: "1. This agreement",
      blocks: [
        {
          kind: "p",
          text: `These Terms of Service ("Terms") govern your use of Demeter, a free service operated by ${ENTITY} ("Civica", "we", "us") that answers questions about the Supplemental Nutrition Assistance Program ("SNAP").`,
        },
        {
          kind: "p",
          text: "You agree to these Terms when you send Demeter a message or create an account. We tell you so at both of those moments, with a link to this page, rather than burying it in a footer and calling that agreement. If you do not agree, please do not use Demeter — and you can still get the same information from your state SNAP agency or by calling 211.",
        },
        {
          kind: "p",
          text: "Our Privacy Policy is part of these Terms and describes what we collect and what we do not.",
        },
        {
          kind: "callout",
          tone: "warning",
          text: "SECTION 13 REQUIRES MOST DISPUTES TO BE RESOLVED BY INDIVIDUAL ARBITRATION RATHER THAN IN COURT, AND WAIVES CLASS ACTIONS AND TRIAL BY JURY. YOU MAY OPT OUT OF ARBITRATION WITHIN 30 DAYS BY FOLLOWING THE INSTRUCTIONS IN SECTION 13.10.",
        },
      ],
    },
    {
      id: "not-a-decision",
      heading: "2. Demeter does not decide your case",
      blocks: [
        {
          kind: "callout",
          tone: "warning",
          text: "DEMETER IS NOT AN ELIGIBILITY DETERMINATION. ONLY YOUR STATE SNAP AGENCY CAN DECIDE WHETHER YOU QUALIFY, AND FOR HOW MUCH. NOTHING DEMETER TELLS YOU IS A PROMISE OF BENEFITS, A DENIAL OF BENEFITS, OR LEGAL ADVICE.",
        },
        {
          kind: "p",
          text: "Demeter is an information service. It explains the rules, cites where they come from, and can help you organize what you will need. It does not submit an application, does not communicate with any agency on your behalf, and does not create any record with any agency.",
        },
        {
          kind: "p",
          text: "Demeter uses artificial intelligence and can be wrong. It can misread a rule, miss a rule your state applies, or be out of date. Do not decide whether to apply based only on what Demeter tells you. If Demeter suggests you may not qualify, you are still entitled to apply and to receive a decision from your agency — applying is free, and the agency decides, not us.",
        },
        {
          kind: "p",
          text: "Demeter does not give legal advice and using it does not create an attorney-client relationship. For advice about your specific case, contact your state SNAP agency, a local legal aid organization, or a community organization that helps with benefits.",
        },
        {
          kind: "p",
          text: "SNAP rules let you name an authorized representative to act for you with your agency. Demeter is not one, and using it does not make us one. We do not act for you, speak for you, or represent you to any agency.",
        },
      ],
    },
    {
      id: "who",
      heading: "3. Who can use Demeter",
      blocks: [
        {
          kind: "p",
          text: "Anyone may ask Demeter a question. We deliberately do not set an age floor for asking: SNAP is a household benefit, and in many households a teenager is the person who reads the mail and works out the forms.",
        },
        {
          kind: "p",
          text: "Accounts, which exist only so you can return to a saved conversation, are not available to children under 13. If you are under 18, please involve a parent, guardian, or another trusted adult before acting on anything you read here.",
        },
      ],
    },
    {
      id: "free",
      heading: "4. Demeter is free",
      blocks: [
        {
          kind: "p",
          text: "Demeter costs nothing to use. We do not charge you, we do not show you advertising, and we do not sell information about you. Nobody pays to influence what Demeter tells you.",
        },
        {
          kind: "p",
          text: "Because the service costs us money to run, we limit how many questions can be asked from one source in a short period, and we cap what the service can spend in a month. If you hit a limit, Demeter says so and points you to your state agency or 211 rather than leaving you with nothing.",
        },
      ],
    },
    {
      id: "your-content",
      heading: "5. What you type, and what we may do with it",
      blocks: [
        {
          kind: "p",
          text: "What you type stays yours. You give us a limited, non-exclusive license to use it for three narrow purposes and nothing else:",
        },
        {
          kind: "ul",
          items: [
            "To produce an answer for you — which means sending your question, with identifiers stripped out, to the AI model that writes the answer.",
            "To check and improve the accuracy of Demeter's answers, by keeping a short-lived record of the question and answer as described in the Privacy Policy.",
            "To produce aggregate statistics that identify nobody, such as how many questions were asked about a topic.",
          ],
        },
        {
          kind: "callout",
          tone: "promise",
          text: "This license does not permit us to train AI models on your conversations, to sell what you type, or to share it for advertising. We do not do any of those things.",
        },
        {
          kind: "p",
          text: "Please do not type your Social Security number, bank details, or anyone's full name. Demeter strips structured identifiers automatically, but that filter is a safeguard, not a guarantee, and it deliberately does not attempt to detect names.",
        },
        {
          kind: "p",
          text: "If you send us feedback or suggestions, you allow us to use them to improve the service without owing you anything for them.",
        },
      ],
    },
    {
      id: "acceptable-use",
      heading: "6. Acceptable use",
      blocks: [
        {
          kind: "p",
          text: "Use Demeter to get information about SNAP. Do not:",
        },
        {
          kind: "ul",
          items: [
            "Use it to help commit fraud against SNAP or any other benefits program, or to help anyone else do so.",
            "Present Demeter, or its answers, as if they came from a government agency, or otherwise impersonate an agency, an organization, or another person.",
            "Scrape, crawl, or bulk-extract the service or its answers by automated means.",
            "Attempt to reverse engineer the service, extract the underlying model, or use its output to build a competing model.",
            "Attempt to defeat rate limits, security measures, or the safeguards that keep personal information out of our records.",
            "Interfere with the service or the ability of others to use it, including by flooding it with requests.",
            "Use it to harass, threaten, or violate the rights or privacy of anyone else, including by trying to get information about another person.",
          ],
        },
      ],
    },
    {
      id: "accounts",
      heading: "7. Accounts",
      blocks: [
        {
          kind: "p",
          text: "You do not need an account to use Demeter. If you make one, keep access to the email address you signed up with — anyone who can read your email can sign in as you. Tell us at " + CONTACT.privacy + " if you believe someone else has access to your account.",
        },
        {
          kind: "p",
          text: "You can delete your account at any time from your account page.",
        },
      ],
    },
    {
      id: "our-content",
      heading: "8. Our content",
      blocks: [
        {
          kind: "p",
          text: "The Demeter name, design, and software belong to us. You get a limited, personal, revocable license to use the service. The federal and state regulations Demeter cites are public documents and are not ours.",
        },
        {
          kind: "p",
          text: "You are welcome to read an answer, print it, save it, and take it with you to your agency, your caseworker, or a community organization. That is what it is for.",
        },
      ],
    },
    {
      id: "suspension",
      heading: "9. Suspension and termination",
      blocks: [
        {
          kind: "p",
          text: "We may suspend or end access if these Terms are violated, if it is necessary to protect the service or other people, or if we are required to by law. We may also change or discontinue Demeter, in whole or in part, at any time.",
        },
        {
          kind: "p",
          text: "You may stop using Demeter at any time, and delete your account if you have one. The sections that by their nature should survive — disclaimers, limitation of liability, the license in Section 5, dispute resolution, and governing law — survive termination.",
        },
      ],
    },
    {
      id: "disclaimer",
      heading: "10. Disclaimer of warranties",
      blocks: [
        {
          kind: "callout",
          tone: "warning",
          text: 'DEMETER IS PROVIDED "AS IS" AND "AS AVAILABLE." TO THE MAXIMUM EXTENT PERMITTED BY LAW, WE DISCLAIM ALL WARRANTIES, EXPRESS OR IMPLIED, INCLUDING THE IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, AND NON-INFRINGEMENT.',
        },
        {
          kind: "p",
          text: "We do not warrant that the service will be uninterrupted or error-free, or that any answer will be accurate, complete, or current. Benefit rules change, states apply them differently, and an AI system can be confidently wrong. Some states do not allow certain disclaimers, so parts of this section may not apply to you.",
        },
      ],
    },
    {
      id: "liability",
      heading: "11. Limitation of liability",
      blocks: [
        {
          kind: "callout",
          tone: "warning",
          text: "TO THE MAXIMUM EXTENT PERMITTED BY LAW, NEITHER CIVICA NOR ITS OFFICERS, DIRECTORS, EMPLOYEES, CONTRACTORS, OR AGENTS WILL BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR FOR ANY LOST BENEFITS, LOST PROFITS, OR LOST DATA, ARISING FROM OR RELATING TO YOUR USE OF DEMETER. OUR TOTAL LIABILITY FOR ALL CLAIMS WILL NOT EXCEED ONE HUNDRED U.S. DOLLARS ($100).",
        },
        {
          kind: "p",
          text: "These limits do not apply to liability that cannot be limited under applicable law, including liability for fraud, gross negligence, or intentional misconduct. Some states do not allow these exclusions, so parts of this section may not apply to you.",
        },
      ],
    },
    {
      id: "indemnity",
      heading: "12. Indemnification",
      blocks: [
        {
          kind: "p",
          text: "If you misuse Demeter — by breaking the rules in Section 6, by violating the law, or by infringing someone else's rights — and a third party brings a claim against us because of it, you agree to defend and indemnify us against that claim and its reasonable costs, to the extent permitted by law.",
        },
        {
          kind: "p",
          text: "This does not apply to ordinary use of Demeter. Asking questions, saving a conversation, emailing yourself an outline, or relying on an answer that turned out to be wrong are not things you owe us anything for. It also does not apply to claims arising from our own conduct.",
        },
      ],
    },
    {
      id: "disputes",
      heading: "13. Dispute resolution and binding arbitration",
      blocks: [
        {
          kind: "callout",
          tone: "warning",
          text: "PLEASE READ THIS SECTION CAREFULLY. IT REQUIRES YOU AND CIVICA TO ARBITRATE MOST DISPUTES INDIVIDUALLY RATHER THAN IN COURT. IT WAIVES YOUR RIGHT TO A JURY TRIAL AND YOUR RIGHT TO PARTICIPATE IN A CLASS ACTION OR OTHER REPRESENTATIVE PROCEEDING. SECTION 13.10 EXPLAINS HOW TO OPT OUT WITHIN 30 DAYS.",
        },
        {
          kind: "p",
          text: '13.1 Claims covered. A "Claim" is any dispute, claim, or controversy between you and Civica arising from or relating to these Terms or the service, on any legal theory, including privacy and data security claims and claims about whether this section is enforceable. Section 13.3 lists the exceptions.',
        },
        {
          kind: "p",
          text: "13.2 Informal resolution first. Before starting arbitration, the party with the Claim must send the other a written notice describing the Claim, the date it arose, the facts it rests on, and the relief sought, signed personally by the person bringing it (not only by their lawyer) and including their name, address, email, and phone number. Both parties will then try in good faith to resolve it for 45 days. You send your notice to " + CONTACT.legal + " or by certified mail to " + ENTITY + ", Attn: Legal, [MAILING ADDRESS]. We will send ours to the contact information we have for you. No arbitration may be filed before this 45-day period ends, and the limitations period is paused while it runs.",
        },
        {
          kind: "p",
          text: "13.3 Exceptions. Either party may bring an individual claim in small claims court if it qualifies, and either party may go to court for claims about intellectual property, including for an injunction. Nothing here prevents you from reporting a concern to a government agency.",
        },
        {
          kind: "p",
          text: "13.4 Binding individual arbitration. Except as stated in Section 13.3, Claims not resolved informally must be resolved by final and binding individual arbitration administered by the American Arbitration Association (AAA) under the Federal Arbitration Act. If you use Demeter for personal, family, or household purposes, the AAA Consumer Arbitration Rules apply, as modified by these Terms. The arbitrator decides all procedural and substantive questions, including arbitrability, and may award only relief individual to the party bringing the Claim.",
        },
        {
          kind: "p",
          text: "13.5 Procedure and location. Arbitration is conducted by one arbitrator in English. If the amount sought is less than $10,000, the arbitrator decides on written submissions unless a hearing is necessary. Otherwise hearings are held by video or telephone unless the arbitrator determines an in-person hearing is necessary, in which case the location is set under the applicable AAA rules. The award will state the decision and its essential reasons and may be entered as a judgment in any court with jurisdiction.",
        },
        {
          kind: "p",
          text: "13.6 Fees. Arbitration fees are governed by the applicable AAA rules. Under the AAA Consumer Rules, the business pays most of the filing and arbitrator fees for consumer claims.",
        },
        {
          kind: "p",
          text: "13.7 Frivolous claims. To the extent permitted by law, if an arbitrator finds that a Claim was not warranted by existing law or a non-frivolous argument, lacked evidentiary support, or was brought for an improper purpose such as harassment or delay, the party who brought it must pay the other party's related costs and fees.",
        },
        {
          kind: "p",
          text: "13.8 Confidentiality. If confidential, proprietary, or sensitive information may be exchanged in an arbitration, both parties will ask the arbitrator for protection of that information before it is exchanged.",
        },
        {
          kind: "p",
          text: '13.9 Mass disputes. If 25 or more notices raising similar Claims and brought by the same or coordinated counsel are received, they are a "Mass Dispute" and the AAA Mass Arbitration Supplementary Rules apply, as modified here. The parties will first select 20 notices — 10 chosen by each side — to proceed as initial arbitrations, each before its own arbitrator. No other demand may be filed, and no related fees assessed, until those conclude. The parties will then mediate all remaining notices once. If more than 100 notices remain unresolved after mediation, either side may elect, in writing within 30 days, to remove all remaining notices from arbitration, in which case they proceed in court under Section 14. Otherwise the AAA will randomly select up to 30 more to proceed, and the process repeats until all are resolved.',
        },
        {
          kind: "p",
          text: "13.10 How to opt out of arbitration. You may opt out of this Section 13 within 30 days of first accepting these Terms by emailing " + CONTACT.legal + " with your full name, mailing address, email address, and a clear statement that you are opting out of arbitration. Opting out costs you nothing and does not affect your use of Demeter in any way. If you opt out, disputes are resolved under Section 14.",
        },
        {
          kind: "p",
          text: "13.11 Rejecting future changes. If we change this Section 13, you may reject the change as to you by emailing " + CONTACT.legal + " within 30 days of the change, with your name, mailing address, and email address. The most recent version you have not rejected will continue to apply. Changes to notice addresses are excluded.",
        },
        {
          kind: "p",
          text: "13.12 Severability. If any part of this Section 13 is found unenforceable, that part is severed and the rest remains in effect — except that if the class-action waiver is found unenforceable as to some claims, those claims proceed in court rather than in arbitration, and the litigation of them is stayed until any individual arbitration concludes. If a part of this section would bar a claim for public injunctive relief, that part has no effect as to that claim.",
        },
      ],
    },
    {
      id: "law",
      heading: "14. Governing law and venue",
      blocks: [
        {
          kind: "p",
          text: "These Terms are governed by the laws of the Commonwealth of Massachusetts, without regard to its conflict of laws rules, except where federal law controls. For any dispute not subject to arbitration, you and Civica consent to the exclusive jurisdiction of the state and federal courts located in Massachusetts.",
        },
        {
          kind: "p",
          text: "Nothing in these Terms takes away a right you have under the mandatory consumer-protection law of the state where you live, and nothing in them prevents you from reporting a concern to a state attorney general, a federal agency, or your state SNAP agency.",
        },
      ],
    },
    {
      id: "misc",
      heading: "15. Other terms",
      blocks: [
        {
          kind: "ul",
          items: [
            "Changes. We may update these Terms. We will change the date at the top, and for material changes we will say so on the site. Continuing to use Demeter after a change means you accept it.",
            "Assignment. You may not assign these Terms. We may assign them in connection with a merger, acquisition, or transfer of the service.",
            "Waiver. If we do not enforce a provision, that is not a waiver of it.",
            "Severability. If a provision is unenforceable, it is limited or removed to the minimum extent necessary and the rest remains in effect.",
            "Entire agreement. These Terms and the Privacy Policy are the entire agreement between you and Civica about Demeter.",
            "Notices. We may give you notice by posting on the site or, if you have an account, by email. You give us notice at " + CONTACT.legal + ".",
            "No third-party beneficiaries. These Terms are between you and Civica. They do not give anyone else rights to enforce them.",
            "Email. We send only the messages the service needs to work — your sign-in link, and an outline if you ask for one. We do not send marketing email. If that ever changes, it will be something you opt into, with a working unsubscribe link.",
            "No agency relationship. Nothing here makes you and Civica partners, employer and employee, or agents of one another.",
          ],
        },
      ],
    },
    {
      id: "contact",
      heading: "16. Contact",
      blocks: [
        {
          kind: "p",
          text: `Demeter is operated by ${ENTITY}. Questions about these Terms: ${CONTACT.legal}. Questions about privacy: ${CONTACT.privacy}.`,
        },
      ],
    },
  ],
};
