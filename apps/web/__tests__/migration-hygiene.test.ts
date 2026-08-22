// Migration chain hygiene (#677).
//
// Two files sharing a version prefix is not cosmetic: Supabase records applied
// migrations BY VERSION, so of two files numbered alike one can be recorded
// and the other silently skipped — which is how prod and this repo drifted
// apart without anyone seeing it (#679 is the wreckage).
//
// The three collisions below are GRANDFATHERED, not forgiven. Renaming a
// migration that prod has already applied would make Supabase treat it as new
// and try to run it again, so unpicking them is an operator decision with a
// live database in the loop, not something a test should force. What this
// guard does is stop the set from growing.
import { describe, it, expect } from "vitest";
import { readdirSync } from "node:fs";
import { join } from "node:path";

const MIGRATIONS = join(__dirname, "..", "..", "..", "supabase", "migrations");

/** Collisions that predate this guard. Do not add to this list — fix the
 *  filename instead. Removing one requires renaming in the DB's ledger too. */
const GRANDFATHERED = new Set(["20260596", "20260598", "20260614"]);

describe("no two migrations share a version prefix (#677)", () => {
  it("only the known collisions exist", () => {
    const byPrefix = new Map<string, string[]>();
    for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith(".sql"))) {
      const prefix = file.split("_")[0]!;
      byPrefix.set(prefix, [...(byPrefix.get(prefix) ?? []), file]);
    }
    const collisions = [...byPrefix.entries()]
      .filter(([prefix, files]) => files.length > 1 && !GRANDFATHERED.has(prefix))
      .map(([prefix, files]) => `${prefix}: ${files.join(", ")}`);

    expect(
      collisions,
      "New duplicate migration prefix. Supabase records applied migrations by " +
        "version, so one of these can be applied and the other silently skipped — " +
        "which is exactly how the repo stopped describing prod. Renumber the new " +
        "file:\n" + collisions.join("\n"),
    ).toEqual([]);
  });

  it("every migration filename starts with a version prefix", () => {
    const malformed = readdirSync(MIGRATIONS)
      .filter((f) => f.endsWith(".sql"))
      .filter((f) => !/^\d{8,}_/.test(f));
    expect(malformed, `Unversioned migration file(s): ${malformed.join(", ")}`).toEqual([]);
  });

  it("the grandfathered list still describes reality", () => {
    // If someone renames one of these properly, this fails and the entry
    // should be deleted — a stale exemption is how a guard rots.
    const prefixes = new Set(
      readdirSync(MIGRATIONS).filter((f) => f.endsWith(".sql")).map((f) => f.split("_")[0]!),
    );
    for (const g of GRANDFATHERED) {
      expect(prefixes.has(g), `Grandfathered prefix ${g} no longer exists — remove it`).toBe(true);
    }
  });
});
