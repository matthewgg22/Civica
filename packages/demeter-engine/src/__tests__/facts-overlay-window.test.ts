import { describe, it, expect } from "vitest";
import { overlayFactsSnapshot } from "../screening/orchestrator";

// #966. `fresh.household ?? base.household` falls through only on
// null/undefined — an empty array is neither, so a pass returning
// `household: []` OVERWROTE a known household instead of leaving it alone.
//
// Reachable because the client windows the conversation to 20 messages while
// facts accumulate across the whole case; because the extraction tool's own
// instruction sanctions returning empty arrays; and because `extraction.empty`
// does not catch it — a patch carrying any other fact is not empty.
//
// Measured before the fix: a household of two and $1,500 of income both
// became []. Household size sets every threshold, so the estimate changed
// silently.
//
// The flag exists because an empty array is genuinely AMBIGUOUS. Over a
// truncated window it means "not mentioned in what I read". Over the whole
// conversation it means "they told me they have none" — load-bearing, and the
// reason a household with no income lands at the maximum allotment.
const base = {
  household: [{ member_id: "applicant" }, { member_id: "child_1" }],
  income: [{ member: "applicant", type: "wages", amount: 1500 }],
} as never;

describe("a truncated window cannot erase what it did not read", () => {
  it("keeps a known household when the fresh pass returns an empty array", () => {
    const out = overlayFactsSnapshot(base, { household: [], income: [], shelter: { rent: 900 } } as never, false);
    expect(out.household).toHaveLength(2);
    expect(out.income).toHaveLength(1);
    // …and the fact that DID arrive still lands.
    expect(out.shelter?.rent).toBe(900);
  });

  it("defaults to the safe reading when no caller says", () => {
    const out = overlayFactsSnapshot(base, { household: [], income: [] } as never);
    expect(out.household).toHaveLength(2);
  });
});

describe("a complete window may record 'they have none'", () => {
  it("accepts an explicit empty income over the whole conversation", () => {
    // THE VERMONT CASE (#957): $0 income is why a household lands at the
    // maximum allotment. Treating [] as never-authoritative would lose it.
    const out = overlayFactsSnapshot(base, { household: [{ member_id: "applicant" }], income: [] } as never, true);
    expect(out.household).toHaveLength(1);
    expect(out.income).toEqual([]);
  });

  it("records 'none' from an empty base regardless of the flag", () => {
    const out = overlayFactsSnapshot({} as never, { income: [] } as never, false);
    expect(out.income, "nothing known before, so nothing is being erased").toEqual([]);
  });
});

describe("what the flag does not change", () => {
  it("a non-empty fresh array always wins", () => {
    for (const complete of [true, false]) {
      const out = overlayFactsSnapshot(base, { household: [{ member_id: "applicant" }] } as never, complete);
      expect(out.household, String(complete)).toHaveLength(1);
    }
  });

  it("an omitted field still falls through to the accumulated copy", () => {
    const out = overlayFactsSnapshot(base, { shelter: { rent: 700 } } as never, true);
    expect(out.household).toHaveLength(2);
    expect(out.income).toHaveLength(1);
  });
});
