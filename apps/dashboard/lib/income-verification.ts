export type PayPeriod = "weekly" | "biweekly" | "semimonthly" | "monthly" | "annual";

const PERIODS_PER_YEAR: Record<PayPeriod, number> = {
  weekly: 52,
  biweekly: 26,
  semimonthly: 24,
  monthly: 12,
  annual: 1,
};

export function annualizePayAmount(amount: number, period: PayPeriod): number {
  return amount * PERIODS_PER_YEAR[period];
}

export interface IncomeComparison {
  reported_monthly: number | null;
  ocr_monthly: number | null;
  delta_pct: number | null;
  /** "incomplete" = OCR extracted a pay amount but the pay period is missing, so no monthly conversion is possible */
  direction: "under" | "over" | "match" | "incomplete" | null;
  flagged: boolean;
}

const FLAG_THRESHOLD = 0.1;

export function compareIncome(
  reported_monthly: number | null,
  ocr_pay_amount: number | null,
  ocr_pay_period: PayPeriod | null,
): IncomeComparison {
  // Amount extracted but pay period unknown — can't compute a monthly figure
  if (ocr_pay_amount !== null && ocr_pay_period === null) {
    return { reported_monthly, ocr_monthly: null, delta_pct: null, direction: "incomplete", flagged: false };
  }

  if (reported_monthly === null || ocr_pay_amount === null || ocr_pay_period === null) {
    return { reported_monthly, ocr_monthly: null, delta_pct: null, direction: null, flagged: false };
  }

  const ocr_monthly = annualizePayAmount(ocr_pay_amount, ocr_pay_period) / 12;

  if (reported_monthly === 0) {
    return { reported_monthly, ocr_monthly, delta_pct: null, direction: null, flagged: true };
  }

  const delta_pct = (ocr_monthly - reported_monthly) / reported_monthly;
  const flagged = Math.abs(delta_pct) > FLAG_THRESHOLD;
  const direction: "under" | "over" | "match" =
    Math.abs(delta_pct) <= FLAG_THRESHOLD ? "match" : delta_pct > 0 ? "over" : "under";

  return { reported_monthly, ocr_monthly, delta_pct, direction, flagged };
}
