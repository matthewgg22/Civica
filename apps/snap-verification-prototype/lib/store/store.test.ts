import { afterEach, beforeAll, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { UtilityPackage } from "@/types/verification";

// Use a temp DB so tests are isolated from .data/snap.db.
const tmpDb = path.join(os.tmpdir(), `snap-test-${Date.now()}.db`);
process.env.SNAP_DB_PATH = tmpDb;

let store: typeof import("./index");

beforeAll(async () => {
  store = await import("./index");
});

afterEach(() => {
  store._resetForTests();
});

function fakeUtility(applicant = "Alex"): UtilityPackage {
  return {
    flow: "utility",
    applicant_name: applicant,
    service_address: "1421 Mission St",
    state_code: "CA",
    tier: "full",
    tier_amount_usd: 670,
    rule_citation: "CA CDSS MPP 63-503.43",
    basis: "api_confirmed",
    utility_accounts_found: [],
    name_match: true,
    intake_responses: {
      state_code: "CA",
      landlord_pays_any: false,
      utilities_paid_by_applicant: {
        heat_gas: true,
        electricity: true,
        cooling: false,
        water: false,
        phone_internet: false,
        none: false,
      },
    },
    generated_at: new Date().toISOString(),
    attestation_required: false,
  };
}

describe("SQLite package store", () => {
  it("saves a package and assigns an id", () => {
    const saved = store.savePackage(fakeUtility(), "Alex Applicant");
    expect(saved.id).toMatch(/^pkg_/);
    expect(saved.applicant_name).toBe("Alex Applicant");
    expect(saved.flow).toBe("utility");
  });

  it("round-trips a complex package through JSON storage", () => {
    const pkg = fakeUtility("Jordan");
    const saved = store.savePackage(pkg, "Jordan Applicant");
    const fetched = store.getPackage(saved.id);
    expect(fetched).toBeDefined();
    expect(fetched!.package.flow).toBe("utility");
    expect(fetched!.package).toEqual(pkg);
  });

  it("returns undefined for an unknown id", () => {
    expect(store.getPackage("pkg_nope")).toBeUndefined();
  });

  it("lists packages newest-first", async () => {
    store.savePackage(fakeUtility("First"), "First");
    await new Promise((r) => setTimeout(r, 5));
    store.savePackage(fakeUtility("Second"), "Second");
    await new Promise((r) => setTimeout(r, 5));
    store.savePackage(fakeUtility("Third"), "Third");
    const list = store.listPackages();
    expect(list.map((p) => p.applicant_name)).toEqual(["Third", "Second", "First"]);
  });

  it("persists across reads (file-backed, not in-memory)", () => {
    const a = store.savePackage(fakeUtility("Persisted"), "Persisted");
    expect(store.getPackage(a.id)?.applicant_name).toBe("Persisted");
    // File should exist on disk.
    expect(fs.existsSync(tmpDb)).toBe(true);
  });
});
