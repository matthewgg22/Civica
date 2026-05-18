import { describe, expect, it } from "vitest";
import {
  analyzeRentTransactions,
  qcEngine,
} from "../../src/index.js";
import type { RentTransaction } from "../../src/schemas.js";

const txn = (date: string, amount: number, counterparty = "Sam"): RentTransaction => ({
  transaction_id: `tx_${date}`,
  date,
  amount,
  name: `VENMO PAYMENT TO ${counterparty.toUpperCase()}`,
  counterparty,
  category: ["Transfer", "Rent"],
});

const baseIntake = {
  lease_in_applicant_name: false,
  leaseholder_name: "Sam",
  stated_monthly_rent: 850,
  payment_method: "venmo_zelle" as const,
  address: "1421 Mission St",
};

describe("shared-lease flow", () => {
  it("strong score when document + high-confidence bank + valid address", async () => {
    const bank = analyzeRentTransactions(
      [txn("2026-05-08", 850), txn("2026-04-08", 850), txn("2026-03-09", 850)],
      850,
      "Sam",
    );
    const result = await qcEngine.evaluate({
      flow: "shared-lease",
      state: "CA",
      inputs: {
        applicant_name: "Alex",
        state_code: "CA",
        intake: baseIntake,
        document_type: "landlord_letter",
        document_filename: "letter.pdf",
        bank_evidence: bank,
        address_valid: true,
        address_normalized: "1421 MISSION ST",
      },
    });
    expect(result.defensibility_score).toBe("strong");
  });

  it("analyzeRentTransactions assigns high confidence on 3 monthly matches", () => {
    const ev = analyzeRentTransactions(
      [txn("2026-05-08", 841.5), txn("2026-04-08", 850), txn("2026-03-09", 858.5)],
      850,
      "Sam",
    );
    expect(ev.confidence).toBe("high");
    expect(ev.frequency).toBe("monthly");
    expect(ev.months_confirmed).toBe(3);
  });

  it("weak when address invalid, even with strong evidence elsewhere", async () => {
    const bank = analyzeRentTransactions(
      [txn("2026-05-08", 850), txn("2026-04-08", 850), txn("2026-03-09", 850)],
      850,
      "Sam",
    );
    const result = await qcEngine.evaluate({
      flow: "shared-lease",
      state: "CA",
      inputs: {
        applicant_name: "Alex",
        state_code: "CA",
        intake: baseIntake,
        document_type: "sublease",
        bank_evidence: bank,
        address_valid: false,
      },
    });
    expect(result.defensibility_score).toBe("weak");
    expect(result.warnings.some((w) => w.code === "shared_lease.address_invalid")).toBe(true);
  });
});
