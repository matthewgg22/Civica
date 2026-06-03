// Lint tests: verify the staleness gate fires when it should.

import { afterEach, describe, expect, it } from "vitest";
import { lintRegistry } from "./lint";
import { _resetRegistryCache } from "./load";

describe("registry lint — staleness gate", () => {
  afterEach(() => _resetRegistryCache());

  it("returns empty/clean for today's date (registry must ship lint-clean)", () => {
    const findings = lintRegistry(new Date());
    const fails = findings.filter((f) => f.level === "FAIL");
    expect(fails).toEqual([]);
  });

  it("FLAGS as FAIL when run with a date past valid_through (ca_lua_fy26 expires 2026-09-30)", () => {
    const futureDate = new Date(Date.UTC(2027, 0, 1)); // Jan 1, 2027
    const findings = lintRegistry(futureDate);
    const fails = findings.filter((f) => f.level === "FAIL");
    expect(fails.length).toBeGreaterThan(0);
    expect(fails.some((f) => f.id === "ca_lua_fy26")).toBe(true);
    expect(fails.find((f) => f.id === "ca_lua_fy26")?.message).toMatch(/EXPIRED/);
  });

  it("FLAGS as WARN within 30 days of expiry", () => {
    // ca_lua_fy26 valid_through 2026-09-30. 15 days before = 2026-09-15.
    const nearExpiry = new Date(Date.UTC(2026, 8, 15));
    const findings = lintRegistry(nearExpiry);
    const warns = findings.filter((f) => f.level === "WARN");
    const fails = findings.filter((f) => f.level === "FAIL");
    expect(fails).toEqual([]); // not yet expired
    expect(warns.some((f) => f.id === "ca_lua_fy26")).toBe(true);
  });

  it("citation entries with null valid_through are accepted (CFR sections don't expire)", () => {
    const findings = lintRegistry(new Date());
    const lotteryDqFindings = findings.filter(
      (f) => f.id === "cite_lottery_dq",
    );
    // No expiry, no warn for citation type — should be silent.
    expect(lotteryDqFindings).toEqual([]);
  });
});
