import { describe, it, expect } from "vitest";
import { getEngineParams } from "@civica/snap-rules";
import txSupplements from "../states/tx/supplements.json";
import txFreshness from "../states/tx/freshness.json";

// TX utility standards live in TWO places by necessity: the engine
// (packages/snap-rules/src/constants/states.ts) computes benefits with them,
// and the verified TX pack quotes them to users. snap-rules cannot import the
// pack (the dependency runs the other way), so the duplicate is unavoidable —
// this test is the seam that keeps them honest.
//
// If someone updates one at the October COLA and forgets the other, Demeter
// would quote one set of figures while the engine computed with another. That
// is the exact "invisible-wrong number" failure this repo keeps finding.

const EXPECTED = { HCSUA: 445, LUA: 400, phone: 62 };

describe("TX utility standards: engine ↔ pack parity", () => {
  it("the engine computes with the FY26 Texas standards", () => {
    // getEngineParams is the surface Demeter and the profile-harness both
    // read, so asserting here covers the path that actually matters.
    const tx = getEngineParams("TX", new Date("2026-08-08"));
    expect(tx.sua, "TX SUA must be authored — see #607").toBeTruthy();
    expect(tx.sua!.HCSUA).toBe(EXPECTED.HCSUA);
    expect(tx.sua!.LUA).toBe(EXPECTED.LUA); // TX calls this the BUA
    expect(tx.sua!.phone).toBe(EXPECTED.phone);
    expect(tx.sua!.none).toBe(0);
  });

  it("the pack quotes the same figures to users", () => {
    // The supplement text is what Demeter puts in front of a Texan.
    const sua = txSupplements.supplements.find((s) => s.key === "sua-values");
    expect(sua, "tx pack should carry an sua-values supplement").toBeTruthy();
    const text = sua!.text;
    expect(text).toContain(`$${EXPECTED.HCSUA}`);
    expect(text).toContain(`$${EXPECTED.LUA}`);
    expect(text).toContain(`$${EXPECTED.phone}`);
    // And it must still cite the authority the engine comment points at.
    expect(sua!.citation).toContain("A-1429");
  });

  it("both sides expire on the same COLA date", () => {
    // The engine comment says EXPIRES 2026-09-30; the pack's freshness entry
    // is the machine-readable half of that promise.
    const entry = txFreshness.entries.find((e) => e.key === "tx-fy26-dollar-values");
    expect(entry, "tx pack should pin an FY26 dollar-value expiry").toBeTruthy();
    expect(entry!.date).toBe("2026-09-30");
    expect(entry!.warning).toContain("A-1429");
  });
});
