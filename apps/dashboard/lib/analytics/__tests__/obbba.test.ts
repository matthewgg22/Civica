import { describe, it, expect } from "vitest";
import {
  obbbaProvisions,
  publicDataSources,
  deriveObbbaImpact,
  isObbbaChainEngaged,
  type ObbbaImpactState,
} from "../obbba";

function dobForAge(age: number): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - age);
  // Subtract a day to ensure age has fully accrued.
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

describe("obbbaProvisions", () => {
  const provisions = obbbaProvisions();

  it("returns at least one hero-tier provision (the load-bearing rows of the panel)", () => {
    const heros = provisions.filter((p) => p.tier === "hero");
    expect(heros.length).toBeGreaterThanOrEqual(1);
  });

  it("every provision has a non-empty title, section, and source path", () => {
    for (const p of provisions) {
      expect(p.title).toBeTruthy();
      expect(p.section).toBeTruthy();
      expect(p.source).toBeTruthy();
    }
  });

  it("every provision has a parseable ISO deadline date", () => {
    for (const p of provisions) {
      const d = new Date(p.deadlineIso);
      expect(Number.isFinite(d.getTime())).toBe(true);
    }
  });

  it("status values are constrained to the documented enum", () => {
    const allowed = new Set(["Ready", "Partial"]);
    for (const p of provisions) {
      expect(allowed.has(p.status)).toBe(true);
    }
  });

  it("impactKind values are constrained to the documented enum", () => {
    const allowed = new Set(["dollar", "count", "risk", "ready"]);
    for (const p of provisions) {
      expect(allowed.has(p.impactKind)).toBe(true);
    }
  });

  // T5 credibility check: any dollar-tagged impactLabel must NOT contain the
  // strings "$NaN" or "$undefined" — the kind of bug that ships when a
  // formula upstream returns undefined and template-literal interpolation
  // silently leaks it.
  it("no impactLabel contains NaN or undefined (formula leak guard)", () => {
    for (const p of provisions) {
      expect(p.impactLabel).not.toContain("NaN");
      expect(p.impactLabel).not.toContain("undefined");
    }
  });

  it("hero provisions all have a heroNumber field set", () => {
    const heros = provisions.filter((p) => p.tier === "hero");
    for (const p of heros) {
      expect(p.heroNumber).toBeTruthy();
      expect(p.heroNumber).not.toContain("NaN");
    }
  });
});

// ---------------------------------------------------------------------------
// deriveObbbaImpact — contract closure (TODO-OBBBA-CONTRACT, 2026-05-25)
// ---------------------------------------------------------------------------

describe("deriveObbbaImpact — age-band classification", () => {
  it("returns not_impacted when DOB is missing", () => {
    const state = deriveObbbaImpact({ packetAnswers: {} });
    expect(state.kind).toBe("not_impacted");
    if (state.kind === "not_impacted") {
      expect(state.reason).toMatch(/Date of birth not provided/i);
    }
  });

  it("returns not_impacted for under 18", () => {
    const state = deriveObbbaImpact({
      packetAnswers: { date_of_birth: dobForAge(15) },
    });
    expect(state.kind).toBe("not_impacted");
    if (state.kind === "not_impacted") {
      expect(state.reason).toMatch(/Under 18/);
    }
  });

  it("returns not_impacted for age 60+", () => {
    const state = deriveObbbaImpact({
      packetAnswers: { date_of_birth: dobForAge(65) },
    });
    expect(state.kind).toBe("not_impacted");
    if (state.kind === "not_impacted") {
      expect(state.reason).toMatch(/Age 60 or older/);
    }
  });

  it("classifies 18-49 as work_required (base ABAWD band)", () => {
    const state = deriveObbbaImpact({
      packetAnswers: { date_of_birth: dobForAge(30) },
    });
    expect(state.kind).toBe("work_required");
    if (state.kind === "work_required") {
      expect(state.ageBand).toBe("18-49");
      expect(state.authority).toBe("OBBBA §10102(a)");
    }
  });

  it("classifies 50-54 as work_required (1.1 expansion)", () => {
    const state = deriveObbbaImpact({
      packetAnswers: { date_of_birth: dobForAge(52) },
    });
    expect(state.kind).toBe("work_required");
    if (state.kind === "work_required") {
      expect(state.ageBand).toBe("50-54");
    }
  });

  it("classifies 55-59 as work_required (1.2 expansion)", () => {
    const state = deriveObbbaImpact({
      packetAnswers: { date_of_birth: dobForAge(57) },
    });
    expect(state.kind).toBe("work_required");
    if (state.kind === "work_required") {
      expect(state.ageBand).toBe("55-59");
    }
  });
});

describe("deriveObbbaImpact — shipped-track exemptions", () => {
  it("caregiver of child under 14 → exempt", () => {
    const state = deriveObbbaImpact({
      packetAnswers: {
        date_of_birth: dobForAge(40),
        caregiver_status: "child_under_14",
      },
    });
    expect(state.kind).toBe("exempt");
    if (state.kind === "exempt") {
      expect(state.exemptionType).toBe("caregiver_child_under_14");
      expect(state.authority).toBe("OBBBA §10102(a)(2)(B)");
    }
  });

  it("disability exemption → exempt", () => {
    const state = deriveObbbaImpact({
      packetAnswers: {
        date_of_birth: dobForAge(35),
        claims_disability_exemption: "true",
      },
    });
    expect(state.kind).toBe("exempt");
    if (state.kind === "exempt") {
      expect(state.exemptionType).toBe("disability");
    }
  });

  it("pregnant → exempt", () => {
    const state = deriveObbbaImpact({
      packetAnswers: { date_of_birth: dobForAge(28), claims_pregnant: "true" },
    });
    expect(state.kind).toBe("exempt");
    if (state.kind === "exempt") {
      expect(state.exemptionType).toBe("pregnant");
    }
  });

  it("homeless → exempt", () => {
    const state = deriveObbbaImpact({
      packetAnswers: { date_of_birth: dobForAge(32), housing_situation: "homeless" },
    });
    expect(state.kind).toBe("exempt");
    if (state.kind === "exempt") {
      expect(state.exemptionType).toBe("homeless");
    }
  });

  it("veteran → exempt", () => {
    const state = deriveObbbaImpact({
      packetAnswers: { date_of_birth: dobForAge(45), veteran_status: "veteran" },
    });
    expect(state.kind).toBe("exempt");
    if (state.kind === "exempt") {
      expect(state.exemptionType).toBe("veteran");
    }
  });
});

describe("deriveObbbaImpact — pending counsel tracks", () => {
  it("tribal_member=yes → pending_counsel on Track 1.3", () => {
    const state = deriveObbbaImpact({
      packetAnswers: { date_of_birth: dobForAge(40), tribal_member: "yes" },
    });
    expect(state.kind).toBe("pending_counsel");
    if (state.kind === "pending_counsel") {
      expect(state.track).toBe("1.3_native_american");
      expect(state.reason).toMatch(/Tribal member/i);
    }
  });

  it("distress_self_attestation=true → pending_counsel on Q5", () => {
    const state = deriveObbbaImpact({
      packetAnswers: {
        date_of_birth: dobForAge(35),
        distress_self_attestation: "true",
      },
    });
    expect(state.kind).toBe("pending_counsel");
    if (state.kind === "pending_counsel") {
      expect(state.track).toBe("Q5_distress_gate");
    }
  });

  it("tribal flag takes precedence over age (always pending until 1.3 ships)", () => {
    const state = deriveObbbaImpact({
      packetAnswers: { date_of_birth: dobForAge(70), tribal_member: "yes" },
    });
    expect(state.kind).toBe("pending_counsel");
  });
});

describe("isObbbaChainEngaged", () => {
  it("returns true for work_required state", () => {
    const s: ObbbaImpactState = {
      kind: "work_required",
      ageBand: "18-49",
      authority: "OBBBA §10102(a)",
    };
    expect(isObbbaChainEngaged(s)).toBe(true);
  });

  it("returns true for exempt state", () => {
    const s: ObbbaImpactState = {
      kind: "exempt",
      exemptionType: "disability",
      reason: "test",
      authority: "test",
    };
    expect(isObbbaChainEngaged(s)).toBe(true);
  });

  it("returns true for not_impacted state", () => {
    const s: ObbbaImpactState = {
      kind: "not_impacted",
      reason: "test",
    };
    expect(isObbbaChainEngaged(s)).toBe(true);
  });

  it("returns false for pending_counsel state", () => {
    const s: ObbbaImpactState = {
      kind: "pending_counsel",
      track: "1.3_native_american",
      reason: "test",
    };
    expect(isObbbaChainEngaged(s)).toBe(false);
  });
});

describe("publicDataSources", () => {
  it("returns at least one source", () => {
    expect(publicDataSources().length).toBeGreaterThan(0);
  });

  it("every source has a non-empty name, url, and status", () => {
    for (const s of publicDataSources()) {
      expect(s.name).toBeTruthy();
      expect(s.url).toBeTruthy();
      expect(s.status).toBeTruthy();
    }
  });
});
