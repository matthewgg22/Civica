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
  AZ: [
    "What is the income limit for SNAP in Arizona?",
    "Does my car count against me for SNAP in Arizona?",
    "How fast can I get emergency SNAP benefits in Arizona?",
  ],
  OR: [
    "What is the income limit for SNAP in Oregon?",
    "Is the SNAP work-requirement time limit waived anywhere in Oregon?",
    "Can I use my EBT card at a restaurant in Oregon?",
  ],
  WI: [
    "What is the income limit for FoodShare in Wisconsin?",
    "Does my car count against me for FoodShare in Wisconsin?",
    "How long does my FoodShare certification last in Wisconsin?",
  ],
  MN: [
    "What is the income limit for SNAP in Minnesota?",
    "Does my car count against me for SNAP in Minnesota?",
    "How fast can I get emergency SNAP benefits in Minnesota?",
  ],
  PA: [
    "What is the income limit for SNAP in Pennsylvania?",
    "Does my car count against me for SNAP in Pennsylvania?",
    "How fast can I get emergency SNAP benefits in Pennsylvania?",
  ],
  OH: [
    "What is the income limit for SNAP in Ohio?",
    "Is the SNAP work-requirement time limit waived anywhere in Ohio?",
    "How fast can I get emergency SNAP benefits in Ohio?",
  ],
  NC: [
    "What is the income limit for Food and Nutrition Services in North Carolina?",
    "Does my car count against me for SNAP in North Carolina?",
    "Is the SNAP work-requirement time limit waived anywhere in North Carolina?",
  ],
  NJ: [
    "What is the SNAP resource limit in New Jersey if I'm not categorically eligible?",
    "Does my boat count against me for SNAP in New Jersey?",
    "Is the SNAP work-requirement time limit currently waived anywhere in New Jersey?",
  ],
  VA: [
    "Is the SNAP work-requirement time limit currently waived anywhere in Virginia?",
    "Can I use my EBT card to buy a hot meal at a restaurant in Virginia?",
    "I have a drug felony conviction — can I still get SNAP in Virginia?",
  ],
  TN: [
    "What is Expanded Categorical Eligibility and how does it affect my SNAP eligibility in Tennessee?",
    "Is the SNAP work-requirement time limit currently waived anywhere in Tennessee?",
    "How long does my SNAP approval last in Tennessee?",
  ],
  IN: [
    "What is the income limit for SNAP in Indiana?",
    "Does my boat count against me for SNAP in Indiana?",
    "I have a drug felony conviction — can I still get SNAP in Indiana?",
  ],
  MO: [
    "What is the income limit for SNAP in Missouri?",
    "Does my car count against me for SNAP in Missouri?",
    "I have a drug felony conviction — can I still get SNAP in Missouri?",
  ],
  MD: [
    "What is the income limit for SNAP in Maryland?",
    "Can I use my EBT card to buy a hot meal at a restaurant in Maryland?",
    "I have a drug felony conviction — can I still get SNAP in Maryland?",
    "How long does my SNAP approval last in Maryland?",
  ],
  CO: [
    "What is the income limit for SNAP in Colorado?",
    "Does my car count against me for SNAP in Colorado?",
    "Can I buy soda or candy with my SNAP EBT card in Colorado?",
    "I have a drug felony conviction — can I still get SNAP in Colorado?",
  ],
  SC: [
    "What is the income limit for SNAP in South Carolina?",
    "I have a drug felony conviction — can I still get SNAP in South Carolina?",
    "Can I buy soda or candy with my SNAP EBT card in South Carolina?",
    "Does my car count against me for SNAP in South Carolina?",
  ],
  AL: [
    "What is the income limit for SNAP in Alabama?",
    "I have a drug felony conviction — can I still get SNAP in Alabama?",
    "Does my car count against me for SNAP in Alabama?",
    "How long does my SNAP approval last in Alabama?",
  ],
  LA: [
    "What is the income limit for SNAP in Louisiana?",
    "I have a drug felony conviction — can I still get SNAP in Louisiana?",
    "Does my car count against me for SNAP in Louisiana?",
    "Is the SNAP work-requirement time limit currently waived anywhere in Louisiana?",
    "Can I use my EBT card to buy a hot meal at a restaurant in Louisiana?",
  ],
  KY: [
    "What is the income limit for SNAP in Kentucky?",
    "I have a drug felony conviction — can I still get SNAP in Kentucky?",
    "Does my car count against me for SNAP in Kentucky?",
    "Is the SNAP work-requirement time limit currently waived anywhere in Kentucky?",
    "How fast can I get emergency SNAP benefits in Kentucky?",
  ],
  OK: [
    "What is the income limit for SNAP in Oklahoma?",
    "I have a drug felony conviction — can I still get SNAP in Oklahoma?",
    "Is the SNAP work-requirement time limit currently waived anywhere in Oklahoma?",
    "What is the ABAWD work requirement age range in Oklahoma?",
    "Can I use my EBT card to buy a hot meal at a restaurant in Oklahoma?",
  ],
  CT: [
    "What is the income limit for SNAP in Connecticut?",
    "I have a drug felony conviction — can I still get SNAP in Connecticut?",
    "Is the SNAP work-requirement time limit currently waived anywhere in Connecticut?",
    "Does Connecticut have a Restaurant Meals Program for SNAP?",
    "Does Connecticut's categorical eligibility raise my SNAP income limit above the normal amount?",
  ],
  UT: [
    "What is the income limit for SNAP in Utah?",
    "Can I buy soda with my SNAP benefits in Utah?",
    "Does my car count against me for SNAP in Utah?",
    "I have a drug felony conviction — can I still get SNAP in Utah?",
    "Is the SNAP work-requirement time limit currently waived anywhere in Utah?",
    "What is my EBT card called in Utah?",
  ],
  IA: [
    "What is the income limit for SNAP in Iowa?",
    "I have a drug felony conviction — can I still get SNAP in Iowa?",
    "Does my car count against me for SNAP in Iowa?",
    "What is the ABAWD work requirement age range in Iowa?",
    "How long does my SNAP approval last in Iowa?",
  ],
  AR: [
    "Does Arkansas's categorical eligibility raise my SNAP income limit above the normal amount?",
    "What is the SNAP resource limit in Arkansas, and can it be temporarily higher?",
    "I have a drug felony conviction — can I still get SNAP in Arkansas?",
    "What is the ABAWD work requirement age range in Arkansas?",
    "Can I use my EBT card to buy a hot meal at a restaurant in Arkansas?",
  ],
  MS: [
    "Does Mississippi's categorical eligibility raise my SNAP income limit above the normal amount?",
    "Is the SNAP work-requirement time limit currently waived anywhere in Mississippi?",
    "I have a drug felony conviction — can I still get SNAP in Mississippi?",
    "Does my car count against me for SNAP in Mississippi?",
    "How long does my SNAP approval last in Mississippi if I'm 65 or older?",
  ],
  KS: [
    "Does Kansas have broad-based categorical eligibility for SNAP?",
    "What is the SNAP asset or resource limit in Kansas?",
    "I have a drug felony conviction — can I still get SNAP in Kansas?",
    "Is the SNAP work-requirement time limit currently waived anywhere in Kansas?",
    "Can I use my EBT card to buy a hot meal at a restaurant in Kansas?",
  ],
  NM: [
    "What is the income limit for SNAP in New Mexico?",
    "Does my car or savings count against me for SNAP in New Mexico?",
    "I have a drug felony conviction — can I still get SNAP in New Mexico?",
    "Is the SNAP work-requirement time limit currently waived anywhere in New Mexico?",
    "Does New Mexico have a Restaurant Meals Program for SNAP?",
    "How long does my SNAP approval last if I'm elderly or disabled in New Mexico?",
  ],
  NE: [
    "What is the income limit for SNAP in Nebraska?",
    "I have a drug felony conviction — can I still get SNAP in Nebraska?",
    "Is the SNAP work-requirement time limit currently waived anywhere in Nebraska?",
    "Can I buy soda with my SNAP benefits in Nebraska?",
    "What is the SNAP resource limit in Nebraska, and can it be temporarily higher?",
  ],
  ID: [
    "What is the income limit for SNAP in Idaho?",
    "Does my car count against me for SNAP in Idaho?",
    "I have a drug felony conviction — can I still get SNAP in Idaho?",
    "Can I buy candy or soda with my SNAP benefits in Idaho?",
    "How do I apply for SNAP in Idaho?",
  ],
  WV: [
    "What is the income limit for SNAP in West Virginia?",
    "I have a drug felony conviction — can I still get SNAP in West Virginia?",
    "Is the SNAP work-requirement time limit currently waived anywhere in West Virginia?",
    "Can I buy soda with my SNAP benefits in West Virginia?",
    "Does West Virginia have a Restaurant Meals Program for SNAP?",
    "How do I apply for SNAP in West Virginia?",
  ],
  HI: [
    "What is the income limit for SNAP in Hawaii?",
    "I have a drug felony conviction — can I still get SNAP in Hawaii?",
    "Is there an ABAWD work-requirement waiver anywhere in Hawaii?",
    "Can I use my SNAP benefits at a restaurant in Hawaii?",
    "Why is the maximum SNAP benefit higher in Hawaii than the mainland?",
  ],
  ME: [
    "What is the income limit for SNAP in Maine?",
    "I have a drug felony conviction — can I still get SNAP in Maine?",
    "Is the SNAP work-requirement time limit currently waived anywhere in Maine?",
    "What is the SNAP resource limit in Maine?",
    "Does Maine have a Restaurant Meals Program for SNAP?",
    "What utility deduction can I get for SNAP in Maine?",
  ],
  NH: [
    "What is the income limit for SNAP in New Hampshire?",
    "Does New Hampshire have an asset or resource limit for SNAP?",
    "I have a drug felony conviction — can I still get SNAP in New Hampshire?",
    "How long does my SNAP certification last in New Hampshire?",
    "What utility deduction can I get for SNAP in New Hampshire?",
  ],
  SD: [
    "What is the SNAP resource limit in South Dakota?",
    "Does South Dakota have broad-based categorical eligibility for SNAP?",
    "I have a drug felony conviction — can I still get SNAP in South Dakota?",
    "Is the SNAP work-requirement time limit currently waived anywhere in South Dakota?",
    "Does South Dakota have a Restaurant Meals Program for SNAP?",
  ],
  MT: [
    "What is the income limit for SNAP in Montana?",
    "Does Montana have an asset or resource limit for SNAP?",
    "I have a drug felony conviction — can I still get SNAP in Montana?",
    "Is the SNAP work-requirement time limit currently waived anywhere in Montana?",
    "What utility deduction can I get for SNAP in Montana?",
    "How do I apply for SNAP in Montana?",
  ],
  DE: [
    "What is the income limit for SNAP in Delaware?",
    "Does Delaware have an asset or resource limit for SNAP?",
    "I have a drug felony conviction — can I still get SNAP in Delaware?",
    "Is the SNAP work-requirement time limit currently waived anywhere in Delaware?",
    "How long does my SNAP certification last in Delaware?",
    "Does Delaware have a Restaurant Meals Program for SNAP?",
  ],
};
