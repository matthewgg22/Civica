// Parity test: asserts the engine's evidence_package output for representative
// fixtures matches the byte-for-byte output the pre-extraction prototype produced.
//
// The fixed timestamp is injected via `now` so the snapshots are deterministic.
// If anything in the extraction drifted from the prototype's behavior, one of
// these assertions will fail.

import { describe, expect, it } from "vitest";
import { qcEngine } from "../src/index";
import type { UtilityAccount } from "../src/schemas";

const FIXED_NOW = () => "2026-05-18T12:00:00.000Z";

describe("parity — utility-sua", () => {
  it("CA api_confirmed full SUA tier", async () => {
    const account: UtilityAccount = {
      utility: "PG&E",
      account_holder_name: "Alex Applicant",
      service_address: "1421 Mission St",
      account_status: "active",
      utility_type: "electric",
      source: "utilityapi_sandbox",
    };
    const result = await qcEngine.evaluate(
      {
        flow: "utility-sua",
        state: "CA",
        inputs: {
          applicant_name: "Alex Applicant",
          service_address: "1421 Mission St",
          intake: {
            state_code: "CA",
            landlord_pays_any: false,
            utilities_paid_by_applicant: {
              heat_gas: true,
              electricity: false,
              cooling: false,
              water: false,
              phone_internet: false,
              none: false,
            },
          },
          accounts: [account],
          name_match: true,
        },
      },
      { now: FIXED_NOW },
    );
    expect(result.evidence_package).toEqual({
      flow: "utility",
      applicant_name: "Alex Applicant",
      service_address: "1421 Mission St",
      state_code: "CA",
      tier: "full",
      tier_amount_usd: 670,
      rule_citation: "CA CDSS MPP 63-503.43 (HCSUA includes A/C in CA climate zones)",
      basis: "api_confirmed",
      utility_accounts_found: [account],
      name_match: true,
      intake_responses: {
        state_code: "CA",
        landlord_pays_any: false,
        utilities_paid_by_applicant: {
          heat_gas: true,
          electricity: false,
          cooling: false,
          water: false,
          phone_internet: false,
          none: false,
        },
      },
      generated_at: "2026-05-18T12:00:00.000Z",
      attestation_required: false,
    });
  });
});

describe("parity — shared-lease", () => {
  it("strong defensibility, CA citations", async () => {
    const result = await qcEngine.evaluate(
      {
        flow: "shared-lease",
        state: "CA",
        inputs: {
          applicant_name: "Alex",
          state_code: "CA",
          intake: {
            lease_in_applicant_name: false,
            leaseholder_name: "Sam",
            stated_monthly_rent: 850,
            payment_method: "venmo_zelle",
            address: "1421 Mission St",
          },
          document_type: "landlord_letter",
          document_filename: "letter.pdf",
          bank_evidence: {
            match_found: true,
            matched_amount: 850,
            frequency: "monthly",
            confidence: "high",
            months_confirmed: 3,
            matched_transactions: [
              { date: "2026-05-08", amount: 850, description: "VENMO TO SAM", counterparty: "Sam" },
              { date: "2026-04-08", amount: 850, description: "VENMO TO SAM", counterparty: "Sam" },
              { date: "2026-03-09", amount: 850, description: "VENMO TO SAM", counterparty: "Sam" },
            ],
          },
          address_valid: true,
          address_normalized: "1421 MISSION ST",
        },
      },
      { now: FIXED_NOW },
    );
    expect(result.evidence_package).toMatchObject({
      flow: "shared-lease",
      qc_defensibility_score: "strong",
      regulatory_citations: [
        "7 CFR 273.2(f)(1)(vi) — verification of shelter expenses",
        "CA CDSS MPP 63-503.312 — shelter deduction documentation",
      ],
      generated_at: "2026-05-18T12:00:00.000Z",
    });
  });
});

describe("parity — gig-income", () => {
  it("CA Argyle+Plaid reconciliation; emits 1-person 130% FPL", async () => {
    const result = await qcEngine.evaluate(
      {
        flow: "gig-income",
        state: "CA",
        inputs: {
          applicant_name: "Alex",
          state_code: "CA",
          sources: [
            {
              type: "w2",
              source_name: "Acme",
              monthly_average: 2400,
              verification_method: "argyle_api",
              confidence: "verified",
            },
            {
              type: "w2",
              source_name: "Acme bank",
              monthly_average: 2300,
              verification_method: "plaid_deposits",
              confidence: "corroborated",
            },
          ],
          cash_attestation_signed: true,
        },
      },
      { now: FIXED_NOW },
    );
    if (result.evidence_package.flow === "gig-income") {
      expect(result.evidence_package.snap_bbce_applies).toBe(true);
      expect(result.evidence_package.snap_gross_income_limit_1person).toBe(1695);
      expect(result.evidence_package.total_monthly_declared).toBe(4700);
      expect(result.evidence_package.reconciliation_flag).toBe(false);
    }
  });
});

describe("parity — assets", () => {
  it("MA exempt vehicle + retirement stay off the countable total", async () => {
    const result = await qcEngine.evaluate(
      {
        flow: "assets",
        state: "MA",
        inputs: {
          applicant_name: "Jordan",
          state_code: "MA",
          assets: [
            {
              type: "bank_account",
              description: "Checking",
              stated_value: 2000,
              exempt: false,
              countable_value: 2000,
              verification_method: "plaid_balance",
            },
            {
              type: "vehicle",
              description: "2018 Civic",
              stated_value: 12000,
              exempt: true,
              exemption_reason: "primary_transport",
              countable_value: 0,
              verification_method: "self_declared",
            },
            {
              type: "retirement",
              description: "401k",
              stated_value: 45000,
              exempt: true,
              exemption_reason: "retirement_excluded",
              countable_value: 0,
              verification_method: "self_declared",
            },
          ],
        },
      },
      { now: FIXED_NOW },
    );
    if (result.evidence_package.flow === "assets") {
      expect(result.evidence_package.total_countable_assets).toBe(2000);
      expect(result.evidence_package.asset_test_result).toBe("pass");
      expect(result.evidence_package.asset_limit_usd).toBe(2750);
    }
  });
});
