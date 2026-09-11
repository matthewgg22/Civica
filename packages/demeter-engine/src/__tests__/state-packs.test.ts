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

  it("carries the seven Wave-0 topics in order, plus the FOIA-batch-2 additions", () => {
    expect(ca.topics.map((t) => t.key)).toEqual([
      // The seven originally hardcoded in retrieval.ts, in their original order.
      "ebt-operational",
      "eligible-foods",
      "abawd-current-rules",
      "verification-limits",
      "cf886-decoder",
      "qc-element-glossary",
      "negative-action-validity",
      // Batch 2 (USDA FOIA 2026-FNS-04753-F integration): the two highest-volume
      // real-world question types the corpus lacked an answer-facing entry for.
      "household-composition",
      "benefit-amount-proration",
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

  // Niche corner cases integrated from the USDA FOIA 2026-FNS-04753-F audit.
  // Each is a place a general answer goes wrong; pin the load-bearing phrase so a
  // future edit to these long entries can't silently drop the fix.
  it("carries the FOIA-derived niche corner cases", () => {
    const abawd = ca.topics.find((t) => t.key === "abawd-current-rules")!;
    // The 60-64 "triple status" tangle and the Social-Security distinction.
    expect(abawd.text).toContain("AGE 60-64");
    expect(abawd.text).toContain("Social Security RETIREMENT or SURVIVOR benefits alone do not");
    // The 12-vs-14 look-alike child-age cutoff must be flagged in-entry.
    expect(abawd.text).toContain("under 12");
    // Stolen-EBT: California requires no police report to replace stolen benefits.
    const ebt = ca.topics.find((t) => t.key === "ebt-operational")!;
    expect(ebt.text).toContain("does NOT require a police report");
    // The official self-service portal (answers the "which app is safe?" cluster).
    expect(ebt.text).toContain("ebtEDGE");
    // Deductible-expense denial remedy, anchored to the corpus-known federal cite.
    const verif = ca.topics.find((t) => t.key === "verification-limits")!;
    expect(verif.text).toContain("273.12(a)(4)(v)");
    expect(verif.text).toContain("WITHOUT that deduction");
  });

  // Batch 2: the two highest-volume real-world question types (household
  // composition; benefit amount / proration) — sourced from the eCFR corpus.
  it("carries the batch-2 household-composition and proration entries", () => {
    const hh = ca.topics.find((t) => t.key === "household-composition")!;
    // The purchase-and-prepare test and the under-22 mandatory-household rule.
    expect(hh.text).toContain("BUY and PREPARE");
    expect(hh.text).toContain("UNDER 22");
    const ben = ca.topics.find((t) => t.key === "benefit-amount-proration")!;
    // First-month proration + benefits restored back to the application date.
    expect(ben.text).toContain("273.10(a)(1)(ii)");
    expect(ben.text).toContain("RESTORED");
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

import { VERIFIED_STATES } from "../packs";

describe("pack verification metadata (public /verify + guide pages)", () => {
  it("every verified pack carries a complete verification block", () => {
    expect(VERIFIED_STATES.length).toBeGreaterThanOrEqual(4);
    for (const s of VERIFIED_STATES) {
      expect(s.verification.verified_on, s.code).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(s.verification.method.length, s.code).toBeGreaterThan(40);
      expect(s.verification.gates.length, s.code).toBeGreaterThan(40);
      expect(s.verification.sources.length, s.code).toBeGreaterThanOrEqual(3);
    }
  });
});

// #761: the raw `program`/`agency` fields are model-facing and deliberately
// carry corpus annotation behind an em-dash (see packs.ts) — 25 packs run past
// 130 chars. What broke reflow in the issue was the UI rendering those raw;
// SnapOverview's agency list, the state picker and the guide pages render
// programShort/agencyShort now, which is what resolved it. So the durable guard
// belongs on the fields that actually reach a 320px card: a future pack author
// pasting a naming essay into program_short — the exact drift that happened to
// `program` — fails here, the fast direct signal the issue asked for instead of
// only the slow e2e reflow spec noticing an overflow.
describe("display names stay short enough for the agency card (#761)", () => {
  it("every pack's programShort/agencyShort is a display name, not research prose", () => {
    for (const s of VERIFIED_STATES) {
      expect(s.programShort.length, `${s.code} programShort is empty`).toBeGreaterThan(0);
      expect(
        s.programShort.length,
        `${s.code} programShort too long for the card (${s.programShort.length}): ${JSON.stringify(s.programShort)} — put the annotation in program/PROVENANCE, not the display name`,
      ).toBeLessThanOrEqual(60);
      expect(s.agencyShort.length, `${s.code} agencyShort is empty`).toBeGreaterThan(0);
      expect(
        s.agencyShort.length,
        `${s.code} agencyShort too long for the card (${s.agencyShort.length}): ${JSON.stringify(s.agencyShort)}`,
      ).toBeLessThanOrEqual(80);
    }
  });
});


describe("recompose marker", () => {
  it("the client-safe copy is byte-identical to what the stream emits", async () => {
    const { RECOMPOSE_MARKER } = await import("../packs");
    const { STREAM_RECOMPOSE_MARKER } = await import("../orchestrator");
    // Chat UIs slice on this exact string. The two components used to hardcode
    // a version WITHOUT the surrounding newlines and only worked because
    // lastIndexOf still matched the substring — a silent trap.
    expect(RECOMPOSE_MARKER).toBe(STREAM_RECOMPOSE_MARKER);
  });
});
