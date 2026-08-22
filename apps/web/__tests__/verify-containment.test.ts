// /verify must support the claim without handing over the work.
//
// The page used to print, for all fourteen states at once: every primary source
// by name, the pipeline that built each pack, and the specific corrections its
// refute gate caught. That is not evidence of care, it is a build sheet. These
// tests pin the boundary, because the natural direction of drift is to add
// "just one more" reassuring detail back.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { VERIFIED_STATES } from "@civica/demeter-engine/packs";
import { publicVerification } from "../lib/verification-summary";

const PAGE = readFileSync(new URL("../app/verify/page.tsx", import.meta.url), "utf8");

describe("the public summary counts sources without naming them", () => {
  it("reports a real count for every state", () => {
    for (const pack of VERIFIED_STATES) {
      const v = publicVerification(pack);
      expect(v.sourceCount, `${pack.code}`).toBe(pack.verification.sources.length);
      expect(v.sourceCount, `${pack.code} has no sources to count`).toBeGreaterThan(0);
    }
  });

  it("carries no source text — only the number", () => {
    // The whole point: a count is not a citation you can harvest.
    for (const pack of VERIFIED_STATES) {
      const serialized = JSON.stringify(publicVerification(pack));
      for (const src of pack.verification.sources) {
        expect(serialized, `${pack.code} leaked "${src}"`).not.toContain(src);
      }
      expect(serialized, `${pack.code} leaked its method`).not.toContain(
        pack.verification.method,
      );
    }
  });

  it("counts corrections when stated, and never invents one when not", () => {
    const wa = VERIFIED_STATES.find((s) => s.code === "WA")!;
    expect(wa.verification.gates).toMatch(/must-fix/);
    expect(publicVerification(wa).corrections).toBe(7);

    const ca = VERIFIED_STATES.find((s) => s.code === "CA")!;
    expect(ca.verification.gates).not.toMatch(/must-fix/);
    expect(publicVerification(ca).corrections).toBeNull();
  });
});

describe("the page does not route around the summary", () => {
  // Cheap and blunt on purpose: the failure mode is someone re-adding
  // `.sources.map(...)` to the JSX, not the derivation changing.
  it("never renders verification.sources, .method or .gates directly", () => {
    expect(PAGE).not.toMatch(/verification\.sources/);
    expect(PAGE).not.toMatch(/verification\.method/);
    expect(PAGE).not.toMatch(/verification\.gates/);
  });

  it("still says where the sources DO appear", () => {
    // Withholding the list is only defensible because the citations are in the
    // answers. If that sentence goes, the page is just hiding things.
    expect(PAGE).toMatch(/names the specific rule it used/);
  });
});
