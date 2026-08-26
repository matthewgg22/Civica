// /verify may not print our own provenance.
//
// The page once rendered, for all 53 states at once: every primary source by
// name, the pipeline that built each pack, the corrections its refute gate
// caught, and a live grounded-rate readout above them. That is not evidence of
// care, it is a build sheet — and it buried the one thing a reader comes to
// this page for, which is their own state's agency and application link.
//
// The page is now a state directory and prints NONE of it. These tests pin
// that boundary, because the natural direction of drift is to add "just one
// more" reassuring detail back, one release at a time.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { VERIFIED_STATES } from "@civica/demeter-engine/packs";
import { publicVerification } from "../lib/verification-summary";

const PAGE = readFileSync(new URL("../app/verify/page.tsx", import.meta.url), "utf8");

describe("the page renders no provenance at all", () => {
  // Cheap and blunt on purpose: the failure mode is someone re-adding
  // `.verification.sources.map(...)` to the JSX, not a derivation changing.
  it("never reaches into a pack's verification block", () => {
    expect(PAGE).not.toMatch(/verification\.sources/);
    expect(PAGE).not.toMatch(/verification\.method/);
    expect(PAGE).not.toMatch(/verification\.gates/);
    expect(PAGE).not.toMatch(/verification\.verified_on/);
    expect(PAGE).not.toMatch(/publicVerification/);
  });

  it("carries no measured-certainty readout", () => {
    // The grounded rate is a real number and still worth having; a directory
    // of state agencies is not where it belongs, and it made the page ISR for
    // content that never changes between deploys.
    expect(PAGE).not.toMatch(/certaintyStats/);
    expect(PAGE).not.toMatch(/export const revalidate/);
  });
});

// publicVerification is what /verify used to render through. Nothing renders
// through it today, but its assertions are really about the PACKS — every one
// carries sources, and a corrections count is parsed rather than guessed — so
// they stay as a data check regardless of which page displays what.
describe("the public summary counts sources without naming them", () => {
  it("reports a real count for every state", () => {
    for (const pack of VERIFIED_STATES) {
      const v = publicVerification(pack);
      expect(v.sourceCount, `${pack.code}`).toBe(pack.verification.sources.length);
      expect(v.sourceCount, `${pack.code} has no sources to count`).toBeGreaterThan(0);
    }
  });

  it("carries no source text — only the number", () => {
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
