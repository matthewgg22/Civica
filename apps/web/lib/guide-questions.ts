// Per-state starter questions for the SEO guide pages (/guides/[state]).
//
// Lives OUTSIDE the route module on purpose: a Next.js page file may only
// export the framework's known names (default, metadata, generateStaticParams,
// …), so exporting this from the page fails `tsc --noEmit` against Next's
// generated route types even though the app runs fine.
//
// Every verified pack must have an entry with at least three questions —
// app/guides/__tests__/guide-ssg.test.ts fails when a new state pack merges
// without its guide content, so this file is the checklist item that catches it.

export const QUESTIONS: Record<string, string[]> = {
  CA: [
    "What income limit applies to my CalFresh household?",
    "Do I have to do an interview for CalFresh?",
    "How fast can I get emergency CalFresh?",
  ],
  WA: [
    "What is the income limit for Basic Food?",
    "Does Washington have an asset test for Basic Food?",
    "What is WASHCAP and do I qualify?",
  ],
  TX: [
    "What is the income limit for SNAP in Texas?",
    "Does my car count against me for Texas SNAP?",
    "How fast can I get emergency food benefits in Texas?",
  ],
  NY: [
    "What income limit applies to my household in New York?",
    "Do I use myBenefits or ACCESS HRA to apply?",
    "Is there a simplified application for seniors in New York?",
  ],
  GA: [
    "What is the income limit for SNAP in Georgia?",
    "Does my car count against me for SNAP in Georgia?",
    "Is there a simplified SNAP application for seniors in Georgia?",
  ],
  MI: [
    "What is the income limit for FAP in Michigan?",
    "Does my car count against me for FAP in Michigan?",
    "How fast can I get emergency food assistance in Michigan?",
  ],
  IL: [
    "What is the income limit for SNAP in Illinois?",
    "Does my car count against me for SNAP in Illinois?",
    "How fast can I get emergency SNAP benefits in Illinois?",
  ],
  FL: [
    "What is the income limit for SNAP in Florida?",
    "Does my car count against me for SNAP in Florida?",
    "How fast can I get emergency SNAP benefits in Florida?",
  ],
  MA: [
    "What is the income limit for SNAP in Massachusetts?",
    "Does my car count against me for SNAP in Massachusetts?",
    "Can I use my EBT card at a restaurant in Massachusetts?",
  ],
  NV: [
    "What is the income limit for SNAP in Nevada?",
    "Does my car count against me for SNAP in Nevada?",
    "How fast can I get emergency SNAP benefits in Nevada?",
  ],
};
