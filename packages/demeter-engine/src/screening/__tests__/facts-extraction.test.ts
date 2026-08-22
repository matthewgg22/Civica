import { describe, it, expect, vi, beforeEach } from "vitest";

const sdk = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("@anthropic-ai/sdk", () => ({
  default: class FakeAnthropic {
    messages = { create: sdk.create };
  },
}));

import { mergeFactsPatch, extractFacts, type PartialFacts } from "../facts-extraction";

describe("mergeFactsPatch", () => {
  it("adds a new household member", () => {
    const merged = mergeFactsPatch(
      {},
      { household: [{ member_id: "applicant", age: 62, role: "head" }] },
    );
    expect(merged.household).toEqual([{ member_id: "applicant", age: 62, role: "head" }]);
  });

  // RENAMED. This used to be called "a correction REPLACES the prior value —
  // 'actually $1,300' wins" and set up an income line of 1180 that it never
  // touched: the assertion below is about a household AGE, and no $1,300
  // appears anywhere. The income setup was left over from a test that was
  // abandoned for the reason the comment gives, and the name outlived it —
  // so the suite claimed to cover income corrections and did not.
  //
  // Income correction is covered, correctly, by "appends income lines across
  // turns" below. Found by the first lint pass (#721) via the unused variable;
  // tsc cannot see a test whose name disagrees with its body.
  it("a corrected member field REPLACES the prior value — age 62 becomes 63", () => {
    // Extraction is additive on income lines (a caseworker who corrects an
    // amount is expected to say so in a way that produces a new line, not a
    // silent overwrite of a prior one) — so a correction is a new fact
    // patch on the SAME income line via member fields, tested via household.
    const corrected = mergeFactsPatch(
      { household: [{ member_id: "a", age: 62, role: "head" }] },
      { household: [{ member_id: "a", age: 63, role: "head" }] }, // corrected age
    );
    expect(corrected.household).toEqual([{ member_id: "a", age: 63, role: "head" }]);
  });

  it("merges partial member updates onto the SAME member without dropping earlier fields", () => {
    const step1 = mergeFactsPatch({}, { household: [{ member_id: "a", age: 62, role: "head" }] });
    const step2 = mergeFactsPatch(step1, { household: [{ member_id: "a", immigration: "citizen" }] });
    expect(step2.household).toEqual([{ member_id: "a", age: 62, role: "head", immigration: "citizen" }]);
  });

  it("appends income lines across turns rather than replacing the array", () => {
    const step1 = mergeFactsPatch({}, { income: [{ member: "a", type: "ssa", amount: 1180 }] });
    const step2 = mergeFactsPatch(step1, { income: [{ member: "a", type: "wages", amount: 200 }] });
    expect(step2.income).toHaveLength(2);
  });

  it("shallow-merges shelter and deductions, letting a new turn add fields", () => {
    const step1 = mergeFactsPatch({}, { shelter: { rent: 600 } });
    const step2 = mergeFactsPatch(step1, { shelter: { sua_tier: "HCSUA" } });
    expect(step2.shelter).toEqual({ rent: 600, sua_tier: "HCSUA" });
  });

  it("scalar fields REPLACE — a later assets figure overrides an earlier one", () => {
    const step1 = mergeFactsPatch({}, { assets: 300 });
    const step2 = mergeFactsPatch(step1, { assets: 500 });
    expect(step2.assets).toBe(500);
  });

  it("an empty patch changes nothing", () => {
    const base = mergeFactsPatch({}, { household: [{ member_id: "a", age: 40, role: "head" }] });
    const same = mergeFactsPatch(base, {});
    expect(same).toEqual(base);
  });
});

// extractFacts post-processing (#895). snap-rules never reads income.freq —
// every gate and the benefit calc treat `amount` as monthly — so extraction
// itself must hand over engine-shaped facts. Caught live: "$600 a week"
// recorded as-is computed as $600 a MONTH, and a working-poor household was
// told the MAXIMUM allotment instead of a near-minimum benefit. Same seam
// maps the tool's plain-terms `utilities` onto the engine's SUA tier enum.
describe("extractFacts normalizes the tool output to engine shape", () => {
  beforeEach(() => sdk.create.mockReset());

  function toolResponse(input: object) {
    sdk.create.mockResolvedValue({
      content: [{ type: "tool_use", name: "record_household_facts", input }],
      usage: { input_tokens: 10, output_tokens: 5 },
    });
  }
  const MSG = [{ role: "user" as const, content: "irrelevant — the SDK is mocked" }];

  it("converts weekly income to monthly by 4.3 (7 CFR 273.10(c)(2))", async () => {
    toolResponse({ income: [{ member: "a", type: "wages", amount: 600, freq: "weekly" }] });
    const { patch } = await extractFacts(MSG, "k");
    expect(patch.income).toEqual([{ member: "a", type: "wages", amount: 2580, freq: "monthly" }]);
  });

  it("converts biweekly by 2.15 and annual by 1/12", async () => {
    toolResponse({
      income: [
        { member: "a", type: "wages", amount: 1000, freq: "biweekly" },
        { member: "a", type: "unearned_other", amount: 1200, freq: "annual" },
      ],
    });
    const { patch } = await extractFacts(MSG, "k");
    expect(patch.income![0]).toEqual({ member: "a", type: "wages", amount: 2150, freq: "monthly" });
    expect(patch.income![1]).toEqual({ member: "a", type: "unearned_other", amount: 100, freq: "monthly" });
  });

  it("leaves monthly amounts untouched", async () => {
    toolResponse({ income: [{ member: "a", type: "ssa", amount: 1180, freq: "monthly" }] });
    const { patch } = await extractFacts(MSG, "k");
    expect(patch.income).toEqual([{ member: "a", type: "ssa", amount: 1180, freq: "monthly" }]);
  });

  it("maps the tool's plain-terms utilities onto the engine's SUA tier", async () => {
    toolResponse({ shelter: { rent: 1000, utilities: "heating_cooling" } });
    const { patch } = await extractFacts(MSG, "k");
    expect(patch.shelter).toEqual({ rent: 1000, sua_tier: "HCSUA" });
  });

  it("drops an unstated utilities field without inventing a tier", async () => {
    toolResponse({ shelter: { rent: 1000 } });
    const { patch } = await extractFacts(MSG, "k");
    expect(patch.shelter).toEqual({ rent: 1000 });
    expect((patch as PartialFacts).shelter?.sua_tier).toBeUndefined();
  });
});

// Second-pass class audit (#898): `student` was the ONE remaining
// unconstrained free-text field the tool could emit — the model wrote
// "college" / "high school", and the engine's student gate matches only its
// exact fixture tokens, so a real transcript's full-time college student
// silently counted as a fully-eligible member. The tool now offers a small
// stated-facts enum, mapped here to the tokens the engine actually reads.
describe("extractFacts maps student enrollment to engine tokens", () => {
  beforeEach(() => sdk.create.mockReset());

  function toolResponse(input: object) {
    sdk.create.mockResolvedValue({
      content: [{ type: "tool_use", name: "record_household_facts", input }],
      usage: { input_tokens: 10, output_tokens: 5 },
    });
  }
  const MSG = [{ role: "user" as const, content: "irrelevant — the SDK is mocked" }];

  it("half-time+ higher ed → he_halftime_subject; high school → not", async () => {
    toolResponse({
      household: [
        { member_id: "a", age: 20, student: "higher_ed_half_time_plus" },
        { member_id: "b", age: 15, student: "high_school" },
      ],
    });
    const { patch } = await extractFacts(MSG, "k");
    expect(patch.household![0]!.student).toBe("he_halftime_subject");
    expect(patch.household![1]!.student).toBe("not");
  });

  it("less-than-half-time and none → not; an engine token passes through unchanged", async () => {
    toolResponse({
      household: [
        { member_id: "a", age: 20, student: "higher_ed_less_than_half" },
        { member_id: "b", age: 30, student: "none" },
        { member_id: "c", age: 22, student: "he_exempt:work20" },
      ],
    });
    const { patch } = await extractFacts(MSG, "k");
    expect(patch.household![0]!.student).toBe("not");
    expect(patch.household![1]!.student).toBe("not");
    expect(patch.household![2]!.student).toBe("he_exempt:work20");
  });
});
