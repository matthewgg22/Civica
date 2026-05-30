import { describe, it, expect } from "vitest";
import { mapKpiRows } from "../kpi-snapshot";

// mapKpiRows is the pure mapper (no Supabase). It shapes raw v_kpi_current rows
// into the render-ready truth point the panel consumes.

const rows = [
  {
    computed_at: "2026-05-30T04:00:00Z",
    engine_version: "0.3.0",
    pillar: "get_in",
    kpi_key: "clean_packet_rate",
    element: null,
    value_pct: "80.000", // NUMERIC arrives as a string over the wire
    ci_low: null,
    ci_high: null,
    n: 10,
    baseline_ref: "10.98",
    source_kind: "leading",
    meta: { clean_packets: 8 },
  },
  {
    computed_at: "2026-05-30T04:00:00Z",
    engine_version: "0.3.0",
    pillar: "get_in",
    kpi_key: "element_clean_rate",
    element: "earned_income_unverified",
    value_pct: "70",
    ci_low: null,
    ci_high: null,
    n: 10,
    baseline_ref: null,
    source_kind: "leading",
    meta: { triggered: 3 },
  },
  {
    computed_at: "2026-05-30T04:00:00Z",
    engine_version: "0.3.0",
    pillar: "get_in",
    kpi_key: "denial_rate",
    element: null,
    value_pct: "20",
    ci_low: "13",
    ci_high: "29",
    n: 100,
    baseline_ref: null,
    source_kind: "measured",
    meta: { status: "measured" },
  },
  {
    computed_at: "2026-05-30T04:00:00Z",
    engine_version: "0.3.0",
    pillar: "get_in",
    kpi_key: "measured_per",
    element: null,
    value_pct: null,
    ci_low: null,
    ci_high: null,
    n: 0,
    baseline_ref: "10.98",
    source_kind: "measured",
    meta: { status: "insufficient_sample", fidelity: "authoritative_only" },
  },
];

describe("mapKpiRows", () => {
  it("returns unavailable for an empty snapshot", () => {
    const tp = mapKpiRows([]);
    expect(tp.available).toBe(false);
    expect(tp.cleanPacketRate).toBeNull();
    expect(tp.elementClean).toEqual([]);
  });

  it("shapes rows with provenance + convenience accessors", () => {
    const tp = mapKpiRows(rows);
    expect(tp.available).toBe(true);
    expect(tp.computedAt).toBe("2026-05-30T04:00:00Z");
    expect(tp.engineVersion).toBe("0.3.0");

    // Clean-Packet Rate (1a) leading, with NUMERIC strings coerced to numbers.
    expect(tp.cleanPacketRate?.valuePct).toBe(80);
    expect(tp.cleanPacketRate?.baselineRef).toBe(10.98);
    expect(tp.cleanPacketRate?.sourceKind).toBe("leading");
    expect(tp.cleanPacketRate?.n).toBe(10);
  });

  it("groups element_clean_rate rows separately from scalar KPIs", () => {
    const tp = mapKpiRows(rows);
    expect(tp.elementClean).toHaveLength(1);
    expect(tp.elementClean[0]?.element).toBe("earned_income_unverified");
    expect(tp.elementClean[0]?.valuePct).toBe(70);
    // element_clean_rate must NOT leak into the scalar byKey map.
    expect(tp.byKey.element_clean_rate).toBeUndefined();
  });

  it("carries measured status + CI through (denial measured, PER pending)", () => {
    const tp = mapKpiRows(rows);
    expect(tp.denialRate?.valuePct).toBe(20);
    expect(tp.denialRate?.ciLow).toBe(13);
    expect(tp.denialRate?.ciHigh).toBe(29);
    expect(tp.denialRate?.meta.status).toBe("measured");

    // FIDELITY: measured_per is pending (null) with the authoritative-only flag.
    expect(tp.measuredPer?.valuePct).toBeNull();
    expect(tp.measuredPer?.n).toBe(0);
    expect(tp.measuredPer?.meta.status).toBe("insufficient_sample");
    expect(tp.measuredPer?.meta.fidelity).toBe("authoritative_only");
  });
});
