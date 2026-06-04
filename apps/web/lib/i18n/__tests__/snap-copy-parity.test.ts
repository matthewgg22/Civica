// Parity test mirroring iOS's EBTStringParityTests. Every key present in
// `en` must exist in `es` and vice versa; the values must be non-empty.
// CI fails if either condition breaks — caught before the dashboard /
// staff team finds Spanish gaps in QA.

import { describe, it, expect } from "vitest";
import { snapStrings } from "../snap-copy";

describe("snap-copy parity", () => {
  it("every English key has a Spanish counterpart", () => {
    const enKeys = Object.keys(snapStrings.en).sort();
    const esKeys = Object.keys(snapStrings.es).sort();
    expect(esKeys).toEqual(enKeys);
  });

  it("every Spanish value is non-empty", () => {
    for (const [key, value] of Object.entries(snapStrings.es)) {
      expect(value, `es:${key} is empty`).toBeTruthy();
      expect(value.trim().length, `es:${key} is whitespace`).toBeGreaterThan(0);
    }
  });

  it("every English value is non-empty", () => {
    for (const [key, value] of Object.entries(snapStrings.en)) {
      expect(value, `en:${key} is empty`).toBeTruthy();
      expect(value.trim().length, `en:${key} is whitespace`).toBeGreaterThan(0);
    }
  });

  it("en and es differ for at least 80% of keys (not just stub-copied)", () => {
    const total = Object.keys(snapStrings.en).length;
    let same = 0;
    for (const key of Object.keys(snapStrings.en) as (keyof typeof snapStrings.en)[]) {
      if (snapStrings.en[key] === snapStrings.es[key]) same += 1;
    }
    const ratio = same / total;
    // A few keys (placeholders, IDs) can legitimately be identical, but if
    // we ever bulk-copy en into es by mistake, this catches it.
    expect(ratio).toBeLessThan(0.2);
  });
});
