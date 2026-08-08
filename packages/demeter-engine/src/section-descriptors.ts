// Plain-English descriptors of each SNAP regulation, in lay caseworker/applicant
// language. These are the semantic index for retrieval: a question is embedded
// and matched against these (NOT against the dense regulatory text, which embeds
// poorly against casual phrasing — verified 2026-06-07: "need food faster" vs
// raw 273.2(i) text scored 0.09, but vs this descriptor scored 0.62).
//
// `cite` is a citation prefix (section or subsection); a chunk gets the best
// (max) similarity of every descriptor whose cite matches it, so subsection
// descriptors add precision on top of the section descriptor. Write these the
// way people actually ask — synonyms, lay terms, the underlying worry.

export interface SectionDescriptor {
  cite: string; // "273.9" or "273.9(d)(6)"
  text: string;
}

export const DESCRIPTORS: SectionDescriptor[] = [
  // Application processing (273.2) — mostly subsection-specific questions
  { cite: "273.2", text: "Applying for SNAP/CalFresh, the application process, how to apply, what happens after you apply" },
  { cite: "273.2(c)", text: "Right to file an application the same day, applying without all your documents or ID, submitting an incomplete application and bringing proof later, what is the application date" },
  { cite: "273.2(e)", text: "The eligibility interview, what they ask in the interview, phone interview, scheduled interview, the worker was supposed to call about my case and did not, I missed the interview call from an unknown number, did I lose my application because I missed the call, rescheduling a missed interview, can someone be on the call with me" },
  { cite: "273.2(f)", text: "Verification and proof, what documents do I need, proof of income, they asked for documents I already sent, I am paid in cash and cannot get a pay stub, my employer will not give me a letter, what counts as alternative proof of income, document deadline, denied for failure to provide verification" },
  { cite: "273.2(g)", text: "How long the county has to process and decide, the 30 day standard, my application has been pending too long, no decision yet, delay, is the wait legal, timeliness" },
  { cite: "273.2(i)", text: "Expedited or emergency SNAP, getting benefits fast within seven days, I need food right now this week, no money and no food, urgent hunger, speed it up" },
  { cite: "273.2(n)", text: "Authorized representative, having someone apply or do the interview on your behalf, can a CBO or org submit the application for the client or only help, designating a helper" },

  // Household, residency, identity
  { cite: "273.1", text: "SNAP household composition, who is in my household, do I count my roommate or boyfriend or other people living with me, we live together but do not buy and cook food together, purchase and prepare meals separately" },
  { cite: "273.3", text: "Residency, where you live, you must live in the state, no fixed address, homeless applicant with no permanent home, what address to put" },
  { cite: "273.6", text: "Social Security number requirement, do I have to give an SSN for everyone in the household" },

  // Non-citizens (OBBBA-sensitive)
  { cite: "273.4", text: "Non-citizen and immigrant eligibility, lawful permanent resident green card holder, refugee or asylee, qualified alien, the five-year bar, sponsored immigrant, whether immigration status affects SNAP eligibility" },
  { cite: "273.11(c)", text: "Mixed-status household, an undocumented parent applying for U.S.-citizen or LPR children, an ineligible household member, prorating benefits for the eligible members" },

  // Income, assets, deductions, benefit amount
  { cite: "273.5", text: "College student eligibility for SNAP, students enrolled in higher education, student work or exemption rules" },
  { cite: "273.8", text: "Assets and resources, do my savings or bank account or car or house disqualify me, the asset limit, countable resources, retirement accounts" },
  { cite: "273.9(a)", text: "Income limits and tests, do I make too much to qualify, gross income limit, net income limit, am I over income, earn too much" },
  { cite: "273.9(b)", text: "What counts as income, whose income is counted, is child support received or unemployment or SSI counted, earned and unearned income" },
  { cite: "273.9(c)", text: "Income that does NOT count, income exclusions, a one-time lump sum, tax refund, nonrecurring payment, money that is excluded from income" },
  { cite: "273.9(d)", text: "Deductions from income, what can I deduct, standard deduction, earned income deduction, medical, dependent care, child support paid, shelter and utilities" },
  { cite: "273.9(d)(2)", text: "Earned income deduction, twenty percent of earnings from a job is deducted" },
  { cite: "273.9(d)(6)", text: "Shelter and utility deduction, rent or mortgage, housing costs, utility allowance, excess shelter cost" },
  { cite: "273.10", text: "How the benefit amount is calculated, how much SNAP will I get, the maximum allotment by household size, why is my benefit smaller than expected, proration in the first month, when benefits start from the application date, income from the last 30 days" },

  // Self-employment / special households
  { cite: "273.11", text: "Self-employment income, gig work, driving for Uber or Lyft, 1099 or independent contractor, selling things, business income, how to report self-employment, special household situations" },

  // Work requirements (OBBBA-sensitive)
  { cite: "273.7", text: "Work registration, Employment and Training program, voluntary quit, general work requirements other than the time limit" },
  { cite: "273.24", text: "ABAWD work requirement and three-month time limit, able-bodied adults without dependents, the 80 hours a month rule, exemptions from the time limit, age limit, will I lose benefits, documenting a medical or other exemption, veteran or homeless or former foster youth exemption" },

  // Reporting, notices, recert, appeals, restoration
  { cite: "273.12", text: "Reporting changes, I got a new job or lost my job or my hours changed, my income went up or down, I moved or changed address, I had a baby or someone moved in or out, what changes must I report and when" },
  { cite: "273.13", text: "Notice of adverse action, I got a confusing notice, my benefits are changing or being cut, termination notice, I don't understand the letter" },
  { cite: "273.14", text: "Recertification and renewal, the recert deadline, renewing benefits at the end of the certification period, my benefits suddenly stopped or were cut off or discontinued, did I lose my benefits, did I do something wrong, I probably missed my recertification, redetermination, do I start over if I missed the deadline" },
  { cite: "273.15", text: "Fair hearing and appeal, how do I fight or dispute a denial, I was denied for failure to cooperate but I sent everything, request a hearing, aid paid pending the appeal" },
  { cite: "273.16", text: "Intentional program violation, SNAP fraud, disqualification penalties" },
  { cite: "273.17", text: "Restoration of lost benefits, getting back benefits that were wrongly denied or underissued, underpayment, back benefits owed" },

  // Confidentiality, disqualifying winnings, quality control
  { cite: "272.1(c)", text: "Confidentiality and disclosure of applicant information, will ICE or immigration find out if I apply, is my information shared, data sharing, who sees my application" },
  { cite: "272.17", text: "Substantial lottery or gambling winnings disqualification" },
  { cite: "275.12", text: "Quality control case review, error rate, why a case is sampled or reviewed, escalating a stuck pending case" },
];
