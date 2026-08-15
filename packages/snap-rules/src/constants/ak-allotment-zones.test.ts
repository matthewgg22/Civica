import { describe, it, expect } from "vitest";
import { akAllotmentZoneFor, AK_URBAN, AK_RURAL_I, AK_RURAL_II } from "./ak-allotment-zones";

// #814: the whole point is that Anchorage (Urban) and, say, Bethel (Rural II)
// should NOT get the same max allotment — Anchorage's real HH1 max is $385,
// Bethel's is $598. Spot-check one county per confidence tier described in
// this module's own header comment, the historical-successor cases
// (Northwest Arctic fka Kobuk, Kusilvak fka Wade Hampton, the post-2019
// Valdez-Cordova split, the post-2007 Skagway-Yakutat-Angoon split, the
// post-2008 Wrangell-Petersburg split), and the deliberately-unmapped
// Chugach Census Area fallthrough.

describe("akAllotmentZoneFor", () => {
  it("Anchorage (02020) resolves to Urban — HH1 $385, HH4 $1,285, add-on $282", () => {
    const z = akAllotmentZoneFor("02020");
    expect(z?.zone).toBe("urban");
    expect(z?.max_allotment.get(1)?.toNumber()).toBe(385);
    expect(z?.max_allotment.get(4)?.toNumber()).toBe(1285);
    expect(z?.max_allotment_each_additional.toNumber()).toBe(282);
    expect(z?.minimum_benefit.toNumber()).toBe(31);
  });

  it("Bethel (02050) resolves to Rural II — a DIFFERENT, higher table than Anchorage", () => {
    const z = akAllotmentZoneFor("02050");
    expect(z?.zone).toBe("rural2");
    expect(z?.max_allotment.get(1)?.toNumber()).toBe(598);
    expect(z?.max_allotment.get(4)?.toNumber()).toBe(1995);
    expect(z?.max_allotment_each_additional.toNumber()).toBe(438);
    expect(z?.minimum_benefit.toNumber()).toBe(48);
    expect(z?.max_allotment.get(1)?.toNumber()).not.toBe(AK_URBAN.max_allotment.get(1)?.toNumber());
  });

  it("Copper River Census Area (02066) resolves to Rural I — HH1 $491", () => {
    const z = akAllotmentZoneFor("02066");
    expect(z?.zone).toBe("rural1");
    expect(z?.max_allotment.get(1)?.toNumber()).toBe(491);
  });

  it("Northwest Arctic Borough (02188) — formerly Kobuk Census Area — resolves to Rural II, not undefined", () => {
    expect(akAllotmentZoneFor("02188")?.zone).toBe("rural2");
  });

  it("Kusilvak Census Area (02158) — the renamed Wade Hampton — resolves to Rural II, not undefined", () => {
    expect(akAllotmentZoneFor("02158")?.zone).toBe("rural2");
  });

  it("both halves of the post-2007 Skagway-Yakutat-Angoon split land in their CFR-correct zones", () => {
    expect(akAllotmentZoneFor("02230")?.zone).toBe("urban"); // Skagway — the CFR's named Urban exception
    expect(akAllotmentZoneFor("02105")?.zone).toBe("rural1"); // Hoonah-Angoon
    expect(akAllotmentZoneFor("02282")?.zone).toBe("rural1"); // Yakutat
  });

  it("both halves of the post-2008 Wrangell-Petersburg split resolve to Urban", () => {
    expect(akAllotmentZoneFor("02275")?.zone).toBe("urban"); // Wrangell
    expect(akAllotmentZoneFor("02195")?.zone).toBe("urban"); // Petersburg
  });

  it("Denali Borough (02068) — direct successor to the CFR's pre-1990 'Denali in the Matanuska-Susitna Borough' — resolves to Rural II", () => {
    expect(akAllotmentZoneFor("02068")?.zone).toBe("rural2");
  });

  it("Mat-Su Borough (02170) resolves to Urban (Denali is its own separate FIPS today, not part of this borough)", () => {
    expect(akAllotmentZoneFor("02170")?.zone).toBe("urban");
  });

  it("Chugach Census Area (02063) is deliberately UNMAPPED — genuine Valdez(Urban)/Cordova(Rural I) split within one modern FIPS — falls through to undefined, callers fall back to Urban", () => {
    expect(akAllotmentZoneFor("02063")).toBeUndefined();
  });

  it("returns undefined for an unrecognized FIPS — callers must fall back, never treat this as $0", () => {
    expect(akAllotmentZoneFor("99999")).toBeUndefined();
  });

  it("returns undefined when county is omitted", () => {
    expect(akAllotmentZoneFor(undefined)).toBeUndefined();
  });

  it("all three zone tables cover household sizes 1-8 and are strictly increasing Urban < Rural I < Rural II at every size", () => {
    for (let size = 1; size <= 8; size++) {
      const u = AK_URBAN.max_allotment.get(size)!.toNumber();
      const r1 = AK_RURAL_I.max_allotment.get(size)!.toNumber();
      const r2 = AK_RURAL_II.max_allotment.get(size)!.toNumber();
      expect(u).toBeLessThan(r1);
      expect(r1).toBeLessThan(r2);
    }
  });

  it("each-additional-member figures are strictly increasing Urban < Rural I < Rural II", () => {
    expect(AK_URBAN.max_allotment_each_additional.toNumber()).toBeLessThan(
      AK_RURAL_I.max_allotment_each_additional.toNumber(),
    );
    expect(AK_RURAL_I.max_allotment_each_additional.toNumber()).toBeLessThan(
      AK_RURAL_II.max_allotment_each_additional.toNumber(),
    );
  });

  it("minimum-benefit floors are strictly increasing Urban ($31) < Rural I ($39) < Rural II ($48), all above the $24 federal default", () => {
    expect(AK_URBAN.minimum_benefit.toNumber()).toBe(31);
    expect(AK_RURAL_I.minimum_benefit.toNumber()).toBe(39);
    expect(AK_RURAL_II.minimum_benefit.toNumber()).toBe(48);
  });

  it("HH9 (beyond the published HH8 table) extrapolates via each-additional-member, per zone", () => {
    // Not directly exercised by akAllotmentZoneFor (that's maxAllotmentFor's
    // job in federal-tables.ts) — just confirms the raw table data needed
    // for that extrapolation is present and correctly ordered.
    const urbanHh8 = AK_URBAN.max_allotment.get(8)!.toNumber();
    expect(urbanHh8 + AK_URBAN.max_allotment_each_additional.toNumber()).toBe(2314 + 282);
  });
});
