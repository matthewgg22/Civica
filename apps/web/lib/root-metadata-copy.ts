// The root layout's title and descriptions, as data.
//
// Extracted from app/layout.tsx so they can be TESTED. They could not be
// before: importing the layout pulls Next's font loaders, which do not run
// outside a Next build, so a copy test that imported it failed to collect at
// all. The strings were therefore the one place a copy guard could not reach —
// and one of them was broken. #1007's em-dash pass left the description
// reading "SNAP. Also called CalFresh, EBT, or food stamps. Is monthly money
// for groceries.", a stranded verb with no subject, on the root of the site.
//
// Plain strings in a plain module. No imports, so anything can read them.

// These describe DEMETER — the public answers chatbot — which is what the bare
// domain now serves. They used to describe the parked Civica apply wizard
// ("walks you through the application in ~10 minutes"), so a shared link
// promised an application flow and delivered a Q&A tool. Realigned to the
// product (launch audit 2026-08-29). No "CalFresh": it is one state's name for
// a program that works in every state, and this copy is state-neutral.
export const ROOT_TITLE = "Demeter — Verified SNAP answers, for any state";

export const ROOT_DESCRIPTION =
  "SNAP, also called EBT or food stamps, is monthly money for groceries. " +
  "Demeter answers your questions about it using your state's own rules, and cites the rule behind every answer so you can check it. " +
  "Free. No account.";

export const ROOT_OG_DESCRIPTION =
  "Ask anything about SNAP and get an answer grounded in your state's actual rules, with every claim cited so you can check it. " +
  "Free. No account. Any state.";
