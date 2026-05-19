/**
 * Question personalizer for recertification interviews.
 *
 * Takes a structural snapshot of the enrollment packet and returns a copy of
 * the interview question list with text fields adapted to the applicant's
 * specific situation. Questions that are irrelevant given the snapshot are
 * filtered out entirely.
 *
 * Never throws — falls back to the original question list on any error.
 */

import type { InterviewQuestion } from './questions.js';

export type PacketSnapshot = {
  state_code: 'CA' | 'MA';
  // Employment
  is_employed?: boolean;
  employer_count?: number;        // number of employers (≥2 means "multiple")
  // Income
  income_source_count?: number;
  // Household
  has_dependent_under_6?: boolean;
  has_dependent_under_14?: boolean;
  household_size?: number;
  // Student
  has_students?: boolean;
  // Assets
  has_vehicles?: boolean;
  has_bank_accounts?: boolean;
  // Work requirements
  is_subject_to_work_requirements?: boolean;
};

/**
 * Returns a copy of `questions` with text fields adapted to the packet snapshot.
 * Questions that are irrelevant given the snapshot are filtered out.
 * Never throws — falls back to the original list on any logic error.
 */
export function personalizeQuestions(
  questions: InterviewQuestion[],
  snapshot: PacketSnapshot,
): InterviewQuestion[] {
  try {
    const result: (InterviewQuestion | null)[] = questions.map((q) => {
      switch (q.topic) {
        case 'employment': {
          if ((snapshot.employer_count ?? 0) >= 2) {
            return {
              ...q,
              text: 'Are you still working at both jobs you reported last time?',
            };
          }
          if (snapshot.is_employed === false) {
            return {
              ...q,
              text: 'Have you found any employment since your last certification?',
            };
          }
          return q;
        }

        case 'income_change': {
          if ((snapshot.income_source_count ?? 0) >= 2) {
            return {
              ...q,
              text: `Have any of your ${snapshot.income_source_count} income sources changed — gone up, down, or stopped?`,
            };
          }
          return q;
        }

        case 'student_status': {
          if (snapshot.has_students === false) {
            return null;
          }
          return q;
        }

        case 'work_requirements': {
          if (snapshot.is_subject_to_work_requirements === false) {
            return null;
          }
          return q;
        }

        case 'assets': {
          if (snapshot.has_vehicles === false && snapshot.has_bank_accounts === false) {
            return null;
          }
          return q;
        }

        default:
          return q;
      }
    });

    return result.filter((q): q is InterviewQuestion => q !== null);
  } catch {
    // Never throw — return original question list on any error
    return questions;
  }
}
