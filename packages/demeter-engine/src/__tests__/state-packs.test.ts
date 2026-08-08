// State-pack registry integrity (Wave 0, docs/plans/mae-state-corpus-framework.md).
//
// Two jobs: (1) hold every registered pack to the structural gates the
// framework demands, so a malformed pack fails CI rather than silently
// degrading retrieval; (2) pin the Wave-0 refactor contract — the CA pack must
// carry EXACTLY the content that used to be hardcoded in retrieval.ts /
// citation-verifier.ts / freshness.ts, and unknown states must degrade to
// federal-only rather than throwing.

import { describe, it, expect } from "vitest";
import { getStatePack, registeredStates, DEFAULT_STATE } from "../states";

describe("state-pack registry", () => {
  it("registers CA and defaults to it", () => {
    expect(registeredStates()).toContain("CA");
    expect(DEFAULT_STATE).toBe("CA");
    expect(getStatePack(undefined)?.code).toBe("CA");
    // null = EXPLICIT federal floor (eng review T-C): an anonymous public user
    // with no state selected must never inherit California supplements.
    expect(getStatePack(null)).toBeNull();
  });

  it("is case-insensitive and degrades unknown states to null (federal-only), never throwing", () => {
    expect(getStatePack("ca")?.code).toBe("CA");
    expect(getStatePack("ZZ")).toBeNull();
    expect(getStatePack("not-a-state")).toBeNull();
  });

  it("every registered pack passes the structural gates", () => {
    for (const code of registeredStates()) {
      const pack = getStatePack(code)!;
      expect(pack.program.length).toBeGreaterThan(0);
      expect(pack.agency.length).toBeGreaterThan(0);
      expect(["state", "county"]).toContain(pack.admin_model);
      // County-administered packs must warn that practice varies locally.
      if (pack.admin_model === "county") {
        expect(pack.admin_note, `${code} county pack needs admin_note`).toBeTruthy();
      }
      expect(pack.update_channels.length).toBeGreaterThan(0);

      for (const t of pack.topics) {
        expect(t.terms.length, `${code}/${t.key} needs trigger terms`).toBeGreaterThan(0);
        expect(t.citation.length, `${code}/${t.key} needs a citation`).toBeGreaterThan(0);
        expect(t.text.length, `${code}/${t.key} text suspiciously short`).toBeGreaterThan(100);
        expect(t.source_url).toMatch(/^https:\/\//);
        expect(["supplement", "external"]).toContain(t.kind);
      }

      for (const p of pack.authorities) {
        expect(p.compiled).toBeInstanceOf(RegExp);
        expect(p.known.size, `${code}/${p.key} has an empty known set`).toBeGreaterThan(0);
        // The display template must render a real match to a known value —
        // otherwise the verifier flags the pack's own citations (the #589 bug).
        expect(p.template).toMatch(/\$\d/);
      }

      for (const f of pack.freshness) {
        expect(Number.isFinite(Date.parse(f.date)), `${code}/${f.key} bad date`).toBe(true);
        expect(f.warning.length).toBeGreaterThan(20);
      }
    }
  });
});

describe("CA pack — Wave-0 extraction fidelity", () => {
  const ca = getStatePack("CA")!;

  it("carries the seven formerly-hardcoded topics in original iteration order", () => {
    expect(ca.topics.map((t) => t.key)).toEqual([
      "ebt-operational",
      "eligible-foods",
      "abawd-current-rules",
      "verification-limits",
      "cf886-decoder",
      "qc-element-glossary",
      "negative-action-validity",
    ]);
  });

  it("preserves the load-bearing corrected facts (the #589/#593 lineage)", () => {
    const abawd = ca.topics.find((t) => t.key === "abawd-current-rules")!;
    // The CA fixed 36-month clock ended 2025-12-31 — the highest-severity fact.
    expect(abawd.text).toContain("2025-12-31");
    const verif = ca.topics.find((t) => t.key === "verification-limits")!;
    // Re-anchored authorities, NOT the retired ACL 21-58 anchor.
    expect(verif.citation).toContain("MPP 63-300");
    expect(verif.citation).not.toContain("ACL 21-58");
    const validity = ca.topics.find((t) => t.key === "negative-action-validity")!;
    // The #593 correction: FNS 310 has no language-of-issuance rule.
    expect(validity.text).toContain("CALIFORNIA law");
  });

  it("carries the ACL/ACIN + MPP authority sets at their pre-refactor sizes", () => {
    const acl = ca.authorities.find((p) => p.key === "acl")!;
    const mpp = ca.authorities.find((p) => p.key === "mpp")!;
    expect(acl.known.size).toBe(15);
    expect(mpp.known.size).toBe(15);
    expect(acl.known.has("ACL 20-48")).toBe(true);
    expect(mpp.known.has("MPP 63-300")).toBe(true);
  });

  it("keeps the CA ABAWD supersession addendum for 273.24", () => {
    expect(ca.supersessions?.["273.24"]).toContain("2026-06-01");
    expect(ca.supersessions?.["273.24"]).toContain("ACL 25-93");
  });

  it("keeps both CA freshness dates with their original semantics", () => {
    const byKey = Object.fromEntries(ca.freshness.map((f) => [f.key, f]));
    expect(byKey["ca-abawd-waiver-window"]!.kind).toBe("expires");
    expect(byKey["ca-abawd-waiver-window"]!.date).toBe("2026-10-31");
    expect(byKey["ca-abawd-effective"]!.kind).toBe("not-yet-effective");
    expect(byKey["ca-abawd-effective"]!.date).toBe("2026-06-01");
  });
});
