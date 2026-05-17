import { describe, it, expect } from "vitest";
import {
  analyzeRentTransactions,
  buildGigIncomePackage,
  buildSharedLeasePackage,
  buildUtilityPackage,
  determineSuaTier,
} from "./index";
import type { PlaidTransaction } from "@/lib/plaid";
import type {
  IncomeSource,
  StateCode,
  UtilityAccount,
  UtilityIntake,
} from "@/types/verification";

// ---------- determineSuaTier ----------

const intake = (
  paid: Partial<UtilityIntake["utilities_paid_by_applicant"]>,
  state: StateCode = "CA"
): UtilityIntake => ({
  state_code: state,
  landlord_pays_any: false,
  utilities_paid_by_applicant: {
    heat_gas: false,
    electricity: false,
    cooling: false,
    water: false,
    phone_internet: false,
    none: false,
    ...paid,
  },
});

describe("determineSuaTier — CA rules", () => {
  it("returns full when heat/gas is paid", () => {
    expect(determineSuaTier(intake({ heat_gas: true }))).toBe("full");
  });

  it("returns full when electricity is paid (CA treats electric as heat/cool)", () => {
    expect(determineSuaTier(intake({ electricity: true }))).toBe("full");
  });

  it("returns full when only cooling is paid (CA HCSUA includes A/C)", () => {
    expect(determineSuaTier(intake({ cooling: true }))).toBe("full");
  });

  it("prefers full over limited when both heat and water are paid", () => {
    expect(determineSuaTier(intake({ heat_gas: true, water: true }))).toBe("full");
  });

  it("returns LIMITED only when ≥2 non-heat utilities are paid (CA threshold)", () => {
    expect(determineSuaTier(intake({ water: true, phone_internet: true }))).toBe("limited");
  });

  it("returns NONE for water-only in CA (below 2-utility LUA threshold)", () => {
    expect(determineSuaTier(intake({ water: true }))).toBe("none");
  });

  it("returns telephone when only phone/internet is paid", () => {
    expect(determineSuaTier(intake({ phone_internet: true }))).toBe("telephone");
  });

  it("returns none when applicant pays nothing", () => {
    expect(determineSuaTier(intake({}))).toBe("none");
  });

  it("returns none when 'none of the above' is checked", () => {
    expect(determineSuaTier(intake({ none: true }))).toBe("none");
  });
});

describe("determineSuaTier — MA rules", () => {
  it("returns full when heat/gas is paid", () => {
    expect(determineSuaTier(intake({ heat_gas: true }, "MA"))).toBe("full");
  });

  it("does NOT treat electricity alone as heating tier in MA", () => {
    // MA only qualifies heat/gas for HCSUA; electricity-only falls through.
    expect(determineSuaTier(intake({ electricity: true }, "MA"))).toBe("none");
  });

  it("returns LIMITED for water-only in MA (1-utility LUA threshold)", () => {
    expect(determineSuaTier(intake({ water: true }, "MA"))).toBe("limited");
  });

  it("returns telephone for phone-only in MA", () => {
    expect(determineSuaTier(intake({ phone_internet: true }, "MA"))).toBe("telephone");
  });
});

// ---------- buildUtilityPackage ----------

const acct = (holder: string): UtilityAccount => ({
  utility: "PG&E",
  account_holder_name: holder,
  service_address: "1421 Mission St",
  account_status: "active",
  utility_type: "electric",
  source: "utilityapi_sandbox",
});

describe("buildUtilityPackage basis logic", () => {
  it("api_confirmed when applicant declares paying AND name matches an account", () => {
    const pkg = buildUtilityPackage({
      applicantName: "Alex Applicant",
      serviceAddress: "1421 Mission St",
      intake: intake({ heat_gas: true }),
      accounts: [acct("Alex Applicant")],
      nameMatch: true,
    });
    expect(pkg.basis).toBe("api_confirmed");
    expect(pkg.tier).toBe("full");
    expect(pkg.attestation_required).toBe(false);
  });

  it("conflicting when applicant declares paying but accounts are held by someone else", () => {
    const pkg = buildUtilityPackage({
      applicantName: "Alex Applicant",
      serviceAddress: "1422 Mission St",
      intake: intake({ heat_gas: true }),
      accounts: [acct("Maria Landlord")],
      nameMatch: false,
    });
    expect(pkg.basis).toBe("conflicting");
    expect(pkg.attestation_required).toBe(true);
  });

  it("self_declared when no accounts are found", () => {
    const pkg = buildUtilityPackage({
      applicantName: "Alex Applicant",
      serviceAddress: "1423 Mission St",
      intake: intake({ heat_gas: true }),
      accounts: [],
      nameMatch: false,
    });
    expect(pkg.basis).toBe("self_declared");
    expect(pkg.attestation_required).toBe(true);
  });

  it("self_declared when applicant declares nothing (no utilities paid)", () => {
    const pkg = buildUtilityPackage({
      applicantName: "Alex Applicant",
      serviceAddress: "1421 Mission St",
      intake: intake({ none: true }),
      accounts: [acct("Alex Applicant")],
      nameMatch: true,
    });
    expect(pkg.basis).toBe("self_declared");
    expect(pkg.tier).toBe("none");
  });
});

// ---------- analyzeRentTransactions ----------

const txn = (date: string, amount: number, counterparty = "Sam Leaseholder"): PlaidTransaction => ({
  transaction_id: `tx_${date}`,
  date,
  amount,
  name: `VENMO PAYMENT TO ${counterparty.toUpperCase()}`,
  merchant_name: "Venmo",
  category: ["Transfer", "Rent"],
  counterparty,
});

describe("analyzeRentTransactions", () => {
  it("returns 'none' confidence for empty transactions", () => {
    const ev = analyzeRentTransactions([], 850, "Sam Leaseholder");
    expect(ev.match_found).toBe(false);
    expect(ev.confidence).toBe("none");
    expect(ev.months_confirmed).toBe(0);
  });

  it("scores high confidence on 3 monthly matches in counterparty name within ±15%", () => {
    const ev = analyzeRentTransactions(
      [txn("2026-05-08", 841.5), txn("2026-04-08", 850), txn("2026-03-09", 858.5)],
      850,
      "Sam Leaseholder"
    );
    expect(ev.match_found).toBe(true);
    expect(ev.confidence).toBe("high");
    expect(ev.frequency).toBe("monthly");
    expect(ev.months_confirmed).toBe(3);
    expect(ev.matched_amount).toBeCloseTo(850, 0);
  });

  it("excludes transactions outside the ±15% amount tolerance", () => {
    const ev = analyzeRentTransactions(
      [
        txn("2026-05-08", 850),
        txn("2026-04-08", 850),
        txn("2026-03-09", 2000), // way out of range — should be ignored
      ],
      850,
      "Sam Leaseholder"
    );
    expect(ev.months_confirmed).toBe(2);
    expect(ev.matched_amount).toBeCloseTo(850, 0);
  });

  it("includes amounts at the edge of the ±15% tolerance", () => {
    // 850 * 1.15 = 977.5  →  977.5 is just inside
    const ev = analyzeRentTransactions([txn("2026-05-08", 977.5)], 850, "Sam Leaseholder");
    expect(ev.months_confirmed).toBe(1);
  });

  it("flags irregular cadence as frequency='irregular'", () => {
    const ev = analyzeRentTransactions(
      [txn("2026-05-08", 850), txn("2026-04-25", 850)], // ~13 days apart
      850,
      "Sam Leaseholder"
    );
    expect(ev.frequency).toBe("irregular");
  });

  it("drops to low confidence when name does not appear in transaction text", () => {
    const ev = analyzeRentTransactions(
      [
        { ...txn("2026-05-08", 850), name: "ZELLE XFER", counterparty: "Anonymous" },
        { ...txn("2026-04-08", 850), name: "ZELLE XFER", counterparty: "Anonymous" },
        { ...txn("2026-03-09", 850), name: "ZELLE XFER", counterparty: "Anonymous" },
      ],
      850,
      "Sam Leaseholder"
    );
    expect(ev.confidence).toBe("low");
  });
});

// ---------- buildSharedLeasePackage ----------

describe("buildSharedLeasePackage QC defensibility", () => {
  const baseIntake = {
    lease_in_applicant_name: false,
    leaseholder_name: "Sam",
    stated_monthly_rent: 850,
    payment_method: "venmo_zelle" as const,
    address: "1421 Mission St",
  };
  const goodBank = analyzeRentTransactions(
    [txn("2026-05-08", 850), txn("2026-04-08", 850), txn("2026-03-09", 850)],
    850,
    "Sam"
  );
  const noBank = analyzeRentTransactions([], 850, "Sam");

  it("strong when document + high bank confidence + address valid", () => {
    const pkg = buildSharedLeasePackage({ stateCode: "CA",
      applicantName: "Alex",
      intake: baseIntake,
      documentType: "landlord_letter",
      documentFilename: "letter.pdf",
      bankEvidence: goodBank,
      addressValid: true,
      addressNormalized: "1421 MISSION ST",
    });
    expect(pkg.qc_defensibility_score).toBe("strong");
  });

  it("moderate when only one of document/bank is present", () => {
    const pkg = buildSharedLeasePackage({ stateCode: "CA",
      applicantName: "Alex",
      intake: baseIntake,
      documentType: "none",
      bankEvidence: goodBank,
      addressValid: true,
    });
    expect(pkg.qc_defensibility_score).toBe("moderate");
  });

  it("weak when neither document nor bank evidence", () => {
    const pkg = buildSharedLeasePackage({ stateCode: "CA",
      applicantName: "Alex",
      intake: baseIntake,
      documentType: "none",
      bankEvidence: noBank,
      addressValid: true,
    });
    expect(pkg.qc_defensibility_score).toBe("weak");
  });

  it("weak when address is invalid, even with strong document and bank", () => {
    const pkg = buildSharedLeasePackage({ stateCode: "CA",
      applicantName: "Alex",
      intake: baseIntake,
      documentType: "sublease",
      bankEvidence: goodBank,
      addressValid: false,
    });
    expect(pkg.qc_defensibility_score).toBe("weak");
  });
});

// ---------- buildGigIncomePackage ----------

const src = (
  type: IncomeSource["type"],
  method: IncomeSource["verification_method"],
  monthly: number,
  name = "src"
): IncomeSource => ({
  type,
  source_name: name,
  monthly_average: monthly,
  verification_method: method,
  confidence:
    method === "argyle_api" ? "verified" : method === "plaid_deposits" ? "corroborated" : "self_declared",
});

describe("buildGigIncomePackage reconciliation", () => {
  it("sums totals across all source types", () => {
    const pkg = buildGigIncomePackage({ stateCode: "CA",
      applicantName: "Alex",
      sources: [
        src("w2", "argyle_api", 2400, "Acme"),
        src("w2", "plaid_deposits", 2300, "Acme bank"),
        src("cash", "self_declared", 200, "Cash"),
      ],
      cashAttestationSigned: true,
    });
    expect(pkg.total_monthly_verified).toBe(2400);
    expect(pkg.total_monthly_bank_corroborated).toBe(2300);
    expect(pkg.total_monthly_self_declared_cash).toBe(200);
    expect(pkg.total_monthly_declared).toBe(4900);
  });

  it("does not flag when Plaid corroborates Argyle within 25%", () => {
    const pkg = buildGigIncomePackage({ stateCode: "CA",
      applicantName: "Alex",
      sources: [
        src("w2", "argyle_api", 2400),
        src("w2", "plaid_deposits", 2200), // ~8% lower (taxes/fees)
      ],
      cashAttestationSigned: true,
    });
    expect(pkg.reconciliation_flag).toBe(false);
  });

  it("flags when Plaid deposits are >25% over Argyle (unexplained income)", () => {
    const pkg = buildGigIncomePackage({ stateCode: "CA",
      applicantName: "Alex",
      sources: [
        src("w2", "argyle_api", 2000),
        src("w2", "plaid_deposits", 3000), // +50%
      ],
      cashAttestationSigned: true,
    });
    expect(pkg.reconciliation_flag).toBe(true);
    expect(pkg.reconciliation_gap).toBe(1000);
  });

  it("flags when Plaid deposits are >25% under Argyle (missing deposits)", () => {
    const pkg = buildGigIncomePackage({ stateCode: "CA",
      applicantName: "Alex",
      sources: [
        src("w2", "argyle_api", 2000),
        src("w2", "plaid_deposits", 1200), // -40%
      ],
      cashAttestationSigned: true,
    });
    expect(pkg.reconciliation_flag).toBe(true);
    expect(pkg.reconciliation_gap).toBe(-800);
  });

  it("does not flag when there is no Argyle baseline", () => {
    const pkg = buildGigIncomePackage({ stateCode: "CA",
      applicantName: "Alex",
      sources: [src("cash", "self_declared", 800)],
      cashAttestationSigned: true,
    });
    expect(pkg.reconciliation_flag).toBe(false);
  });
});
