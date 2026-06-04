// @vitest-environment jsdom
/**
 * Step-2 People section tests (V1-5 PR4, #314).
 *
 * Covers the household-member sub-flow and its repeating-page semantics:
 *   ABHSD        — gate: present→Yes / empty→No (presenceOf household_members[0])
 *   ABNMI_MEMBER — per-member name; member[0]→Alice, member[1]→Bob (the core
 *                  member-index correctness property the full fix delivers)
 *   ABHHR        — relationship <select> (explicit DOM — walk didn't capture options)
 *   ABPSM        — CalFresh checkbox (constant "true", every member)
 *   ABBPF/ABLNA/ABHAD — no-source pages: needs-review, no throw
 *
 * scopePayloadForMember (the index-0 proxy) is unit-tested separately in
 * member-scope.test.ts; here we exercise it end-to-end through runSectionFillTest.
 */

import { describe, it, expect } from "vitest";
import {
  runSectionFillTest,
  makePacket,
  type FieldOutcome,
} from "../__fixtures__/makePacket";
import { scopePayloadForMember } from "../../src/core/member-scope";

const TWO_MEMBERS = {
  household_members: [
    { first_name: "Alice", last_name: "Jones", date_of_birth: "1985-05-15", relationship: "spouse" },
    { first_name: "Bob", last_name: "Jones", date_of_birth: "2010-03-20", relationship: "child" },
  ],
};

// ---------------------------------------------------------------------------
// ABHSD — household members gate
// ---------------------------------------------------------------------------

describe("step-2: ABHSD — household members gate", () => {
  it("selects Yes when the household has members", () =>
    runSectionFillTest("ABHSD", {
      payloadOverrides: TWO_MEMBERS,
      expectedFilled: { otherHouseholdMembers: "filled" },
      expectedValues: { otherHouseholdMembers: "present" }, // option key → "Yes"
      minFilled: 1,
    }));

  it("selects No when the household is empty", () =>
    runSectionFillTest("ABHSD", {
      payloadOverrides: { household_members: [] },
      expectedFilled: { otherHouseholdMembers: "filled" },
      expectedValues: { otherHouseholdMembers: "absent" }, // option key → "No"
      minFilled: 1,
    }));
});

// ---------------------------------------------------------------------------
// ABNMI_MEMBER — per-member name (THE member-index correctness test)
// ---------------------------------------------------------------------------

describe("step-2: ABNMI_MEMBER — member name (repeating)", () => {
  it("fills member[0] → Alice Jones", () =>
    runSectionFillTest("ABNMI_MEMBER", {
      payloadOverrides: TWO_MEMBERS,
      scopeMemberIndex: 0,
      expectedFilled: { firstName: "filled", lastName: "filled" },
      expectedValues: { firstName: "Alice", lastName: "Jones" },
      minFilled: 2,
    }));

  it("fills member[1] → Bob Jones (proves the index advances correctly)", () =>
    runSectionFillTest("ABNMI_MEMBER", {
      payloadOverrides: TWO_MEMBERS,
      scopeMemberIndex: 1,
      expectedFilled: { firstName: "filled", lastName: "filled" },
      expectedValues: { firstName: "Bob", lastName: "Jones" },
      minFilled: 2,
    }));

  it("leaves fields no-value when index is past the last member", () =>
    runSectionFillTest("ABNMI_MEMBER", {
      payloadOverrides: TWO_MEMBERS,
      scopeMemberIndex: 5, // out of bounds → empty scope, never bleeds member 0
      expectedFilled: { firstName: "no-value", lastName: "no-value" },
    }));
});

// ---------------------------------------------------------------------------
// ABHHR — relationship select (explicit DOM: walk didn't capture options)
// ---------------------------------------------------------------------------

describe("step-2: ABHHR — relationship (repeating)", () => {
  const RELATIONSHIP_DOM = `
    <label for="optiongroup">How is Alice related to you?</label>
    <select id="optiongroup">
      <option value="">Select…</option>
      <option value="spouse">Spouse</option>
      <option value="child">Child/Stepchild</option>
    </select>
  `;

  it("fills member[0] relationship = spouse", () =>
    runSectionFillTest("ABHHR", {
      payloadOverrides: TWO_MEMBERS,
      scopeMemberIndex: 0,
      domHtml: RELATIONSHIP_DOM,
      expectedFilled: { relationship: "filled" },
      expectedValues: { relationship: "spouse" },
    }));

  it("fills member[1] relationship = child", () =>
    runSectionFillTest("ABHHR", {
      payloadOverrides: TWO_MEMBERS,
      scopeMemberIndex: 1,
      domHtml: RELATIONSHIP_DOM,
      expectedFilled: { relationship: "filled" },
      expectedValues: { relationship: "child" },
    }));
});

// ---------------------------------------------------------------------------
// ABPSM — CalFresh checkbox (constant, every member)
// ---------------------------------------------------------------------------

describe("step-2: ABPSM — member CalFresh inclusion (constant)", () => {
  it("checks CalFresh regardless of member index", () =>
    runSectionFillTest("ABPSM", {
      payloadOverrides: TWO_MEMBERS,
      scopeMemberIndex: 1,
      expectedFilled: { includedInSnap: "filled" },
      expectedValues: { includedInSnap: "checked" },
      minFilled: 1,
    }));
});

// ---------------------------------------------------------------------------
// ABBPF / ABLNA / ABHAD — no-source repeating pages (needs-review, no throw)
// ---------------------------------------------------------------------------

describe("step-2: no-source repeating pages", () => {
  for (const code of ["ABBPF", "ABLNA", "ABHAD"]) {
    it(`${code}: fills nothing, never throws`, () =>
      runSectionFillTest(code, {
        payloadOverrides: TWO_MEMBERS,
        scopeMemberIndex: 0,
        minFilled: 0,
      }));
  }
});

// ---------------------------------------------------------------------------
// scopePayloadForMember — direct unit tests
// ---------------------------------------------------------------------------

describe("scopePayloadForMember", () => {
  it("places the target member at household_members[0]", () => {
    const payload = makePacket(TWO_MEMBERS);
    const m0 = (scopePayloadForMember(payload, 0) as { household_members: { first_name: string }[] }).household_members[0];
    const m1 = (scopePayloadForMember(payload, 1) as { household_members: { first_name: string }[] }).household_members[0];
    expect(m0?.first_name).toBe("Alice");
    expect(m1?.first_name).toBe("Bob");
  });

  it("scopes to an empty array when household is empty", () => {
    const payload = makePacket({ household_members: [] });
    const scoped = scopePayloadForMember(payload, 0) as { household_members: unknown[] };
    expect(scoped.household_members).toEqual([]);
  });

  it("scopes to an empty array when index is out of bounds (no member-0 bleed)", () => {
    const payload = makePacket(TWO_MEMBERS);
    const scoped = scopePayloadForMember(payload, 5) as { household_members: unknown[] };
    expect(scoped.household_members).toEqual([]);
  });

  it("passes through a payload with no household_members array", () => {
    const weird = { foo: "bar" };
    expect(scopePayloadForMember(weird, 0)).toBe(weird);
  });

  // Suppress unused-import warning for FieldOutcome (kept for symmetry with
  // step-1 tests that re-export the type).
  it("type export is available", () => {
    const o: FieldOutcome = "filled";
    expect(o).toBe("filled");
  });
});
