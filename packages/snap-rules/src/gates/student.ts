// Student eligibility gate (7 CFR 273.5).
//
// Higher-education students 18-49 enrolled half-time or more are
// ineligible unless they meet an exemption. The fixture encodes the
// status enum in member.student:
//   "not"                                — not subject (under 18 / over 49 / not enrolled)
//   "he_halftime_subject"                — subject, no exemption
//   "he_exempt:work20"                   — works 20+ hours/wk
//   "he_exempt:work_study"               — work-study placement
//   "he_exempt:single_parent_child_under12"
//   "he_exempt:dependent_under6"
//   "he_exempt:tanf"                     — receives TANF (cat-elig)
//   "he_exempt:age50plus"                — age 50+ carve-out
//   "he_exempt:et_placement"             — SNAP E&T or WIOA placement
//
// Per Python `_student_test`: if no member 18-49 is at-risk, pass. If
// any at-risk member has no exemption, fail. Mixed-student HHs still
// run for the non-student members.

import type { Facts } from "../facts";

export interface StudentGateResult {
  passes: boolean;
  reason?: string;
}

export function evaluateStudentGate(facts: Facts): StudentGateResult {
  // Federal rule applies only to applicants 18-49 enrolled half-time+.
  const atRisk = facts.household.filter(
    (m) => m.age >= 18 && m.age <= 49 && m.student === "he_halftime_subject",
  );
  if (atRisk.length === 0) return { passes: true };

  // Any at-risk member without an exemption => HH fails student gate.
  // Note: the gate is "at least one at-risk applicant is unexempted",
  // not "all at-risk members are exempted" — but in single-applicant
  // profiles these collapse. Mixed-status proration (M18-style) needs
  // a richer model; flagged as Wave 2.
  for (const m of atRisk) {
    if (m.student && m.student.startsWith("he_exempt:")) continue;
    return {
      passes: false,
      reason: `ineligible_student [7 CFR 273.5]: ${m.member_id} half-time HE with no exemption`,
    };
  }
  return { passes: true };
}
