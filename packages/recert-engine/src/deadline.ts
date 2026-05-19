/**
 * Recertification deadline estimation.
 *
 * Rules:
 *  - CA student households:     6-month certification period
 *  - CA non-student households: 12-month certification period
 *  - MA (all household types):  12-month certification period
 */

export type StateCode = 'CA' | 'MA';
export type HouseholdType = 'student' | 'standard';

export interface DeadlineEstimateInput {
  enrolledAt: string;   // ISO 8601 date string (e.g. "2026-01-15T00:00:00Z")
  state: StateCode;
  householdType: HouseholdType;
}

export interface ReminderSchedule {
  type: 'T-30' | 'T-7' | 'T-0';
  sendAt: string; // ISO 8601 date string
}

export interface DeadlineEstimate {
  certPeriodEnd: string;   // ISO 8601 date string (YYYY-MM-DD)
  source: 'estimated';
  reminders: ReminderSchedule[];
}

/** Add months to a date string, returning an ISO date string (YYYY-MM-DD). */
function addMonths(isoDate: string, months: number): string {
  const d = new Date(isoDate);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
}

/** Subtract days from a date string, returning an ISO date string (YYYY-MM-DD). */
function subtractDays(isoDate: string, days: number): string {
  const d = new Date(isoDate);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

/**
 * Compute reminder schedule relative to certPeriodEnd.
 * T-30: 30 days before
 * T-7:   7 days before
 * T-0:   day of
 */
export function reminders(input: { certPeriodEnd: string }): ReminderSchedule[] {
  const { certPeriodEnd } = input;
  return [
    { type: 'T-30', sendAt: subtractDays(certPeriodEnd, 30) },
    { type: 'T-7',  sendAt: subtractDays(certPeriodEnd, 7) },
    { type: 'T-0',  sendAt: certPeriodEnd },
  ];
}

/**
 * Estimate the certification period end date and reminder schedule for a household.
 */
export function estimate(input: DeadlineEstimateInput): DeadlineEstimate {
  const { enrolledAt, state, householdType } = input;

  const certMonths =
    state === 'CA' && householdType === 'student' ? 6 : 12;

  const certPeriodEnd = addMonths(enrolledAt, certMonths);

  return {
    certPeriodEnd,
    source: 'estimated',
    reminders: reminders({ certPeriodEnd }),
  };
}
