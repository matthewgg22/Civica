import { describe, expect, it } from "vitest";
import { fromAddress, fromZipFast } from "../src/fips/resolver.js";
import { makeFakeFetch } from "./helpers/fakeFetch.js";

describe("fips.fromZipFast", () => {
  it("resolves an LA ZIP to Los Angeles County FIPS 06037", () => {
    const r = fromZipFast("90015");
    expect(r).toEqual({
      fips: "06037",
      state_fips: "06",
      county_fips: "037",
      county_name: "Los Angeles County",
      source: "zip_table",
    });
  });

  it("resolves a Boston ZIP to Suffolk County FIPS 25025", () => {
    const r = fromZipFast("02115");
    expect(r?.fips).toBe("25025");
    expect(r?.county_name).toBe("Suffolk County");
  });

  it("returns undefined for an unseeded ZIP", () => {
    expect(fromZipFast("99950")).toBeUndefined();
  });

  it("ignores +4 extension", () => {
    expect(fromZipFast("90015-2353")?.fips).toBe("06037");
  });
});

describe("fips.fromAddress", () => {
  it("parses Census geocoder response into CountyResult", async () => {
    const r = await fromAddress(
      { street: "1100 S Broadway", city: "Los Angeles", state: "CA", zip: "90015" },
      {
        baseUrl: "https://census.test/geo",
        fetchImpl: makeFakeFetch([
          { match: (req) => req.url.startsWith("https://census.test/geo"), fixture: "census/la.json" },
        ]),
      },
    );
    expect(r).toEqual({
      fips: "06037",
      state_fips: "06",
      county_fips: "037",
      county_name: "Los Angeles County",
      source: "census_api",
    });
  });

  it("returns undefined when Census has no match", async () => {
    const r = await fromAddress(
      { street: "X", city: "Y", state: "ZZ", zip: "00000" },
      {
        baseUrl: "https://census.test/geo",
        fetchImpl: (async () =>
          new Response(JSON.stringify({ result: { addressMatches: [] } }), {
            status: 200,
            headers: { "content-type": "application/json" },
          })) as unknown as typeof fetch,
      },
    );
    expect(r).toBeUndefined();
  });
});
