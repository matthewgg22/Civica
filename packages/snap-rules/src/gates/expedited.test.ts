import { describe, it, expect } from "vitest";
import { screenExpedited, effectiveGrossMonthly, expeditedShelterCost } from "./expedited";
import type { Facts } from "../facts";

// Fixtures are minimal but shaped like the v0.6 profile schema, so the parity
// assertions below mean something against the Python engine.

const member = (over: Partial<Facts["household"][number]> = {}) => ({
  member_id: "m1",
  age: 35,
  role: "head",
  living: "housed",
  ...over,
});

const facts = (over: Partial<Facts> = {}): Facts =>
  ({
    household: [member()],
    income: [],
    shelter: { rent: 0, sua_tier: "none", sua_amount: 0 },
    deductions: {},
    assets: 0,
    cat_elig: "NPA",
    ...over,
  }) as Facts;

describe("Path 1 — 7 CFR 273.2(i)(1)(i)", () => {
  it("qualifies at gross < $150 and liquid <= $100", () => {
    const r = screenExpedited(
      facts({ income: [{ member: "m1", type: "wages", amount: 100 }], assets: 50 }),
    );
    expect(r.status).toBe("eligible");
    expect(r.paths).toContain("low_income_low_resources");
    expect(r.explanation).toMatch(/within 3 calendar days/);
  });

  it("THE #557 OVER-TRIGGER BUG: an unemployed household with $500 savings must NOT qualify on Path 1", () => {
    // The old dashboard heuristic fired on employment_status === "unemployed"
    // with no liquid check at all, so this household saw the expedited gate.
    const r = screenExpedited(facts({ income: [], assets: 500, shelter: { rent: 0, sua_tier: "none", sua_amount: 0 } }));
    expect(r.paths).not.toContain("low_income_low_resources");
    expect(r.status).toBe("not_eligible");
  });

  it("does not qualify at exactly $150 gross (strict less-than)", () => {
    const r = screenExpedited(
      facts({ income: [{ member: "m1", type: "wages", amount: 150 }], assets: 0 }),
    );
    expect(r.paths).not.toContain("low_income_low_resources");
  });

  it("qualifies at exactly $100 liquid (inclusive)", () => {
    const r = screenExpedited(
      facts({ income: [{ member: "m1", type: "wages", amount: 100 }], assets: 100 }),
    );
    expect(r.paths).toContain("low_income_low_resources");
  });
});

describe("Path 2 — 7 CFR 273.2(i)(1)(iii)", () => {
  it("THE #557 MISSED HOUSEHOLD: $400/mo income, $700 rent, $100 liquid qualifies", () => {
    // Straight from the issue. This household would never have seen the gate.
    const r = screenExpedited(
      facts({
        income: [{ member: "m1", type: "wages", amount: 400 }],
        assets: 100,
        shelter: { rent: 700, sua_tier: "none", sua_amount: 0 },
      }),
    );
    expect(r.status).toBe("eligible");
    expect(r.paths).toContain("shelter_exceeds_resources");
    // NOT path 1 — gross is well over $150. Only Path 2 catches this.
    expect(r.paths).not.toContain("low_income_low_resources");
  });

  it("counts the entitled SUA, not actual utility bills", () => {
    // Rent alone ($400) does not exceed income+liquid ($450), but rent + SUA does.
    const r = screenExpedited(
      facts({
        income: [{ member: "m1", type: "wages", amount: 400 }],
        assets: 50,
        shelter: { rent: 400, sua_tier: "HCSUA", sua_amount: 663 },
      }),
    );
    expect(r.shelterCost).toBe(1063); // 400 rent + 663 SUA, not actual utility bills
    expect(r.paths).toContain("shelter_exceeds_resources");
  });

  it("does not qualify when income plus resources equals shelter (strict less-than)", () => {
    const r = screenExpedited(
      facts({
        income: [{ member: "m1", type: "wages", amount: 600 }],
        assets: 100,
        shelter: { rent: 700, sua_tier: "none", sua_amount: 0 },
      }),
    );
    expect(r.paths).not.toContain("shelter_exceeds_resources");
    expect(r.status).toBe("not_eligible");
  });
});

describe("Path 3 — 7 CFR 273.2(i)(1)(ii) destitute migrant/seasonal farmworker", () => {
  const destitute = () =>
    facts({
      household: [member({ living: "migrant" })],
      income: [{ member: "m1", type: "wages", amount: 400, source_status: "terminated" }],
      assets: 50,
      shelter: { rent: 0, sua_tier: "none", sua_amount: 0 },
    });

  it("qualifies with terminated income and <= $100 liquid", () => {
    const r = screenExpedited(destitute());
    expect(r.paths).toContain("destitute_farmworker");
    expect(r.status).toBe("eligible");
  });

  it("also recognises a seasonal farmworker", () => {
    const f = destitute();
    f.household = [member({ living: "seasonal" })];
    expect(screenExpedited(f).paths).toContain("destitute_farmworker");
  });

  it("is defeated by a new source paying more than $25 within 10 days", () => {
    const r = screenExpedited(destitute(), { newSourceIncomeWithin10Days: 30 });
    expect(r.paths).not.toContain("destitute_farmworker");
  });

  it("survives a new source paying exactly $25", () => {
    const r = screenExpedited(destitute(), { newSourceIncomeWithin10Days: 25 });
    expect(r.paths).toContain("destitute_farmworker");
  });

  it("is defeated when any income source is still ongoing", () => {
    const f = destitute();
    f.income = [
      { member: "m1", type: "wages", amount: 400, source_status: "terminated" },
      { member: "m1", type: "wages", amount: 50, source_status: "ongoing" },
    ];
    expect(screenExpedited(f).paths).not.toContain("destitute_farmworker");
  });

  it("does not apply to a non-farmworker household with the same facts", () => {
    const f = destitute();
    f.household = [member({ living: "housed" })];
    expect(screenExpedited(f).paths).not.toContain("destitute_farmworker");
  });
});

describe("forward-looking income (terminated sources excluded)", () => {
  it("excludes terminated income from effective gross", () => {
    const f = facts({
      income: [
        { member: "m1", type: "wages", amount: 2000, source_status: "terminated" },
        { member: "m1", type: "wages", amount: 100, source_status: "ongoing" },
      ],
    });
    expect(effectiveGrossMonthly(f)).toBe(100);
  });

  it("treats a missing source_status as ongoing (Python is_ongoing defaults true)", () => {
    expect(effectiveGrossMonthly(facts({ income: [{ member: "m1", type: "wages", amount: 300 }] }))).toBe(300);
  });

  it("a household whose only job just ended screens as expedited", () => {
    // Their forward-looking income is $0 even though they earned $2,000 last month.
    const r = screenExpedited(
      facts({
        income: [{ member: "m1", type: "wages", amount: 2000, source_status: "terminated" }],
        assets: 0,
      }),
    );
    expect(r.effectiveGrossMonthly).toBe(0);
    expect(r.status).toBe("eligible");
  });
});

describe("unknown liquid resources are not guessed", () => {
  it("returns needs_liquid_resources with the deciding ceiling", () => {
    // The v0.6 fixtures allow an unauthored assets sentinel.
    const r = screenExpedited(
      facts({
        income: [{ member: "m1", type: "wages", amount: 400 }],
        assets: "n/a:not_authored",
        shelter: { rent: 600, sua_tier: "HCSUA", sua_amount: 663 },
      }),
    );
    expect(r.status).toBe("needs_liquid_resources");
    expect(r.liquidResources).toBeNull();
    // Path 2 decides it: qualifies while liquid < 1263 - 400, i.e. <= 862.
    expect(r.qualifyingLiquidCeiling).toBe(862);
    expect(r.explanation).toMatch(/Ask the household for their liquid resources/);
  });

  it("does NOT default unknown liquid to zero (that is the over-trigger direction)", () => {
    const r = screenExpedited(facts({ income: [{ member: "m1", type: "wages", amount: 100 }], assets: "n/a:not_authored" }));
    expect(r.status).not.toBe("eligible");
  });

  it("resolves to not_eligible when no ceiling could ever qualify", () => {
    // High ongoing income, no shelter cost: no value of liquid resources helps.
    const r = screenExpedited(
      facts({ income: [{ member: "m1", type: "wages", amount: 5000 }], assets: "n/a:not_authored" }),
    );
    expect(r.status).toBe("not_eligible");
    expect(r.qualifyingLiquidCeiling).toBeNull();
  });
});

describe("parity with the Python engine (_is_expedited_eligible)", () => {
  // Same thresholds, same strictness, same forward-looking gross. Any drift here
  // means the TS and Python encodings disagree on who is owed food in 3 days.
  const cases: Array<{ name: string; f: Facts; expected: boolean }> = [
    { name: "gross 149 / liquid 100", f: facts({ income: [{ member: "m1", type: "wages", amount: 149 }], assets: 100 }), expected: true },
    { name: "gross 150 / liquid 100 / no shelter", f: facts({ income: [{ member: "m1", type: "wages", amount: 150 }], assets: 100 }), expected: false },
    { name: "gross 149 / liquid 101 / no shelter", f: facts({ income: [{ member: "m1", type: "wages", amount: 149 }], assets: 101 }), expected: false },
    {
      name: "path2 boundary: gross+liquid one dollar under shelter",
      f: facts({ income: [{ member: "m1", type: "wages", amount: 500 }], assets: 199, shelter: { rent: 700, sua_tier: "none", sua_amount: 0 } }),
      expected: true,
    },
    {
      name: "path2 boundary: gross+liquid exactly shelter",
      f: facts({ income: [{ member: "m1", type: "wages", amount: 500 }], assets: 200, shelter: { rent: 700, sua_tier: "none", sua_amount: 0 } }),
      expected: false,
    },
  ];

  for (const c of cases) {
    it(c.name, () => {
      expect(screenExpedited(c.f).status === "eligible").toBe(c.expected);
    });
  }
});
