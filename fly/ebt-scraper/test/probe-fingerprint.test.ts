import { describe, it, expect } from "vitest";
import { diffFingerprints, type ProbeFingerprintResult } from "../src/probe-fingerprint.js";

const BASELINE: ProbeFingerprintResult = {
  balance: {
    url: "https://www.ebt.ca.gov/cardholder/Home",
    status: 200,
    inputNames: ["userid", "password"],
    tableColumnCounts: [3],
    anchorTextPresence: {
      "Available Balance": true,
      "Food Benefits": true,
      "Cash Benefits": true,
    },
  },
  transactions: {
    url: "https://www.ebt.ca.gov/cardholder/transactions",
    status: 200,
    inputNames: [],
    tableColumnCounts: [4],
    anchorTextPresence: {
      "Transaction History": true,
      Posted: true,
      Amount: true,
    },
  },
  capturedAt: "2026-05-20T14:00:00.000Z",
};

function clone(x: ProbeFingerprintResult): ProbeFingerprintResult {
  return JSON.parse(JSON.stringify(x)) as ProbeFingerprintResult;
}

describe("diffFingerprints", () => {
  it("returns equal=true and no changes when the two fingerprints match", () => {
    const current = clone(BASELINE);
    current.capturedAt = "2026-05-24T14:00:00.000Z"; // different timestamp ignored
    const diff = diffFingerprints(BASELINE, current);
    expect(diff.equal).toBe(true);
    expect(diff.changes).toEqual([]);
  });

  it("detects input-name drift on the balance page", () => {
    const current = clone(BASELINE);
    current.balance.inputNames = ["cardNumber", "pin"]; // portal renamed inputs
    const diff = diffFingerprints(BASELINE, current);
    expect(diff.equal).toBe(false);
    expect(diff.changes).toHaveLength(1);
    expect(diff.changes[0]).toMatchObject({ page: "balance", field: "inputNames" });
  });

  it("detects table-column-count drift on the transactions page", () => {
    const current = clone(BASELINE);
    current.transactions.tableColumnCounts = [5]; // extra column appeared
    const diff = diffFingerprints(BASELINE, current);
    expect(diff.equal).toBe(false);
    expect(diff.changes.some((c) => c.page === "transactions" && c.field === "tableColumnCounts")).toBe(true);
  });

  it("detects a previously-present anchor text going missing", () => {
    const current = clone(BASELINE);
    current.balance.anchorTextPresence["Food Benefits"] = false;
    const diff = diffFingerprints(BASELINE, current);
    expect(diff.equal).toBe(false);
    expect(diff.changes.some((c) => c.field === "anchorTextPresence")).toBe(true);
  });

  it("reports multiple changes when multiple fields drift", () => {
    const current = clone(BASELINE);
    current.balance.inputNames = ["x"];
    current.transactions.tableColumnCounts = [99];
    const diff = diffFingerprints(BASELINE, current);
    expect(diff.equal).toBe(false);
    expect(diff.changes).toHaveLength(2);
  });

  it("ignores status differences (portal-down is a different alert path)", () => {
    const current = clone(BASELINE);
    current.balance.status = 503;
    current.transactions.status = 502;
    const diff = diffFingerprints(BASELINE, current);
    // Status drift alone is not structural drift — uptime/health alerts handle it.
    expect(diff.equal).toBe(true);
  });
});
