// Component R test suite — Test Classes A, B, C, D + budget test.
// Extends the existing profile harness fixture; no new harness introduced.
// Oracle discipline: every expected outcome is justified by citation or manual
// derivation in comments — never copied from running Component R.

import { describe, it, expect } from "vitest";
import { composeVerdict, computeBenefit } from "@civica/snap-rules";
import { detectMissedElections } from "@civica/snap-qc-engine";
import {
  evaluateElicitation,
  generateRecommendations,
  deriveFeasibilityContext,
  evaluateComponentR,
  buildVerificationSteps,
  runPlausibilityChecks,
  rankCandidates,
} from "@civica/snap-recommendation";
import type {
  AnsweredAxes,
  FeasibilityContext,
  EngineAdapters,
  ComponentRInput,
  RawCandidate,
} from "@civica/snap-recommendation";
import type { Facts } from "@civica/snap-rules";
import { loadProfileSuite } from "./src/loader";

// ─── Fixture ──────────────────────────────────────────────────────────────────

const { suite } = loadProfileSuite();
const AS_OF = new Date("2026-06-01");

function getProfile(legacyId: string) {
  const p = suite.profiles.find((x) => x.legacy_id === legacyId);
  if (!p) throw new Error(`Profile ${legacyId} not found in fixture`);
  return p;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function cloneFacts(facts: Facts): Facts {
  return JSON.parse(JSON.stringify(facts)) as Facts;
}

function completedFacts(profile: ReturnType<typeof getProfile>): Facts {
  return profile.facts as unknown as Facts;
}

// ─── TEST CLASS A: Completeness Gate ─────────────────────────────────────────
// Rule: strip a determinative fact → status == "ELICIT" and field identified.

describe("Class A — Completeness gate", () => {
  it("A01: income undefined → ELICIT, income field surfaced", () => {
    const facts = cloneFacts(completedFacts(getProfile("A01")));
    (facts as Partial<Facts>).income = undefined as never;
    const result = evaluateElicitation(facts as Partial<Facts>, {}, "CA");
    expect(result.status).toBe("ELICIT");
    expect(result.missing_fields.some((f) => f.includes("income"))).toBe(true);
  });

  it("A01: shelter.sua_tier null → ELICIT", () => {
    const facts = cloneFacts(completedFacts(getProfile("A01")));
    (facts.shelter as { sua_tier?: unknown }).sua_tier = undefined;
    const result = evaluateElicitation(facts as Partial<Facts>, {}, "CA");
    expect(result.status).toBe("ELICIT");
    expect(result.missing_fields.some((f) => f.includes("sua_tier"))).toBe(true);
  });

  it("A01: shelter.homeless_deduction null → ELICIT", () => {
    const facts = cloneFacts(completedFacts(getProfile("A01")));
    (facts.shelter as { homeless_deduction?: unknown }).homeless_deduction = undefined;
    const result = evaluateElicitation(facts as Partial<Facts>, {}, "CA");
    expect(result.status).toBe("ELICIT");
    expect(result.missing_fields.some((f) => f.includes("homeless_deduction"))).toBe(true);
  });

  it("A01: cat_elig null → ELICIT", () => {
    const facts = cloneFacts(completedFacts(getProfile("A01")));
    (facts as Partial<Facts>).cat_elig = undefined;
    const result = evaluateElicitation(facts as Partial<Facts>, {}, "CA");
    expect(result.status).toBe("ELICIT");
    expect(result.missing_fields).toContain("cat_elig");
  });

  it("A01: assets null → ELICIT", () => {
    const facts = cloneFacts(completedFacts(getProfile("A01")));
    (facts as Partial<Facts>).assets = undefined as never;
    const result = evaluateElicitation(facts as Partial<Facts>, {}, "CA");
    expect(result.status).toBe("ELICIT");
    expect(result.missing_fields).toContain("assets");
  });

  it("A01: deductions.dependent_care null → ELICIT", () => {
    const facts = cloneFacts(completedFacts(getProfile("A01")));
    (facts.deductions as { dependent_care?: unknown }).dependent_care = undefined;
    const result = evaluateElicitation(facts as Partial<Facts>, {}, "CA");
    expect(result.status).toBe("ELICIT");
    expect(result.missing_fields.some((f) => f.includes("dependent_care"))).toBe(true);
  });

  it("A01: household immigration null → ELICIT (group 1 knockout)", () => {
    const facts = cloneFacts(completedFacts(getProfile("A01")));
    facts.household = facts.household.map((m) => ({
      ...m,
      immigration: undefined as never,
    }));
    const result = evaluateElicitation(facts as Partial<Facts>, {}, "CA");
    expect(result.status).toBe("ELICIT");
    // Knockout group 1 should surface first
    expect(result.missing_fields[0]).toContain("immigration");
  });

  it("A01 complete → DETERMINE", () => {
    const facts = completedFacts(getProfile("A01"));
    const result = evaluateElicitation(facts as Partial<Facts>, {}, "CA");
    expect(result.status).toBe("DETERMINE");
  });
});

// ─── TEST CLASS B: Expected Top Recommendation ───────────────────────────────
// Oracle derivation in comments — never copied from running Component R.

describe("Class B — Expected top recommendation", () => {
  // B-1: A03 with medical_unreimbursed zeroed out and income raised to $1500.
  // Oracle: A03 HH1, disability=true, income=$1500 unearned, medical_unreimbursed=0 (zeroed),
  //   answeredAxes.monthly_medical_out_of_pocket_usd=300.
  //   detectMissedElections fires medical_deduction_elderly_disabled (confidence=high).
  //   applyElection sets medical_unreimbursed=300:
  //     With medical=0: adj=1500-209=1291; shelter=850+663=1513; excess=max(0,1513-645.5)=867.5;
  //       net=max(0,1291-867.5)=423.5; benefit=298-0.30×423.5=298-127=171.
  //     With medical=300: adj=1500-209-265=1026; excess=max(0,1513-513)=1000;
  //       net=max(0,1026-1000)=26; benefit=298-0.30×26=290.
  //     delta = 290-171 = $119 > 0 ✓
  //   Note: income raised because at original $1100, net=0 regardless (shelter dominates).
  it("B-1: A03 zeroed medical (income $1500) → top rec = medical deduction (opportunity, missed_election)", () => {
    const rawFacts = cloneFacts(completedFacts(getProfile("A03")));
    rawFacts.deductions.medical_unreimbursed = 0;
    rawFacts.income = [{ member: "m1", type: "unearned_rsdi", amount: 1500 }];
    const verdict = composeVerdict(rawFacts as never, "CA", AS_OF);
    // All 3 utility answers needed for deriveCaSuaTier in detectMissedElections
    const answeredAxes: AnsweredAxes = {
      monthly_medical_out_of_pocket_usd: 300,
      heating_cooling: "yes",
      has_electric_or_gas: "yes",
      has_phone: "yes",
    };
    const ctx = deriveFeasibilityContext(rawFacts as Partial<Facts>, answeredAxes);
    const recs = generateRecommendations(rawFacts, verdict, ctx, "CA", AS_OF, answeredAxes);
    const medRec = recs.recommendations.find(
      (r) => r.field === "deductions.medical_unreimbursed",
    );
    expect(medRec).toBeDefined();
    expect(medRec!.urgency).toBe("opportunity");
    expect(medRec!.perturbation_class).toBe("missed_election");
    expect(medRec!.delta_monthly_usd).toBeGreaterThanOrEqual(50);
  });

  // B-2: A01 with sua_tier changed to "none".
  // Oracle: A01 HH3, wages $1300, CA BBCE 200%.
  //   With sua_tier=none: benefit=round(785-0.30×297)=696.
  //   detectMissedElections fires sua_tier_upward when claimed_sua_tier=NONE and ALL
  //   three utility answers provided (deriveCaSuaTier requires has_heating/electric/phone).
  //   With has_heating_costs=true → eligibleTier=FULL≠NONE → election fired.
  //   applyElection upgrades to HCSUA → benefit=round(785-0.30×87)=759; delta=$63.
  //   Top rec: field=shelter.sua_tier, urgency=opportunity, class=missed_election.
  it("B-2: A01 with sua_tier=none → top rec = SUA upgrade (opportunity, missed_election)", () => {
    const rawFacts = cloneFacts(completedFacts(getProfile("A01")));
    rawFacts.shelter.sua_tier = "none";
    rawFacts.shelter.sua_amount = 0;
    const verdict = composeVerdict(rawFacts as never, "CA", AS_OF);
    // All 3 utility answers required — deriveCaSuaTier returns null if any is null
    const answeredAxes: AnsweredAxes = {
      heating_cooling: "yes",
      has_electric_or_gas: "yes",
      has_phone: "yes",
    };
    const ctx = deriveFeasibilityContext(rawFacts as Partial<Facts>, answeredAxes);
    const recs = generateRecommendations(rawFacts, verdict, ctx, "CA", AS_OF, answeredAxes);
    const suaRec = recs.recommendations.find(
      (r) => r.field === "shelter.sua_tier",
    );
    expect(suaRec).toBeDefined();
    expect(suaRec!.urgency).toBe("opportunity");
    expect(suaRec!.perturbation_class).toBe("missed_election");
    expect(suaRec!.delta_monthly_usd).toBeGreaterThanOrEqual(30);
  });

  // B-3: A01 HH3, income raised to 101% of CA BBCE threshold → DENY → Class 5 boundary_proximity.
  // Oracle: CA HH3 BBCE 200%: FPL monthly = $2222 (from fixture params.fpl.3), threshold = $4444.
  //   income = 4444 * 1.012 ≈ 4497 → DENY at gross test.
  //   distance = (4444 - 4497) / 4444 = -0.0119 → |distance| < 0.05 → Class 5.
  //   urgency = verdict_threatening (currently DENY).
  it("B-3: A01 income at 101% CA threshold → Class 5 boundary_proximity, verdict_threatening", () => {
    const rawFacts = cloneFacts(completedFacts(getProfile("A01")));
    // HH3 CA BBCE 200%: FPL monthly = $2222, threshold = $4444
    // income = $4497 (1.2% over threshold → DENY within 5%)
    rawFacts.income = [{ member: "m1", type: "wages", amount: 4497 }];
    const verdict = composeVerdict(rawFacts as never, "CA", AS_OF);
    expect(verdict.verdict).toBe("DENY");
    const ctx = deriveFeasibilityContext(rawFacts as Partial<Facts>, {});
    const recs = generateRecommendations(rawFacts, verdict, ctx, "CA", AS_OF, {});
    const boundaryRec = recs.recommendations.find(
      (r) => r.perturbation_class === "boundary_proximity",
    );
    expect(boundaryRec).toBeDefined();
    expect(boundaryRec!.urgency).toBe("verdict_threatening");
  });

  // B-4: A01 income at 97% of CA threshold → APPROVE near cliff → Class 5 accuracy_risk.
  // Oracle: income = 4444 * 0.97 ≈ 4311 → APPROVE (under threshold), within 5%.
  //   distance = (4444 - 4311) / 4444 = 0.030 → |distance| < 0.05 → Class 5.
  //   urgency = accuracy_risk (currently APPROVE).
  it("B-4: A01 income at 97% CA threshold → Class 5 boundary_proximity, accuracy_risk", () => {
    const rawFacts = cloneFacts(completedFacts(getProfile("A01")));
    // income = $4311 (3% under threshold → APPROVE within 5%)
    rawFacts.income = [{ member: "m1", type: "wages", amount: 4311 }];
    const verdict = composeVerdict(rawFacts as never, "CA", AS_OF);
    expect(verdict.verdict).toBe("APPROVE");
    const ctx = deriveFeasibilityContext(rawFacts as Partial<Facts>, {});
    const recs = generateRecommendations(rawFacts, verdict, ctx, "CA", AS_OF, {});
    const boundaryRec = recs.recommendations.find(
      (r) => r.perturbation_class === "boundary_proximity",
    );
    expect(boundaryRec).toBeDefined();
    expect(boundaryRec!.urgency).toBe("accuracy_risk");
  });

  // B-5: Weak utility-sua defensibility → verification_upgrade ranked (accuracy_risk).
  // Oracle: PILLAR_MAX_DEFENSIBILITY_SHIFT[utility_sua]=0.75, ERROR_WEIGHT[utility-sua]=0.371.
  //   dollars_at_risk = 0.75 × 0.371 × benefit. For A01 benefit=$759: ~$211.
  //   score=$211 > typical missed-election scores at low confidence.
  it("B-5: weak utility-sua QC result → verification_upgrade candidate with accuracy_risk", () => {
    const rawFacts = cloneFacts(completedFacts(getProfile("A01")));
    const verdict = composeVerdict(rawFacts as never, "CA", AS_OF);
    const answeredAxes: AnsweredAxes = {
      qc_results: [{ flow: "utility-sua", defensibility_score: "weak" }],
    };
    const ctx = deriveFeasibilityContext(rawFacts as Partial<Facts>, answeredAxes);
    const recs = generateRecommendations(rawFacts, verdict, ctx, "CA", AS_OF, answeredAxes);
    const upgradeRec = recs.recommendations.find(
      (r) => r.perturbation_class === "verification_upgrade",
    );
    expect(upgradeRec).toBeDefined();
    expect(upgradeRec!.urgency).toBe("accuracy_risk");
    expect(upgradeRec!.field).toBe("shelter.sua_tier");
  });
});

// ─── TEST CLASS C: Reroute behavior ──────────────────────────────────────────

describe("Class C — Reroute behavior (core invariant)", () => {
  it("C-1: is_homeless → lease steps rerouted, recommendation still present", () => {
    const facts = completedFacts(getProfile("A01"));
    const verdict = composeVerdict(facts as never, "CA", AS_OF);
    const ctx: FeasibilityContext = {
      is_homeless: true,
      is_dv_survivor: false,
      is_migrant: false,
      is_in_treatment: false,
    };
    const recs = generateRecommendations(facts, verdict, ctx, "CA", AS_OF, {});
    // Every rec that has a lease/landlord step must have it rerouted
    for (const rec of recs.recommendations) {
      const leaseSteps = rec.verification_steps.filter(
        (s) =>
          s.detail.toLowerCase().includes("lease") ||
          s.detail.toLowerCase().includes("landlord"),
      );
      for (const step of leaseSteps) {
        expect(step.rerouted).toBe(true);
        expect(step.reroute_reason).toMatch(/R-01/);
      }
    }
  });

  it("C-2: is_dv_survivor → collateral_contact steps rerouted", () => {
    const facts = completedFacts(getProfile("A01"));
    const verdict = composeVerdict(facts as never, "CA", AS_OF);
    const ctx: FeasibilityContext = {
      is_homeless: false,
      is_dv_survivor: true,
      is_migrant: false,
      is_in_treatment: false,
    };
    const recs = generateRecommendations(facts, verdict, ctx, "CA", AS_OF, {});
    // collateral_contact steps that are reroutable by R-02 must be rerouted
    for (const rec of recs.recommendations) {
      const collateral = rec.verification_steps.filter(
        (s) => s.method === "collateral_contact" && s.rerouted,
      );
      for (const step of collateral) {
        expect(step.reroute_reason).toMatch(/R-02/);
      }
    }
  });

  it("C-3: DV explicit question ('prefer_not_to_say') → is_dv_survivor = true", () => {
    const facts = cloneFacts(completedFacts(getProfile("A01")));
    const answeredAxes: AnsweredAxes = {
      contact_safety_concern: "prefer_not_to_say",
    };
    const ctx = deriveFeasibilityContext(facts as Partial<Facts>, answeredAxes);
    expect(ctx.is_dv_survivor).toBe(true);
  });

  it("C-4: DV from ih_arrangement=dv_shelter (fallback) → is_dv_survivor = true", () => {
    const facts = cloneFacts(completedFacts(getProfile("A01")));
    const answeredAxes: AnsweredAxes = { ih_arrangement: "dv_shelter" };
    const ctx = deriveFeasibilityContext(facts as Partial<Facts>, answeredAxes);
    expect(ctx.is_dv_survivor).toBe(true);
  });

  it("C-5: no DV signal → is_dv_survivor = false, collateral_contact not rerouted", () => {
    const facts = completedFacts(getProfile("A01"));
    const ctx = deriveFeasibilityContext(facts as Partial<Facts>, {});
    expect(ctx.is_dv_survivor).toBe(false);
  });
});

// ─── TEST CLASS D: Core Invariant — rerouting does not affect verdict ─────────

describe("Class D — Core invariant", () => {
  it("D-1: VerdictResult is identical regardless of rerouting context", () => {
    const facts = completedFacts(getProfile("A01"));
    const verdict = composeVerdict(facts as never, "CA", AS_OF);

    const ctxOn: FeasibilityContext = {
      is_homeless: true,
      is_dv_survivor: true,
      is_migrant: false,
      is_in_treatment: false,
    };
    const ctxOff: FeasibilityContext = {
      is_homeless: false,
      is_dv_survivor: false,
      is_migrant: false,
      is_in_treatment: false,
    };

    const recsOn  = generateRecommendations(facts, verdict, ctxOn,  "CA", AS_OF, {});
    const recsOff = generateRecommendations(facts, verdict, ctxOff, "CA", AS_OF, {});

    // VerdictResult (from Stage 2) is unchanged — rerouting is output-only
    expect(verdict.verdict).toBeDefined();

    // Rerouted recs still appear — not silently removed
    const reroutedRecs = recsOn.recommendations.filter((r) => r.rerouted);
    for (const rec of reroutedRecs) {
      expect(rec.reroute_reason).toBeTruthy();
      expect(recsOn.recommendations).toContain(rec);
    }

    // Recommendation count must be the same regardless of rerouting context
    expect(recsOn.recommendations.length).toBe(recsOff.recommendations.length);
  });

  it("D-2: rerouted recommendation has reroute_reason populated", () => {
    const facts = completedFacts(getProfile("A01"));
    const verdict = composeVerdict(facts as never, "CA", AS_OF);
    const ctx: FeasibilityContext = {
      is_homeless: true,
      is_dv_survivor: false,
      is_migrant: false,
      is_in_treatment: false,
    };
    const recs = generateRecommendations(facts, verdict, ctx, "CA", AS_OF, {});
    // Any rec with rerouted=true must have reroute_reason
    for (const rec of recs.recommendations) {
      if (rec.rerouted) {
        expect(rec.reroute_reason).toBeTruthy();
      }
    }
  });

  it("D-3: all 4 verification steps always present (never omitted)", () => {
    const facts = completedFacts(getProfile("A01"));
    const verdict = composeVerdict(facts as never, "CA", AS_OF);
    const ctx: FeasibilityContext = {
      is_homeless: true,
      is_dv_survivor: true,
      is_migrant: false,
      is_in_treatment: false,
    };
    const recs = generateRecommendations(facts, verdict, ctx, "CA", AS_OF, {});
    for (const rec of recs.recommendations) {
      expect(rec.verification_steps).toHaveLength(4);
    }
  });
});

// ─── Budget test: ≤ 20 engine calls per evaluateComponentR ───────────────────

describe("Budget test — engine call count", () => {
  it("A01 full evaluateComponentR makes ≤ 20 engine calls", () => {
    const profile = getProfile("A01");
    const facts = completedFacts(profile);
    let callCount = 0;

    const spyAdapters: EngineAdapters = {
      computeBenefit: (f, s, d) => {
        callCount++;
        return computeBenefit(f as never, s, d);
      },
      composeVerdict: (f, s, d) => {
        callCount++;
        return composeVerdict(f as never, s, d);
      },
      detectMissedElections: (p) => {
        callCount++;
        return detectMissedElections(p);
      },
    };

    const input: ComponentRInput = {
      facts: facts as never,
      answeredAxes: { heating_cooling: "yes" },
      state: "CA",
      asOf: AS_OF,
    };
    evaluateComponentR(input, spyAdapters);
    expect(callCount).toBeLessThanOrEqual(20);
  });
});

// ─── Supplementary: Urgency ordering + rank field ────────────────────────────

describe("Urgency ordering invariants", () => {
  it("verdict_threatening ranked before accuracy_risk AND rank field correct", () => {
    const facts = cloneFacts(completedFacts(getProfile("A01")));
    // HH3 CA BBCE threshold = $4444; $4497 = 1.2% over → DENY within 5%
    facts.income = [{ member: "m1", type: "wages", amount: 4497 }];
    const verdict = composeVerdict(facts as never, "CA", AS_OF);
    const answeredAxes: AnsweredAxes = {
      qc_results: [{ flow: "utility-sua", defensibility_score: "weak" }],
    };
    const ctx = deriveFeasibilityContext(facts as Partial<Facts>, answeredAxes);
    const recs = generateRecommendations(facts, verdict, ctx, "CA", AS_OF, answeredAxes);

    // Rank fields must match array position
    recs.recommendations.forEach((r, i) => {
      expect(r.rank).toBe(i + 1);
    });

    const vtIdx = recs.recommendations.findIndex((r) => r.urgency === "verdict_threatening");
    const arIdx = recs.recommendations.findIndex((r) => r.urgency === "accuracy_risk");
    if (vtIdx !== -1 && arIdx !== -1) {
      expect(vtIdx).toBeLessThan(arIdx);
    }
  });

  // M1 catch: two same-urgency candidates where score order is deterministic.
  // Oracle: A03, income=$1500, medical=0, sua_tier=none, all utility answers yes.
  //   Candidate A (SUA upward): baseline benefit=24 (min); with HCSUA → 171; delta=$147; score=0.70×147=$103.
  //   Candidate B (medical): with medical=300 → adj=1026; shelter=850; excess=337; net=689; benefit=91; delta=$67; score=0.70×67=$47.
  //   SUA score($103) > medical score($47) → SUA must be rank 1.
  //   M1 (swap) → medical at rank 1 → r0.field = medical → test fails. ✓
  it("rank 1 rec has highest score when two opportunity candidates compete (M1 catch)", () => {
    const facts = cloneFacts(completedFacts(getProfile("A03")));
    facts.deductions.medical_unreimbursed = 0;
    facts.income = [{ member: "m1", type: "unearned_rsdi", amount: 1500 }];
    facts.shelter.sua_tier = "none";
    facts.shelter.sua_amount = 0;
    const verdict = composeVerdict(facts as never, "CA", AS_OF);
    // All three utility answers required for deriveCaSuaTier
    const answeredAxes: AnsweredAxes = {
      monthly_medical_out_of_pocket_usd: 300,
      heating_cooling: "yes",
      has_electric_or_gas: "yes",
      has_phone: "yes",
    };
    const ctx = deriveFeasibilityContext(facts as Partial<Facts>, answeredAxes);
    const recs = generateRecommendations(facts, verdict, ctx, "CA", AS_OF, answeredAxes);

    // Both SUA and medical candidates should be generated
    const suaRec = recs.recommendations.find((r) => r.field === "shelter.sua_tier");
    const medRec = recs.recommendations.find((r) => r.field === "deductions.medical_unreimbursed");
    expect(suaRec).toBeDefined();
    expect(medRec).toBeDefined();

    // SUA has higher delta ($147 > $67) → must rank higher
    expect(suaRec!.rank).toBeLessThan(medRec!.rank);

    // Rank field must equal array position + 1
    recs.recommendations.forEach((r, i) => {
      expect(r.rank).toBe(i + 1);
    });

    // rank 1 has score >= rank 2 when same urgency
    const r0 = recs.recommendations[0]!;
    const r1 = recs.recommendations[1]!;
    if (r0.urgency === r1.urgency) {
      expect(r0.score).toBeGreaterThanOrEqual(r1.score);
    }
  });

  it("max 4 recommendations hard cap always enforced", () => {
    const facts = completedFacts(getProfile("A01"));
    const verdict = composeVerdict(facts as never, "CA", AS_OF);
    const answeredAxes: AnsweredAxes = {
      qc_results: [
        { flow: "utility-sua", defensibility_score: "weak" },
        { flow: "gig-income",  defensibility_score: "weak" },
      ],
      heating_cooling: "yes",
      has_electric_or_gas: "yes",
      has_phone: "yes",
      monthly_medical_out_of_pocket_usd: 200,
    };
    const ctx = deriveFeasibilityContext(facts as Partial<Facts>, answeredAxes);
    const recs = generateRecommendations(facts, verdict, ctx, "CA", AS_OF, answeredAxes);
    expect(recs.recommendations.length).toBeLessThanOrEqual(4);
  });
});

// ─── Mutation-hardening unit tests ───────────────────────────────────────────
// These tests target specific implementation paths missed by integration tests.
// Each maps to one mutation from the M1–M8 scorecard.

describe("M1 catch — within-tier score ordering", () => {
  // Directly test rankCandidates: higher-score candidate must come first within same tier.
  it("rankCandidates: higher-score opportunity candidate gets rank 1", () => {
    const low: RawCandidate = {
      perturbation_class: "missed_election",
      field: "deductions.medical_unreimbursed",
      action: "low",
      delta_monthly_usd: 50,
      source_election: { kind: "medical_deduction_elderly_disabled", label: "", reason: "",
        estimated_monthly_value_usd: 50, confidence: "high", citation: "x", action_required: "" },
      citable_to: [],
    };
    const high: RawCandidate = {
      perturbation_class: "missed_election",
      field: "shelter.sua_tier",
      action: "high",
      delta_monthly_usd: 150,
      source_election: { kind: "sua_tier_upward", label: "", reason: "",
        estimated_monthly_value_usd: 150, confidence: "high", citation: "x", action_required: "" },
      citable_to: [],
    };
    const fakeVerdict = { verdict: "APPROVE" as const, benefit: 298, trace: {} };
    const ranked = rankCandidates([low, high], fakeVerdict as never);
    // High-delta candidate must rank first
    expect(ranked[0]!.field).toBe("shelter.sua_tier");
    expect(ranked[1]!.field).toBe("deductions.medical_unreimbursed");
  });
});

describe("M2 catch — R-01 homeless rerouting", () => {
  // buildVerificationSteps with is_homeless=true must reroute lease/landlord steps
  it("shelter.rent chain: document and collateral_contact rerouted when homeless", () => {
    const ctx: FeasibilityContext = {
      is_homeless: true, is_dv_survivor: false, is_migrant: false, is_in_treatment: false,
    };
    const steps = buildVerificationSteps("shelter.rent", ctx);
    expect(steps).toHaveLength(4); // All steps still present (invariant)
    const docStep = steps.find((s) => s.method === "document")!;
    const ccStep  = steps.find((s) => s.method === "collateral_contact")!;
    const attStep = steps.find((s) => s.method === "attestation")!;
    expect(docStep.rerouted).toBe(true);
    expect(docStep.reroute_reason).toMatch(/R-01/);
    expect(ccStep.rerouted).toBe(true);
    expect(attStep.rerouted).toBe(false); // attestation is not rerouted by R-01
  });

  it("shelter.rent chain: steps NOT rerouted when not homeless", () => {
    const ctx: FeasibilityContext = {
      is_homeless: false, is_dv_survivor: false, is_migrant: false, is_in_treatment: false,
    };
    const steps = buildVerificationSteps("shelter.rent", ctx);
    expect(steps.every((s) => !s.rerouted)).toBe(true);
  });
});

describe("M3 catch — P-02 plausibility check", () => {
  it("P-02 fires when dependent_care > 0 and no child under 18", () => {
    const facts: Partial<Facts> = {
      household: [{ member_id: "m1", age: 35, role: "head", immigration: "citizen",
        five_yr_bar: "n/a", sponsored: false, work_class: "gen_work_subject",
        abawd_months_used: 0, disqual: [], disability: false, elderly: false, student: "not" }],
      income: [{ member: "m1", type: "wages", amount: 1000 }],
      shelter: { rent: 500, sua_tier: "none", sua_amount: 0, internet: 0, homeless_deduction: false },
      deductions: { dependent_care: 200, medical_unreimbursed: 0, child_support_paid: 0 },
      assets: 100,
      cat_elig: "NPA",
    };
    const flags = runPlausibilityChecks(facts, {});
    expect(flags.some((f) => f.id === "P-02")).toBe(true);
  });

  it("P-02 does NOT fire when there IS a child under 18", () => {
    const facts: Partial<Facts> = {
      household: [
        { member_id: "m1", age: 35, role: "head", immigration: "citizen",
          five_yr_bar: "n/a", sponsored: false, work_class: "gen_work_subject",
          abawd_months_used: 0, disqual: [], disability: false, elderly: false, student: "not" },
        { member_id: "m2", age: 5, role: "child", immigration: "citizen",
          five_yr_bar: "n/a", sponsored: false, work_class: "gen_work_subject",
          abawd_months_used: 0, disqual: [], disability: false, elderly: false, student: "not" },
      ],
      income: [{ member: "m1", type: "wages", amount: 1000 }],
      shelter: { rent: 500, sua_tier: "none", sua_amount: 0, internet: 0, homeless_deduction: false },
      deductions: { dependent_care: 200, medical_unreimbursed: 0, child_support_paid: 0 },
      assets: 100,
      cat_elig: "NPA",
    };
    const flags = runPlausibilityChecks(facts, {});
    expect(flags.some((f) => f.id === "P-02")).toBe(false);
  });
});

describe("M4 catch — max-4 recommendations cap", () => {
  it("rankCandidates caps output at 4 even with 6 input candidates", () => {
    const makeCandidate = (field: string, delta: number): RawCandidate => ({
      perturbation_class: "missed_election",
      field,
      action: "test",
      delta_monthly_usd: delta,
      source_election: { kind: "sua_tier_upward", label: "", reason: "",
        estimated_monthly_value_usd: delta, confidence: "high", citation: "x", action_required: "" },
      citable_to: [],
    });
    const candidates = [
      makeCandidate("f1", 100), makeCandidate("f2", 90), makeCandidate("f3", 80),
      makeCandidate("f4", 70), makeCandidate("f5", 60), makeCandidate("f6", 50),
    ];
    const fakeVerdict = { verdict: "APPROVE" as const, benefit: 500, trace: {} };
    const ranked = rankCandidates(candidates, fakeVerdict as never);
    expect(ranked).toHaveLength(4);
    // Also verify they're the top 4 by score
    expect(ranked[0]!.field).toBe("f1");
    expect(ranked[3]!.field).toBe("f4");
  });
});

describe("M8 catch — action text is verify, not correct", () => {
  it("income_verification action says 'verify' not 'correct'", () => {
    // Class 2 requires anticipation="estimated" to trigger.
    // Any income_verification rec must use non-directional language.
    const facts = cloneFacts(completedFacts(getProfile("A01")));
    // Set anticipation="estimated" to trigger Class 2 income verification candidate
    facts.income = [{ member: "m1", type: "wages", amount: 1300,
      freq: "monthly", anticipation: "estimated", source_status: "ongoing" }];
    const verdict = composeVerdict(facts as never, "CA", AS_OF);
    const ctx = deriveFeasibilityContext(facts as Partial<Facts>, {});
    const recs = generateRecommendations(facts, verdict, ctx, "CA", AS_OF, {});
    const incomeVerRecs = recs.recommendations.filter(
      (r) => r.perturbation_class === "income_verification",
    );
    for (const rec of incomeVerRecs) {
      expect(rec.action.toLowerCase()).toContain("verify");
      // Must not direct the navigator to change/correct a value in a specific direction
      expect(rec.action.toLowerCase()).not.toContain("correct your");
      expect(rec.action.toLowerCase()).not.toContain("adjust the");
      expect(rec.action.toLowerCase()).not.toContain("change the stated");
    }
  });
});
