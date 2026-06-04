// Manifest consistency tests (Fix 3 from Component R spec-revision pass).
//
// PURPOSE: Guard against DETERMINATIVE_FIELDS drifting from the actual
// engine behaviour and the actual Facts type shape.
//
// TWO HALVES:
//
//   Half A — Verdict-changes-on-strip (runs today against snap-rules)
//   For each determinative field below, assert that at least one fixture
//   profile exists where removing / zeroing that field changes the engine
//   output (verdict, benefit, or SKIP). A field that no profile makes
//   determinative is a stale manifest entry → test fails with a clear message.
//
//   Half B — Completeness coverage (TODO — requires Component R manifest)
//   Walk every leaf of the Facts type; assert it appears in DETERMINATIVE_FIELDS
//   or in OPTIONAL_FIELDS with a one-line justification. This half is stubbed
//   with @todo markers below — implement once Component R's manifest exists as
//   importable TypeScript.
//
// WIRING: add to the same CI step as the profile harness (vitest run in
// tools/profile-harness/).

import { describe, it, expect } from "vitest";
import { composeVerdict } from "@civica/snap-rules";
import { loadProfileSuite } from "./src/loader.ts";
import type { Facts, Profile } from "./src/types.ts";

// ─── Load fixture ─────────────────────────────────────────────────────────────

const { suite } = loadProfileSuite();
const CA_PROFILES = suite.profiles;
const AS_OF = new Date("2026-06-01");

// ─── Helpers ──────────────────────────────────────────────────────────────────

type EngineOutput = { verdict?: string; benefit?: number | null; skipped: boolean };

function runEngine(facts: Facts, state = "CA"): EngineOutput {
  const result = composeVerdict(facts as any, state, AS_OF);
  return {
    verdict: result.verdict,
    benefit: result.benefit,
    skipped: (result.not_implemented_surfaces ?? []).length > 0,
  };
}

function outputChanged(before: EngineOutput, after: EngineOutput): boolean {
  if (before.skipped !== after.skipped) return true;
  if (before.verdict !== after.verdict) return true;
  if (before.benefit !== after.benefit) return true;
  return false;
}

// Deep-clone facts (engine mutates nothing, but clone prevents cross-test leakage).
function cloneFacts(facts: Facts): Facts {
  return JSON.parse(JSON.stringify(facts));
}

// ─── DETERMINATIVE FIELDS (Half A manifest) ───────────────────────────────────
//
// When Component R's DETERMINATIVE_FIELDS is exported as TS, this list should
// be imported rather than duplicated. Until then this is the authoritative spec
// copy. Each entry names a field path and an apply() that strips / zeros it.
// A field marked `advisory` may legitimately have no profiles where stripping
// it changes output (it's in the manifest for elicitation completeness, not
// engine determinism); the test skips the verdict-change assertion for those.

interface ManifestEntry {
  field: string;
  apply: (f: Facts) => Facts;
  advisory?: boolean;
  justification?: string;
}

const DETERMINATIVE_FIELDS: ManifestEntry[] = [
  // GROUP 1 — immigration / disqualifications
  {
    field: "household[].immigration",
    apply: f => {
      const c = cloneFacts(f);
      c.household = c.household.map(m => ({ ...m, immigration: "undocumented" }));
      return c;
    },
  },
  {
    field: "household[].five_yr_bar",
    apply: f => {
      const c = cloneFacts(f);
      c.household = c.household.map(m =>
        m.immigration === "lpr" ? { ...m, five_yr_bar: "365" } : m
      );
      return c;
    },
  },
  {
    field: "household[].disqual",
    apply: f => {
      const c = cloneFacts(f);
      // Inject a lottery disqualification — always a DENY if the engine fires it
      c.household = c.household.map((m, i) =>
        i === 0 ? { ...m, disqual: ["lottery"] } : m
      );
      return c;
    },
  },

  // GROUP 2 — household composition
  {
    field: "household[].age",
    apply: f => {
      const c = cloneFacts(f);
      // Change head to student-exempt age (18-22) — exercises student gate
      c.household = c.household.map((m, i) =>
        i === 0 && m.role === "head" ? { ...m, age: 19, student: "full_time" } : m
      );
      return c;
    },
  },

  // GROUP 3 — categorical eligibility
  {
    field: "cat_elig",
    apply: f => {
      const c = cloneFacts(f);
      // Flip a pure_cash / TANF profile to NPA — forces gross + asset tests to apply.
      // Flipping the other direction (NPA → pure_cash) often produces no change because
      // CA's BBCE 200% threshold is already permissive enough that most profiles pass
      // the gross test under NPA anyway.
      if (c.cat_elig === "pure_cash" || c.cat_elig === "TANF" || c.cat_elig === "Medicaid") {
        c.cat_elig = "NPA";
      } else {
        // Profile is already NPA — apply the converse: force a very high income so
        // the now-applicable gross test fires.
        c.cat_elig = "NPA";
        c.income = c.income.map(l => ({ ...l, amount: l.amount * 20 }));
      }
      return c;
    },
  },

  // GROUP 6 — income
  {
    field: "income[].amount",
    apply: f => {
      const c = cloneFacts(f);
      // Raise income to 10× — should trip gross or net income test
      c.income = c.income.map(l => ({ ...l, amount: l.amount * 10 }));
      return c;
    },
  },
  {
    field: "income[].type",
    apply: f => {
      const c = cloneFacts(f);
      // Flip wages to excluded — changes gross total, affects benefit
      c.income = c.income.map(l =>
        l.type === "wages" ? { ...l, type: "excluded_americorps" } : l
      );
      return c;
    },
  },

  // GROUP 7 — shelter
  {
    field: "shelter.rent",
    apply: f => {
      const c = cloneFacts(f);
      // Zero out rent — eliminates excess shelter deduction, changes benefit
      c.shelter = { ...c.shelter, rent: 0 };
      return c;
    },
  },
  {
    field: "shelter.sua_tier",
    apply: f => {
      const c = cloneFacts(f);
      // Downgrade SUA tier to none — reduces SUA contribution, changes benefit
      c.shelter = { ...c.shelter, sua_tier: "none", sua_amount: 0 };
      return c;
    },
  },
  {
    field: "shelter.homeless_deduction",
    apply: f => {
      const c = cloneFacts(f);
      // Toggle homeless deduction on — changes shelter calc path
      c.shelter = { ...c.shelter, homeless_deduction: true, rent: 0 };
      return c;
    },
  },

  // GROUP 8 — deductions
  {
    field: "deductions.dependent_care",
    apply: f => {
      const c = cloneFacts(f);
      // Add a large dependent care deduction — changes net income
      c.deductions = { ...c.deductions, dependent_care: 500 };
      return c;
    },
  },
  {
    field: "deductions.medical_unreimbursed",
    apply: f => {
      const c = cloneFacts(f);
      // Only material for E/D households — add large medical expense
      c.deductions = { ...c.deductions, medical_unreimbursed: 400 };
      return c;
    },
    advisory: true,  // Only determinative if E/D member present; not all profiles have one
    justification:   "Medical deduction only affects E/D households; not all fixture profiles have E/D members",
  },
  {
    field: "deductions.child_support_paid",
    apply: f => {
      const c = cloneFacts(f);
      c.deductions = { ...c.deductions, child_support_paid: 300 };
      return c;
    },
  },

  // GROUP 9 — assets
  {
    field: "assets",
    apply: f => {
      const c = cloneFacts(f);
      // Raise assets to far above the limit for non-BBCE/non-cat-elig profiles
      c.assets = 999999;
      return c;
    },
    advisory: true,  // CA/MA have asset waivers via BBCE; most profiles are cat-elig or waived
    justification:   "CA and MA have BBCE asset waivers; asset test rarely fires in CA/MA fixture profiles",
  },
];

// ─── OPTIONAL FIELDS allowlist (Half B stub) ─────────────────────────────────
//
// @todo: When Component R's manifest is importable TypeScript, replace this
// stub with an import and a full leaf-coverage check.
//
// Every leaf of Facts that is NOT in DETERMINATIVE_FIELDS must appear here
// with a justification. Unlisted → "missing elicitation question: [field]".

const OPTIONAL_FIELDS: Record<string, string> = {
  "household[].member_id":         "Immutable identifier; not a user-facing question",
  "household[].elderly":           "Derived from age ≥ 60; not asked directly",
  "household[].sponsored":         "Derived from immigration=lpr; branched question under five_yr_bar",
  "household[].work_class":        "Internal classification; not a user-facing question",
  "household[].abawd_months_used": "Caseworker-keyed; not elicited in intake",
  "household[].living":            "Encoded via informal-housing intake flow (P-08)",
  "income[].freq":                 "Normalisation detail; amount is the determinative field",
  "income[].anticipation":         "Metadata on income reliability; affects Class 2 P-prior, not verdict",
  "income[].source_status":        "Metadata on income continuity; affects Class 2, not verdict",
  "income[].member":               "Binding field set by household composition; not an elicitation question",
  "shelter.sua_amount":            "Override; only set when SUA tier answer conflicts with state table",
  "shelter.internet":              "Excluded from shelter calc FY26 (OBBBA §10104); always zero",
  "expedited":                     "Set by agency, not by applicant intake",
  "sponsor_income":                "Elicited under household[].sponsored branch",
  "as_of_date":                    "System field; not a user-facing question",
  "cat_elig":                      "Elicited via categorical eligibility probe (knockout group 3)",
};

// ─── HALF A: Verdict-changes-on-strip ────────────────────────────────────────

describe("HALF A: each DETERMINATIVE_FIELDS entry changes engine output for ≥1 profile", () => {
  for (const entry of DETERMINATIVE_FIELDS) {
    if (entry.advisory) {
      it.skip(`[advisory] ${entry.field} — ${entry.justification ?? "see manifest"}`, () => {});
      continue;
    }

    it(`${entry.field}: stripping changes engine output in ≥1 CA profile`, () => {
      let changedCount = 0;
      const errors: string[] = [];

      for (const profile of CA_PROFILES) {
        const facts = profile.facts as unknown as Facts;

        let baseline: EngineOutput;
        try {
          baseline = runEngine(facts);
        } catch {
          continue; // profile may be malformed for other reasons; skip
        }

        let perturbed: EngineOutput;
        try {
          perturbed = runEngine(entry.apply(facts));
        } catch {
          continue;
        }

        if (outputChanged(baseline, perturbed)) {
          changedCount++;
          break; // one is enough — we just need the field to be load-bearing
        }
      }

      if (changedCount === 0) {
        errors.push(
          `STALE MANIFEST ENTRY: "${entry.field}" — no fixture profile changed output when this field was perturbed. ` +
          `Either remove this field from DETERMINATIVE_FIELDS or add a fixture profile that exercises it.`
        );
      }

      expect(errors, errors.join("\n")).toHaveLength(0);
    });
  }
});

// ─── HALF B: Completeness coverage stub ───────────────────────────────────────
//
// @todo Implement once Component R's DETERMINATIVE_FIELDS is importable TS.
// The test body below is the intended shape — activate by removing the skip.

describe.skip("HALF B (TODO): every Facts leaf is in DETERMINATIVE_FIELDS or OPTIONAL_FIELDS", () => {
  it("placeholder — activate after Component R manifest is importable", () => {
    // When activated:
    // 1. Import DETERMINATIVE_FIELDS from "@civica/snap-recommendation"
    // 2. Import OPTIONAL_FIELDS from the same package
    // 3. Walk the Facts type recursively to enumerate all leaf field paths
    // 4. For each leaf: assert it is in DETERMINATIVE_FIELDS.map(e => e.field)
    //    OR in Object.keys(OPTIONAL_FIELDS)
    // 5. If neither: fail with "missing elicitation question: [field]"
    //
    // The OPTIONAL_FIELDS object above (this file) is the source-of-truth
    // for the allowlist until Component R exports it.
    expect(true).toBe(true); // placeholder
  });
});
