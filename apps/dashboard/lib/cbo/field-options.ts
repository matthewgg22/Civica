// Edit-mode option sets for the CBO-preview application responses. Shared by the
// inline caseload dropdown (ApplicationsQueue) and the full-application page
// editor (EditableApplicationResponses) so both edit the same fields the same way.
//
// A question listed here renders as a <select> in edit mode; anything else falls
// through to a free-text input. The current value is always included in the list
// so an off-list value (e.g. a flagged "Provided — does not match SSA records")
// still renders rather than being dropped.
export const FIELD_OPTIONS: Record<string, string[]> = {
  State: ["California"],
  "Programs applying for": ["CalFresh (SNAP)", "CalFresh + Medi-Cal", "CalFresh + CalWORKs"],
  "Received CalFresh before?": ["Yes", "No"],
  "Preferred language": ["English", "Spanish", "Chinese", "Vietnamese", "Tagalog", "Korean", "Other"],
  "Contact phone on file": ["Yes", "No"],
  "Citizenship / immigration status": ["U.S. citizen", "Lawful permanent resident", "Other qualified noncitizen", "Prefer not to say"],
  "Children under 14?": ["Yes", "No"],
  "Anyone 60+ or disabled?": ["Yes", "No"],
  "Anyone pregnant?": ["Yes", "No"],
  "Everyone applying is a citizen or eligible noncitizen?": ["Yes", "No"],
  "Housing situation": ["Renting", "Own my home", "Living with family or friends", "Transitional / temporary", "Shelter", "Unhoused / no fixed address"],
  "Employment status": ["Employed", "Self-employed", "Not employed"],
  "Income type": ["Wages / salary", "Self-employment", "Fixed income", "No income"],
  "Pay frequency": ["Weekly", "Every two weeks", "Twice monthly", "Monthly"],
  "Other income (SSI, unemployment, child support received)": ["None reported", "SSI", "Social Security", "Unemployment", "Child support received", "Pension"],
  "Enrolled in higher education (half-time or more)?": ["Yes", "No"],
  "Pays heating / cooling costs?": ["Yes", "No"],
  "Pays electricity or gas (separate from heating)?": ["Yes", "No"],
  "Pays for phone or internet?": ["Yes", "No"],
  "Receives HEAP energy assistance?": ["Yes", "No"],
  "Out-of-pocket medical (60+/disabled)": ["Not applicable", "$0.00"],
  "Countable assets (cash + bank)": ["Under $2,750.00", "$2,750.00 or more"],
  "Reduced hours or quit a job in the last 60 days?": ["Yes", "No"],
  "Fleeing felon or probation / parole violation?": ["Yes", "No"],
  "Drug-felony conviction?": ["Yes", "No"],
  "Photo ID": ["On hand", "Provided", "Requested", "Not yet uploaded"],
  "Proof of income": ["On hand", "Provided", "Requested", "Not provided"],
  "Proof of residence": ["On hand", "Provided", "Requested", "Not provided"],
  "Social Security Number": ["Provided", "Not provided"],
  "Expedited-service screen": ["Completed", "Not started"],
  "Signed under penalty of perjury": ["Yes", "No"],
};

/** Options for a question's edit control, or null for a free-text field. The
 *  current value is prepended when off-list so it never disappears. */
export function optionsFor(question: string, current: string): string[] | null {
  const opts = FIELD_OPTIONS[question];
  if (!opts) return null;
  return opts.includes(current) ? opts : [current, ...opts];
}

// The at-a-glance subset the caseload dropdown shows by default — the fields a
// navigator actually triages on. The full ~44-question intake stays one click
// away ("Show all" or the full-application page). Every entry here MUST exist in
// the expanded answer set or the summary would render a blank row (guarded in
// demo-pipeline.test.ts).
export const SUMMARY_QUESTIONS = [
  "Household size",
  "Anyone 60+ or disabled?",
  "Citizenship / immigration status",
  "Employment status",
  "Gross monthly income",
  "Monthly rent",
  "Monthly utilities",
  "Countable assets (cash + bank)",
  "Work registration / ABAWD",
  "Social Security Number",
] as const;
