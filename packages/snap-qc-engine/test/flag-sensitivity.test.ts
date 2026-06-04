import { describe, it, expect } from "vitest";
import {
  flagSeverity,
  resolveFlagInterrupts,
  countInterrupts,
  DEFAULT_SENSITIVITY,
  scoreErrorRisk,
  type FlagSensitivityConfig,
  type FlowKind,
  type Defensibility,
} from "../src/index";

const sig = (flow: FlowKind, d: Defensibility) => ({ flow, defensibility_score: d });

// A mixed packet: one weak (high), one moderate (medium), one strong (low).
const SIGNALS = [
  sig("utility-sua", "weak"),
  sig("gig-income", "moderate"),
  sig("shared-lease", "strong"),
] as const;

describe("flagSeverity", () => {
  it("maps defensibility to severity", () => {
    expect(flagSeverity("weak")).toBe("high");
    expect(flagSeverity("moderate")).toBe("medium");
    expect(flagSeverity("strong")).toBe("low");
  });
});

describe("resolveFlagInterrupts — level gating", () => {
  it("conservative interrupts only high-severity flags", () => {
    const d = resolveFlagInterrupts(SIGNALS, { level: "conservative" });
    expect(d.find((x) => x.flow === "utility-sua")!.interrupts).toBe(true); // high
    expect(d.find((x) => x.flow === "gig-income")!.interrupts).toBe(false); // medium
    expect(d.find((x) => x.flow === "shared-lease")!.interrupts).toBe(false); // low
  });

  it("balanced interrupts high + medium", () => {
    const d = resolveFlagInterrupts(SIGNALS, { level: "balanced" });
    expect(d.find((x) => x.flow === "utility-sua")!.interrupts).toBe(true);
    expect(d.find((x) => x.flow === "gig-income")!.interrupts).toBe(true);
    expect(d.find((x) => x.flow === "shared-lease")!.interrupts).toBe(false);
  });

  it("thorough interrupts everything", () => {
    const d = resolveFlagInterrupts(SIGNALS, { level: "thorough" });
    expect(d.every((x) => x.interrupts)).toBe(true);
  });

  it("levels are strictly nested supersets", () => {
    const c = countInterrupts(SIGNALS, { level: "conservative" });
    const b = countInterrupts(SIGNALS, { level: "balanced" });
    const t = countInterrupts(SIGNALS, { level: "thorough" });
    expect(c).toBeLessThanOrEqual(b);
    expect(b).toBeLessThanOrEqual(t);
    expect(c).toBe(1);
    expect(b).toBe(2);
    expect(t).toBe(3);
  });
});

describe("resolveFlagInterrupts — focus areas", () => {
  it("focus bumps a flow up one level (medium surfaces under conservative+focus)", () => {
    const d = resolveFlagInterrupts(SIGNALS, {
      level: "conservative",
      focusFlows: ["gig-income"],
    });
    const gig = d.find((x) => x.flow === "gig-income")!;
    expect(gig.interrupts).toBe(true); // conservative→balanced for this flow
    expect(gig.focusApplied).toBe(true);
    expect(d.find((x) => x.flow === "shared-lease")!.interrupts).toBe(false);
  });

  it("focus on a low-severity flow surfaces it under balanced+focus", () => {
    const d = resolveFlagInterrupts(SIGNALS, {
      level: "balanced",
      focusFlows: ["shared-lease"],
    });
    expect(d.find((x) => x.flow === "shared-lease")!.interrupts).toBe(true); // balanced→thorough
  });

  it("focus never escalates past thorough", () => {
    const d = resolveFlagInterrupts(SIGNALS, {
      level: "thorough",
      focusFlows: ["utility-sua", "gig-income", "shared-lease"],
    });
    expect(d.every((x) => x.interrupts)).toBe(true);
  });

  it("focus only affects the named flow", () => {
    const d = resolveFlagInterrupts(SIGNALS, {
      level: "conservative",
      focusFlows: ["gig-income"],
    });
    expect(d.find((x) => x.flow === "gig-income")!.focusApplied).toBe(true);
    expect(d.find((x) => x.flow === "utility-sua")!.focusApplied).toBe(false);
    expect(d.find((x) => x.flow === "shared-lease")!.focusApplied).toBe(false);
  });
});

describe("#496 INVARIANT — sensitivity never changes scoring", () => {
  // The load-bearing guarantee: a CBO's sensitivity choice must NOT move the
  // score, tier, or (downstream) measured PER. Two configs over identical
  // signals → identical scoreErrorRisk output. Only interrupt surfacing differs.
  it("scoreErrorRisk is identical regardless of sensitivity config", () => {
    const scored = scoreErrorRisk([...SIGNALS]);

    const configs: FlagSensitivityConfig[] = [
      { level: "conservative" },
      { level: "balanced" },
      { level: "thorough", focusFlows: ["utility-sua", "gig-income", "shared-lease"] },
    ];

    for (const cfg of configs) {
      resolveFlagInterrupts(SIGNALS, cfg);
      const rescored = scoreErrorRisk([...SIGNALS]);
      expect(rescored.score).toBe(scored.score);
      expect(rescored.tier).toBe(scored.tier);
      expect(rescored.factors).toEqual(scored.factors);
    }
  });

  it("interrupt counts DO differ across configs (proves the filter is live)", () => {
    const cons = countInterrupts(SIGNALS, { level: "conservative" });
    const thor = countInterrupts(SIGNALS, { level: "thorough" });
    expect(cons).not.toBe(thor);
  });

  it("resolveFlagInterrupts does not mutate the input signals", () => {
    const snapshot = JSON.stringify(SIGNALS);
    resolveFlagInterrupts(SIGNALS, { level: "thorough", focusFlows: ["utility-sua"] });
    expect(JSON.stringify(SIGNALS)).toBe(snapshot);
  });
});

describe("defaults", () => {
  it("default sensitivity is balanced", () => {
    expect(DEFAULT_SENSITIVITY).toBe("balanced");
  });
});
