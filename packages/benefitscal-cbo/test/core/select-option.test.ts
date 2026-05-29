/**
 * Unit tests for the radio/checkbox option-selection resolver (V1-6, #314).
 *
 * `resolveOption` turns a schema value (or a constant, or a presence test) into
 * the specific option of a radio/checkbox group to click — or a typed reason it
 * couldn't. The load-bearing eligibility-correctness property: it NEVER falls
 * through to a default. An unmapped/absent value yields "needs-review", not a
 * guess. These tests pin that down for booleans, enums, constants, and presence.
 */

import { describe, it, expect } from "vitest";
import {
  resolveOption,
  isOptionGroupField,
  constantValue,
  normalizeOptionValue,
} from "../../src/core/select-option";
import type { FieldSelector } from "../../src/core/selector-map";

const yesNo: Record<string, FieldSelector> = {
  Yes: { label: "Yes", type: "radio" },
  No: { label: "No", type: "radio" },
};

describe("normalizeOptionValue", () => {
  it("maps booleans to 'true'/'false'", () => {
    expect(normalizeOptionValue(true)).toBe("true");
    expect(normalizeOptionValue(false)).toBe("false");
  });

  it("maps boolean-ish strings to 'true'/'false'", () => {
    for (const v of ["true", "Yes", "YES", "1"]) expect(normalizeOptionValue(v)).toBe("true");
    for (const v of ["false", "No", "NO", "0"]) expect(normalizeOptionValue(v)).toBe("false");
  });

  it("maps 1/0 numbers to 'true'/'false'", () => {
    expect(normalizeOptionValue(1)).toBe("true");
    expect(normalizeOptionValue(0)).toBe("false");
  });

  it("collapses spaces/hyphens to underscores and lowercases enum-ish strings", () => {
    expect(normalizeOptionValue("Domestic Partner")).toBe("domestic_partner");
    expect(normalizeOptionValue("domestic-partner")).toBe("domestic_partner");
    expect(normalizeOptionValue("US_CITIZEN")).toBe("us_citizen");
  });

  it("returns null for null / undefined / empty", () => {
    expect(normalizeOptionValue(null)).toBeNull();
    expect(normalizeOptionValue(undefined)).toBeNull();
    expect(normalizeOptionValue("   ")).toBeNull();
  });
});

describe("resolveOption — optionMap (booleans)", () => {
  const field: FieldSelector = {
    label: "Are you a college student?",
    type: "radio",
    source: "is_college_student",
    optionMap: { true: "Yes", false: "No" },
    options: yesNo,
  };

  it("true → Yes", () => {
    const r = resolveOption(field, true);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.key).toBe("Yes");
      expect(r.option.label).toBe("Yes");
    }
  });

  it("false → No", () => {
    const r = resolveOption(field, false);
    expect(r.ok && r.key).toBe("No");
  });

  it("absent value → no-value (never a default option)", () => {
    const r = resolveOption(field, undefined);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("no-value");
  });
});

describe("resolveOption — optionMap (citizenship, all 3 enum values)", () => {
  const field: FieldSelector = {
    label: "Are you a U.S. citizen?",
    type: "radio",
    source: "citizenship_status",
    optionMap: { us_citizen: "Yes", us_national: "Yes", non_citizen: "No" },
    options: yesNo,
  };

  it("us_citizen → Yes", () => {
    expect(resolveOption(field, "us_citizen").ok && resolveOption(field, "us_citizen")).toMatchObject({ key: "Yes" });
  });
  it("us_national → Yes (a U.S. national answers the citizenship gate Yes)", () => {
    const r = resolveOption(field, "us_national");
    expect(r.ok && r.key).toBe("Yes");
  });
  it("non_citizen → No", () => {
    const r = resolveOption(field, "non_citizen");
    expect(r.ok && r.key).toBe("No");
  });

  it("an UNMAPPED enum-ish value → needs-review, never a guess", () => {
    const r = resolveOption(field, "refugee");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("needs-review");
  });
});

describe("resolveOption — constant", () => {
  const field: FieldSelector = {
    label: "Are you applying for benefits for yourself?",
    type: "radio",
    constant: "Yes",
    options: yesNo,
  };

  it("ignores the payload and always selects the constant option", () => {
    // Even a value that would map elsewhere is ignored.
    const r = resolveOption(field, false);
    expect(r.ok && r.key).toBe("Yes");
  });

  it("needs-review if the constant names a missing option (selector-map bug)", () => {
    const bad: FieldSelector = { label: "x", type: "radio", constant: "Maybe", options: yesNo };
    const r = resolveOption(bad, undefined);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("needs-review");
  });
});

describe("resolveOption — presenceOf (ABSSN)", () => {
  const field: FieldSelector = {
    label: "Do you have a Social Security Number?",
    type: "radio",
    presenceOf: "ssn_last4",
    options: { present: { label: "Yes", type: "radio" } },
  };

  it("present value → the 'present' option (Yes)", () => {
    const r = resolveOption(field, "1234");
    expect(r.ok && r.key).toBe("present");
  });

  it("absent value with NO 'absent' option → needs-review (never auto-picks no-SSN)", () => {
    for (const v of [undefined, null, ""]) {
      const r = resolveOption(field, v);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.reason).toBe("needs-review");
    }
  });

  it("absent value WITH an explicit 'absent' option → that option", () => {
    const withAbsent: FieldSelector = {
      ...field,
      options: {
        present: { label: "Yes", type: "radio" },
        absent: { label: "No", type: "radio" },
      },
    };
    const r = resolveOption(withAbsent, undefined);
    expect(r.ok && r.key).toBe("absent");
  });
});

describe("resolveOption — not a group field", () => {
  it("returns needs-review when no constant/presenceOf/optionMap is set", () => {
    const r = resolveOption({ label: "x", type: "radio" }, "anything");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("needs-review");
  });
});

describe("isOptionGroupField / constantValue", () => {
  it("a field with optionMap + options is a group", () => {
    expect(
      isOptionGroupField({ label: "x", type: "radio", optionMap: { a: "b" }, options: yesNo }),
    ).toBe(true);
  });
  it("a constant WITH options is a group (not a constant-direct fill)", () => {
    const f: FieldSelector = { label: "x", type: "radio", constant: "Yes", options: yesNo };
    expect(isOptionGroupField(f)).toBe(true);
    expect(constantValue(f)).toBeNull();
  });
  it("a constant WITHOUT options is NOT a group → constant-direct fill", () => {
    const f: FieldSelector = { label: "CalFresh", type: "checkbox", constant: "true" };
    expect(isOptionGroupField(f)).toBe(false);
    expect(constantValue(f)).toBe("true");
  });
  it("an optionMap with NO options is not a group (malformed) ", () => {
    expect(isOptionGroupField({ label: "x", type: "radio", optionMap: { a: "b" } })).toBe(false);
  });
  it("a plain text field is neither", () => {
    const f: FieldSelector = { label: "First Name", type: "text", source: "first_name" };
    expect(isOptionGroupField(f)).toBe(false);
    expect(constantValue(f)).toBeNull();
  });
});
