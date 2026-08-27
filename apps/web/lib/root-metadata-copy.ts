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

export const ROOT_TITLE = "Civica: Apply for SNAP food benefits";

export const ROOT_DESCRIPTION =
  "SNAP, also called CalFresh, EBT, or food stamps, is monthly money for groceries. " +
  "Civica reads your state's rules and walks you through the application in about 10 minutes.";

export const ROOT_OG_DESCRIPTION =
  "See if you qualify for SNAP food benefits. Civica figures out your state's rules and " +
  "guides you through the application step by step.";
