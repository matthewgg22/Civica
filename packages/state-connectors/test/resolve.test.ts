// Tests for the one-shot resolve.byAddress / resolve.byZip helpers (TODO-6).
//
// Exercises the fast path (ZIP table hit), the slow path (Census API
// fallback), the skipFastPath escape hatch, and the error branches.

import { describe, expect, it } from "vitest";
import { byAddress, byZip } from "../src/resolve";
import { makeFakeFetch } from "./helpers/fakeFetch";

describe("resolve.byZip — ZIP fast path only", () => {
  it("resolves an LA ZIP to LA County DPSS in one call", () => {
    const r = byZip("90015", "CA");
    expect(r).toBeDefined();
    expect(r!.county.fips).toBe("06037");
    expect(r!.county.county_name).toBe("Los Angeles County");
    expect(r!.county.source).toBe("zip_table");
    expect(r!.agency.county?.administering_agency.abbreviation).toBe("DPSS");
    expect(r!.agency.fallback_to_state).toBe(false);
  });

  it("resolves a Boston ZIP to Suffolk County with state-level MA agency fallback", () => {
    // MA isn't enumerated at county level → fallback_to_state = true,
    // but state-level agency still resolves.
    const r = byZip("02101", "MA");
    expect(r).toBeDefined();
    expect(r!.county.fips).toBe("25025");
    expect(r!.agency.state.snap_program_name).toBeDefined();
  });

  it("returns undefined for an unseeded ZIP (no Census fallback in byZip)", () => {
    expect(byZip("99950", "CA")).toBeUndefined();
  });

  it("returns undefined when the state has no agency-directory entry", () => {
    // ZIP in fast table resolves county fine, but state code XX has no agency.
    expect(byZip("90015", "XX")).toBeUndefined();
  });
});

describe("resolve.byAddress — fast path", () => {
  it("uses ZIP fast path when ZIP is in the table — no fetch call", async () => {
    let fetchCalls = 0;
    const fetchImpl = (async () => {
      fetchCalls++;
      throw new Error("fetch should not be called when fast path hits");
    }) as unknown as typeof fetch;

    const r = await byAddress(
      { street: "100 Main St", city: "Los Angeles", state: "CA", zip: "90015" },
      { fetchImpl },
    );
    expect(fetchCalls).toBe(0);
    expect(r.county.fips).toBe("06037");
    expect(r.county.source).toBe("zip_table");
    expect(r.agency.county?.administering_agency.abbreviation).toBe("DPSS");
  });
});

describe("resolve.byAddress — Census fallback", () => {
  it("calls the Census geocoder when ZIP is not in the fast table", async () => {
    const r = await byAddress(
      { street: "1100 S Broadway", city: "Los Angeles", state: "CA", zip: "99950" },
      {
        baseUrl: "https://census.test/geo",
        fetchImpl: makeFakeFetch([
          { match: (req) => req.url.startsWith("https://census.test/geo"), fixture: "census/la.json" },
        ]),
      },
    );
    expect(r.county.fips).toBe("06037");
    expect(r.county.source).toBe("census_api");
    expect(r.agency.county?.administering_agency.abbreviation).toBe("DPSS");
  });

  it("skipFastPath forces the Census call even when ZIP is in the table", async () => {
    let fetchCalls = 0;
    const fakeFetch = makeFakeFetch([
      { match: (req) => req.url.startsWith("https://census.test/geo"), fixture: "census/la.json" },
    ]);
    const fetchImpl = (async (...args: Parameters<typeof fetch>) => {
      fetchCalls++;
      return fakeFetch(...args);
    }) as typeof fetch;

    const r = await byAddress(
      { street: "1100 S Broadway", city: "Los Angeles", state: "CA", zip: "90015" },
      { baseUrl: "https://census.test/geo", fetchImpl, skipFastPath: true },
    );
    expect(fetchCalls).toBe(1);
    expect(r.county.source).toBe("census_api");
  });
});

describe("resolve.byAddress — error branches", () => {
  it("throws when neither fast path nor Census API resolves the county", async () => {
    await expect(
      byAddress(
        { street: "nowhere", city: "nowhere", state: "CA", zip: "99950" },
        {
          baseUrl: "https://census.test/geo",
          // Census returns 200 with no matches — common when the geocoder
          // can't find the address.
          fetchImpl: makeFakeFetch([
            {
              match: (req) => req.url.startsWith("https://census.test/geo"),
              fixture: "census/no-match.json",
            },
          ]),
        },
      ),
    ).rejects.toThrow(/could not resolve county/);
  });
});
