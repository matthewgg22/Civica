import { describe, it, expect } from "vitest";
import {
  packetAnswersToFacts,
  estimatePacketBenefit,
  rowsToAnswers,
} from "../facts-adapter";

describe("packetAnswersToFacts", () => {
  it("maps the real collected keys into a runnable Facts", () => {
    const { facts, confirmForVerdict, assumptions } = packetAnswersToFacts({
      household_size: "1",
      monthly_income: "1200",
      monthly_rent: "900",
      employment_status: "employed",
      has_disability: "false",
    });
    expect(facts.household).toHaveLength(1);
    expect(facts.household[0]!.role).toBe("head");
    expect(facts.income[0]).toMatchObject({ type: "wages", amount: 1200 });
    expect(facts.shelter.rent).toBe(900);
    // The unknowns must be surfaced, not silently trusted.
    expect(confirmForVerdict.join(" ")).toMatch(/immigration/i);
    expect(confirmForVerdict.join(" ")).toMatch(/assets/i);
    expect(assumptions.length).toBeGreaterThan(0);
  });

  it("builds head + dependents for a multi-person household", () => {
    const { facts } = packetAnswersToFacts({ household_size: "3" });
    expect(facts.household).toHaveLength(3);
    expect(facts.household[0]!.role).toBe("head");
    expect(facts.household[1]!.role).toBe("child");
  });

  it("self-employment maps to the SE income type", () => {
    const { facts } = packetAnswersToFacts({ monthly_income: "800", employment_status: "self-employed" });
    expect(facts.income[0]!.type).toBe("self_employment");
  });

  it("defaults to a 1-person household and no income when answers are sparse", () => {
    const { facts } = packetAnswersToFacts({});
    expect(facts.household).toHaveLength(1);
    expect(facts.income).toHaveLength(0);
  });
});

describe("estimatePacketBenefit", () => {
  it("produces a real estimated benefit from the collected data", () => {
    const r = estimatePacketBenefit(
      { household_size: "1", monthly_income: "1200", monthly_rent: "900", monthly_utilities: "150" },
      "CA",
      new Date("2026-06-01"),
    );
    expect(typeof r.estimatedMonthlyBenefitUsd).toBe("number");
    expect(r.estimatedMonthlyBenefitUsd).toBeGreaterThan(0);
    expect(r.confirmForVerdict.length).toBeGreaterThan(0);
  });

  it("a zero-income single applicant gets the max-ish allotment (sanity)", () => {
    const lowIncome = estimatePacketBenefit({ household_size: "1", monthly_income: "0", monthly_rent: "1500" }, "CA", new Date("2026-06-01"));
    const highIncome = estimatePacketBenefit({ household_size: "1", monthly_income: "2500", monthly_rent: "1500" }, "CA", new Date("2026-06-01"));
    // More income → less benefit (monotonic), the core sanity check.
    expect(lowIncome.estimatedMonthlyBenefitUsd).toBeGreaterThanOrEqual(highIncome.estimatedMonthlyBenefitUsd);
  });
});

describe("rowsToAnswers", () => {
  it("prefers the navigator-confirmed value over the applicant answer", () => {
    const answers = rowsToAnswers([
      { question_key: "monthly_income", applicant_answer: "1200", navigator_confirmed_value: "1500" },
      { question_key: "monthly_rent", applicant_answer: "900", navigator_confirmed_value: null },
    ]);
    expect(answers.monthly_income).toBe("1500");
    expect(answers.monthly_rent).toBe("900");
  });
});
