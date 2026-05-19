import { describe, expect, it } from "vitest";
import { lookup, listSupportedStates, getStateRecord } from "../src/agency-directory/lookup";

describe("agencyDirectory.lookup", () => {
  it("returns the LA County DPSS for CA / 06037", () => {
    const r = lookup({ stateCode: "CA", countyFips: "06037" });
    expect(r?.fallback_to_state).toBe(false);
    expect(r?.county?.administering_agency.abbreviation).toBe("DPSS");
    expect(r?.state.snap_program_name).toBe("CalFresh");
  });

  it("falls back to state when county is not enumerated", () => {
    const r = lookup({ stateCode: "CA", countyFips: "06999" });
    expect(r?.fallback_to_state).toBe(true);
    expect(r?.county).toBeUndefined();
    expect(r?.state.abbreviation).toBe("CDSS");
  });

  it("returns DTA (state agency) for any MA county", () => {
    const r = lookup({ stateCode: "MA", countyFips: "25025" });
    expect(r?.county?.administering_agency.abbreviation).toBe("DTA");
  });

  it("handles lowercase state codes", () => {
    expect(lookup({ stateCode: "ca", countyFips: "06037" })?.county?.fips).toBe("06037");
  });

  it("returns a stub state entry for non-launch states", () => {
    const r = lookup({ stateCode: "NY" });
    expect(r?.fallback_to_state).toBe(true);
    expect(r?.state.name).toContain("New York");
  });

  it("returns undefined for an unknown state code", () => {
    expect(lookup({ stateCode: "ZZ" })).toBeUndefined();
  });

  it("listSupportedStates returns only fully-populated states", () => {
    expect(listSupportedStates()).toEqual(["CA", "MA"]);
  });

  it("getStateRecord exposes the raw record", () => {
    expect(getStateRecord("CA")?.counties.length).toBeGreaterThanOrEqual(10);
    expect(getStateRecord("FL")?.populated).toBe(false);
  });
});
