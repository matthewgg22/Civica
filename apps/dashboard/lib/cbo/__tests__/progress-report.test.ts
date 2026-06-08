import { describe, expect, it } from "vitest";
import {
  snapshotFor,
  rangeForPeriod,
  fmtRange,
  isoDate,
  reportDocument,
  type ReportData,
} from "../progress-report";

describe("progress-report", () => {
  it("anchors the Month snapshot to the live engine benefit total", () => {
    const monthly = 12_345;
    expect(snapshotFor("month", monthly).benefitsUsd).toBe(monthly);
    // Other periods scale it — day is smaller, year is far larger.
    expect(snapshotFor("day", monthly).benefitsUsd).toBeLessThan(monthly);
    expect(snapshotFor("year", monthly).benefitsUsd).toBeGreaterThan(monthly);
  });

  it("grows volume counts monotonically across widening windows", () => {
    const order = ["day", "week", "month", "ytd", "year"] as const;
    const apps = order.map((p) => snapshotFor(p, 0).apps);
    const enrolled = order.map((p) => snapshotFor(p, 0).enrolled);
    for (let i = 1; i < apps.length; i++) {
      expect(apps[i]).toBeGreaterThan(apps[i - 1]);
      expect(enrolled[i]).toBeGreaterThan(enrolled[i - 1]);
    }
  });

  it("computes period date ranges relative to a fixed 'now'", () => {
    const now = new Date(2026, 5, 8); // Jun 8 2026 (local)
    expect(isoDate(rangeForPeriod("day", now).from)).toBe("2026-06-08");
    expect(isoDate(rangeForPeriod("week", now).from)).toBe("2026-06-02");
    expect(isoDate(rangeForPeriod("month", now).from)).toBe("2026-05-10");
    expect(isoDate(rangeForPeriod("ytd", now).from)).toBe("2026-01-01");
    expect(isoDate(rangeForPeriod("year", now).from)).toBe("2025-06-09");
  });

  it("formats a single day vs. a span", () => {
    const d = new Date(2026, 5, 8);
    expect(fmtRange(d, d)).toMatch(/Jun 8, 2026/);
    expect(fmtRange(new Date(2026, 0, 1), d)).toMatch(/Jan 1.*Jun 8, 2026/);
  });

  const data: ReportData = {
    periodLabel: "Year to date",
    rangeLabel: "Jan 1 – Jun 8, 2026",
    generatedAt: "2026-06-08",
    snapshot: { apps: 421, enrolled: 238, benefitsUsd: 66_000, errorRate: 4.6, handoff: 7 },
    phases: [{ label: "Enrolled", count: 3 }],
    navigators: [{ name: "Ashley Cole", cases: 4, flags: 1, risk: "MED", avgDays: 7 }],
    totals: { cases: 10, flags: 2, benefitsUsd: 5_500 },
  };

  it("renders a self-contained PDF document with a print button", () => {
    const html = reportDocument(data, { forWord: false });
    expect(html).toContain("<!doctype html>");
    expect(html).toContain("window.print()");
    expect(html).toContain("Year to date");
    expect(html).toContain("421");
    expect(html).toContain("Ashley Cole");
    expect(html).toContain("4.6%");
  });

  it("renders a Word document with Office namespaces and no print button", () => {
    const html = reportDocument(data, { forWord: true });
    expect(html).toContain("urn:schemas-microsoft-com:office:word");
    expect(html).not.toContain("window.print()");
    expect(html).toContain("Year to date");
  });
});
