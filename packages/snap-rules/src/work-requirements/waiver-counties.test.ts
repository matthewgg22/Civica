import { describe, it, expect } from "vitest";
import { waiverCountiesFor, CA_WAIVER_COUNTY_FIPS, MA_WAIVER_COUNTY_FIPS } from "./waiver-counties";

// #614: waiverCountiesFor's whole point is distinguishing "no county data
// authored for this state" (undefined) from "we checked, this state
// genuinely holds no waiver anywhere" (an empty Set, MA) — a caller that
// conflated the two would silently fall back to the wrong default for MA.

describe("waiverCountiesFor", () => {
  it("returns CA's real 7-county set", () => {
    const s = waiverCountiesFor("CA");
    expect(s).toBe(CA_WAIVER_COUNTY_FIPS);
    expect(s?.size).toBe(7);
  });

  it("returns MA's empty set — NOT undefined — MA genuinely holds no waiver", () => {
    const s = waiverCountiesFor("MA");
    expect(s).toBe(MA_WAIVER_COUNTY_FIPS);
    expect(s).toBeDefined();
    expect(s?.size).toBe(0);
  });

  it("returns undefined for a state with no county data authored (TX)", () => {
    expect(waiverCountiesFor("TX")).toBeUndefined();
  });

  it("returns undefined for an unregistered/unknown state", () => {
    expect(waiverCountiesFor("ZZ")).toBeUndefined();
  });

  it("returns undefined when state is omitted", () => {
    expect(waiverCountiesFor(undefined)).toBeUndefined();
  });
});
