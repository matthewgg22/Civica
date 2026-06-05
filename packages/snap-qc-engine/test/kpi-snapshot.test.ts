import { describe, it, expect } from "vitest";
import {
  buildKpiSnapshot,
  CA_BASELINE_PER,
  ENGINE_VERSION,
  type KpiSnapshotInputs,
  type KpiSnapshotRow,
} from "../src/index";

const baseInputs = (over: Partial<KpiSnapshotInputs> = {}): KpiSnapshotInputs => ({
  cpr: { cleanPackets: 8, totalScored: 10 },
  elementTriggers: [{ element: "earned_income_unverified", triggered: 3 }],
  outcomes: { decided: 0, denied: 0, authoritative: { n: 0, errors: 0 } },
  ...over,
});

const find = (rows: KpiSnapshotRow[], kpi: string, element: string | null = null) =>
  rows.find((r) => r.kpi_key === kpi && r.element === element);

describe("buildKpiSnapshot", () => {
  it("computes Clean-Packet Rate (1a) as a leading row, n = totalScored, with baseline_ref", () => {
    const rows = buildKpiSnapshot(baseInputs());
    const cpr = find(rows, "clean_packet_rate");
    expect(cpr).toBeDefined();
    expect(cpr!.pillar).toBe("get_in");
    expect(cpr!.source_kind).toBe("leading");
    expect(cpr!.value_pct).toBe(80); // 8/10
    expect(cpr!.n).toBe(10);
    expect(cpr!.ci_low).toBeNull(); // leading rows carry no CI
    expect(cpr!.ci_high).toBeNull();
    expect(cpr!.baseline_ref).toBe(CA_BASELINE_PER);
    expect(cpr!.engine_version).toBe(ENGINE_VERSION);
  });

  it("reports CPR as null with status=no_packets when nothing has been scored", () => {
    const rows = buildKpiSnapshot(baseInputs({ cpr: { cleanPackets: 0, totalScored: 0 }, elementTriggers: [] }));
    const cpr = find(rows, "clean_packet_rate");
    expect(cpr!.value_pct).toBeNull();
    expect(cpr!.n).toBe(0);
    expect(cpr!.meta.status).toBe("no_packets");
  });

  it("computes Element-Clean Rate (1b) per element as leading rows", () => {
    const rows = buildKpiSnapshot(baseInputs());
    const el = find(rows, "element_clean_rate", "earned_income_unverified");
    expect(el).toBeDefined();
    expect(el!.source_kind).toBe("leading");
    expect(el!.value_pct).toBe(70); // (10 - 3) / 10
    expect(el!.n).toBe(10);
    expect(el!.meta.triggered).toBe(3);
  });

  it("n-gates denial_rate below the sample floor (reports n, value null, insufficient_sample)", () => {
    const rows = buildKpiSnapshot(baseInputs({ outcomes: { decided: 5, denied: 2, authoritative: { n: 0, errors: 0 } } }));
    const dr = find(rows, "denial_rate");
    expect(dr!.source_kind).toBe("measured");
    expect(dr!.value_pct).toBeNull();
    expect(dr!.n).toBe(5); // n still reported so the outcome "appears"
    expect(dr!.meta.status).toBe("insufficient_sample");
    expect(dr!.meta.numerator).toBe(2);
  });

  it("reports denial_rate with a Wilson band at/above the n-gate", () => {
    const rows = buildKpiSnapshot(baseInputs({ outcomes: { decided: 100, denied: 20, authoritative: { n: 0, errors: 0 } } }));
    const dr = find(rows, "denial_rate");
    expect(dr!.value_pct).toBe(20); // 20/100
    expect(dr!.n).toBe(100);
    expect(dr!.meta.status).toBe("measured");
    expect(dr!.ci_low).not.toBeNull();
    expect(dr!.ci_high).not.toBeNull();
    expect(dr!.ci_low!).toBeLessThan(20);
    expect(dr!.ci_high!).toBeGreaterThan(20);
  });

  it("FIDELITY: measured_per stays insufficient_sample when no authoritative outcomes exist", () => {
    // The pre-TODO-44 state: only self-reports exist → authoritative n=0 → PER pending.
    const rows = buildKpiSnapshot(baseInputs({ outcomes: { decided: 50, denied: 10, authoritative: { n: 0, errors: 0 } } }));
    const per = find(rows, "measured_per");
    expect(per!.source_kind).toBe("measured");
    expect(per!.value_pct).toBeNull();
    expect(per!.n).toBe(0);
    expect(per!.meta.status).toBe("insufficient_sample");
    expect(per!.meta.fidelity).toBe("authoritative_only");
    // self-reported denials populated denial_rate but NOT measured_per:
    expect(find(rows, "denial_rate")!.n).toBe(50);
  });

  it("computes measured_per from authoritative counts above the gate, with baseline_ref", () => {
    const rows = buildKpiSnapshot(baseInputs({ outcomes: { decided: 0, denied: 0, authoritative: { n: 50, errors: 5 } } }));
    const per = find(rows, "measured_per");
    expect(per!.value_pct).toBe(10); // 5/50
    expect(per!.n).toBe(50);
    expect(per!.meta.status).toBe("measured");
    expect(per!.baseline_ref).toBe(CA_BASELINE_PER);
    expect(per!.ci_low).not.toBeNull();
  });

  it("carries the authoritative source split into measured_per meta.by_source", () => {
    const rows = buildKpiSnapshot(
      baseInputs({
        outcomes: {
          decided: 0,
          denied: 0,
          authoritative: { n: 50, errors: 5, bySource: { qc_sample: 50, county_authoritative: 0 } },
        },
      }),
    );
    const per = find(rows, "measured_per");
    expect(per!.value_pct).toBe(10); // 5/50, fed entirely by internal QC
    expect(per!.meta.by_source).toEqual({ qc_sample: 50, county_authoritative: 0 });
  });

  it("honors a measuredMinN override (lets small samples report a rate)", () => {
    const rows = buildKpiSnapshot(baseInputs({ outcomes: { decided: 4, denied: 1, authoritative: { n: 0, errors: 0 } }, measuredMinN: 1 }));
    const dr = find(rows, "denial_rate");
    expect(dr!.value_pct).toBe(25); // 1/4, gate lowered to 1
    expect(dr!.meta.status).toBe("measured");
  });

  it("is deterministic — identical inputs produce identical rows (anti-drift)", () => {
    const a = buildKpiSnapshot(baseInputs());
    const b = buildKpiSnapshot(baseInputs());
    expect(a).toEqual(b);
  });

  it("emits exactly the Phase-1 Pillar-1 row set when Pillar 2/3 inputs are absent", () => {
    const rows = buildKpiSnapshot(baseInputs());
    expect(rows.every((r) => r.pillar === "get_in")).toBe(true);
    const keys = rows.map((r) => r.kpi_key).sort();
    expect(keys).toEqual(["clean_packet_rate", "denial_rate", "element_clean_rate", "measured_per"]);
  });
});

describe("buildKpiSnapshot — Pillar 2 (Stay Engaged)", () => {
  it("emits no Pillar-2 row when stayEngaged is absent (backward compatible)", () => {
    const rows = buildKpiSnapshot(baseInputs());
    expect(find(rows, "active_relationship_rate")).toBeUndefined();
  });

  it("computes Active-Relationship Rate as a leading row (no CI)", () => {
    const rows = buildKpiSnapshot(
      baseInputs({ stayEngaged: { activeRelationship: { contactedRecently: 18, activeTotal: 24 } } }),
    );
    const arr = find(rows, "active_relationship_rate");
    expect(arr).toBeDefined();
    expect(arr!.pillar).toBe("stay_engaged");
    expect(arr!.source_kind).toBe("leading");
    expect(arr!.value_pct).toBe(75); // 18/24
    expect(arr!.n).toBe(24);
    expect(arr!.ci_low).toBeNull();
    expect(arr!.ci_high).toBeNull();
    expect(arr!.meta.contacted_recently).toBe(18);
  });

  it("reports ARR null with status=no_active_packets when there are none", () => {
    const rows = buildKpiSnapshot(
      baseInputs({ stayEngaged: { activeRelationship: { contactedRecently: 0, activeTotal: 0 } } }),
    );
    const arr = find(rows, "active_relationship_rate");
    expect(arr!.value_pct).toBeNull();
    expect(arr!.n).toBe(0);
    expect(arr!.meta.status).toBe("no_active_packets");
  });
});

describe("buildKpiSnapshot — Pillar 3 (Stay On)", () => {
  const stayOn = (over: Partial<NonNullable<KpiSnapshotInputs["stayOn"]>> = {}) =>
    baseInputs({
      stayOn: {
        reportingMoment: { prepStartedAhead: 0, upcomingTotal: 0 },
        recert: { churned: 0, terminal: 0 },
        ...over,
      },
    });

  it("emits no Pillar-3 rows when stayOn is absent (backward compatible)", () => {
    const rows = buildKpiSnapshot(baseInputs());
    expect(find(rows, "reporting_moment_coverage")).toBeUndefined();
    expect(find(rows, "churn_rate")).toBeUndefined();
  });

  it("computes Reporting-Moment Coverage as a leading row", () => {
    const rows = buildKpiSnapshot(
      stayOn({ reportingMoment: { prepStartedAhead: 12, upcomingTotal: 20 } }),
    );
    const rmc = find(rows, "reporting_moment_coverage");
    expect(rmc).toBeDefined();
    expect(rmc!.pillar).toBe("stay_on");
    expect(rmc!.source_kind).toBe("leading");
    expect(rmc!.value_pct).toBe(60); // 12/20
    expect(rmc!.n).toBe(20);
    expect(rmc!.meta.prep_started_ahead).toBe(12);
  });

  it("reports RMC null with status=no_upcoming_recerts when none are due", () => {
    const rows = buildKpiSnapshot(stayOn());
    const rmc = find(rows, "reporting_moment_coverage");
    expect(rmc!.value_pct).toBeNull();
    expect(rmc!.meta.status).toBe("no_upcoming_recerts");
  });

  it("n-gates churn_rate below the sample floor (measured, insufficient_sample)", () => {
    const rows = buildKpiSnapshot(stayOn({ recert: { churned: 3, terminal: 10 } }));
    const churn = find(rows, "churn_rate");
    expect(churn!.source_kind).toBe("measured");
    expect(churn!.value_pct).toBeNull();
    expect(churn!.n).toBe(10);
    expect(churn!.meta.status).toBe("insufficient_sample");
  });

  it("computes churn_rate with a Wilson band at/above the gate", () => {
    const rows = buildKpiSnapshot(
      stayOn({ recert: { churned: 9, terminal: 40 } }),
    );
    const churn = find(rows, "churn_rate");
    expect(churn!.value_pct).toBeCloseTo(22.5, 1); // 9/40
    expect(churn!.ci_low).not.toBeNull();
    expect(churn!.ci_high).not.toBeNull();
    expect(churn!.meta.status).toBe("measured");
  });

  it("emits the full three-pillar row set when all inputs are present", () => {
    const rows = buildKpiSnapshot(
      baseInputs({
        stayEngaged: { activeRelationship: { contactedRecently: 5, activeTotal: 10 } },
        stayOn: {
          reportingMoment: { prepStartedAhead: 1, upcomingTotal: 2 },
          recert: { churned: 0, terminal: 0 },
        },
      }),
    );
    const pillars = new Set(rows.map((r) => r.pillar));
    expect(pillars).toEqual(new Set(["get_in", "stay_engaged", "stay_on"]));
  });
});
