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
import { readdirSync, readFileSync } from "node:fs";
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

// ---------------------------------------------------------------------------
// Enum literals on snap_packets (#679 regression)
//
// Two migrations compared snap_packets' status against strings that are not
// packet_status labels:
//
//   20260568_buddy_rls.sql     NOT IN ('submitted', 'approved')
//   20260569_buddy_autorevoke  NEW.status IN ('approved','denied','withdrawn')
//
// The first is caught by the migration-replay CI job — Postgres rejects it
// outright. The SECOND IS NOT, and that is why this test exists: plpgsql
// bodies are only syntax-checked at CREATE time, never name-resolved, so the
// file applies clean and the trigger raises later, on every UPDATE of
// snap_packets, in production. Whoever pasted it into prod fixed it by hand;
// the repo kept the broken copy for months.
//
// Scoped deliberately to snap_packets. The same table carries a SECOND enum
// (county_outcome, whose labels really are 'approved'/'denied') and unrelated
// tables have plain-text status columns holding 'active'/'completed', so a
// guard keyed on the column NAME alone would fire on correct code. This one
// resolves each column to its declared enum type first.
const SQL = readdirSync(MIGRATIONS)
  .filter((f) => f.endsWith(".sql"))
  .sort()
  .map((f) => [f, readFileSync(join(MIGRATIONS, f), "utf8")] as const);

/** label sets, keyed by unqualified enum type name */
function enumLabels(): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  for (const [, sql] of SQL) {
    const re = /create\s+type\s+snap_enrollment\.(\w+)\s+as\s+enum\s*\(([^)]*)\)/gi;
    for (const m of sql.matchAll(re)) {
      out.set(m[1]!, new Set([...m[2]!.matchAll(/'([^']*)'/g)].map((x) => x[1]!)));
    }
  }
  return out;
}

/** snap_packets columns whose declared type is one of those enums */
function packetEnumColumns(enums: Map<string, Set<string>>): Map<string, string> {
  const out = new Map<string, string>();
  for (const [, sql] of SQL) {
    // both `create table … snap_packets (…)` and `alter table … add column`
    const re = /(\w+)\s+snap_enrollment\.(\w+)(?=\s|,|$)/gi;
    for (const block of sql.split(/;\s*$/m)) {
      // The statement's own TARGET must be snap_packets. Merely mentioning it
      // is not enough — a foreign key to snap_packets inside some other
      // table's CREATE would otherwise donate that table's `status` column
      // (and its unrelated enum) to this map, and the guard would then reject
      // every correct packet_status literal in the repo.
      const target =
        /create\s+table\s+(?:if\s+not\s+exists\s+)?snap_enrollment\.snap_packets\b/i.test(block) ||
        /alter\s+table\s+(?:only\s+)?snap_enrollment\.snap_packets\b/i.test(block);
      if (!target) continue;
      if (!/create\s+table|add\s+column/i.test(block)) continue;
      for (const m of block.matchAll(re)) {
        if (enums.has(m[2]!) && m[1]!.toLowerCase() !== "snap_packets") out.set(m[1]!, m[2]!);
      }
    }
  }
  return out;
}

describe("snap_packets is only ever compared to real enum labels (#679)", () => {
  const enums = enumLabels();
  const columns = packetEnumColumns(enums);

  it("knows the schema it is guarding", () => {
    // If these stop resolving the test silently guards nothing.
    expect(enums.get("packet_status")).toContain("Handed Off");
    expect(columns.get("status")).toBe("packet_status");
    expect(columns.get("county_outcome")).toBe("county_outcome");
  });

  it("no migration compares an enum column to a non-label", () => {
    const bad: string[] = [];
    for (const [file, sql] of SQL) {
      // NEW./OLD. only count where this file attaches something to snap_packets.
      const trigger = /on\s+snap_enrollment\.snap_packets/i.test(sql);
      const refs = trigger
        ? /(?:snap_packets|NEW|OLD)\.(\w+)\s*(=|<>|!=|(?:not\s+)?in)\s*(\([^)]*\)|'[^']*')/gi
        : /snap_packets\.(\w+)\s*(=|<>|!=|(?:not\s+)?in)\s*(\([^)]*\)|'[^']*')/gi;
      for (const m of sql.matchAll(refs)) {
        const type = columns.get(m[1]!);
        if (!type) continue;
        const labels = enums.get(type)!;
        for (const lit of [...m[3]!.matchAll(/'([^']*)'/g)].map((x) => x[1]!)) {
          if (!labels.has(lit)) {
            bad.push(`${file}: ${m[1]} ${m[2]} '${lit}' — ${type} has no such label`);
          }
        }
      }
    }
    expect(
      bad,
      "A migration compares a snap_packets enum column to a string that is not " +
        "one of its labels. In SQL this fails at apply time; inside a plpgsql " +
        "body it applies clean and then raises at RUNTIME, on live data:\n" +
        bad.join("\n"),
    ).toEqual([]);
  });
});

// ── The audit sink writes columns that exist (#1049) ──────────────────────
//
// snap_enrollment.mae_query_log recorded NOTHING for twelve days and nobody
// noticed. Three things had to line up:
//
//   1. 20260618_mae_query_log_tokens.sql adds input_tokens / output_tokens,
//      and was never pasted into prod.
//   2. The sink that writes those columns shipped in the SAME commit
//      (a4eb5b0f, #778) — file written, code live, SQL never run.
//   3. The sink is best-effort and logs the rejection at console.info, which
//      is correct for not breaking someone's answer and useless as an alarm.
//
// BE CLEAR ABOUT WHAT THIS DOES AND DOES NOT CATCH. The column guard below
// would NOT have caught #1049: the migration IS in this repo, so the code and
// the tree agree perfectly. Only the live database disagreed. No static check
// can see prod drift while migrations are pasted by hand.
//
// What it does catch is the neighbouring mistake, which is easy to make in the
// same file: a sink that writes a column no migration anywhere declares. That
// one is real and this is where it would surface.
//
// The guard that actually shortens #1049 is the last one — the swallowed
// rejection has to reach Sentry, because that is the only signal that crosses
// the repo/prod gap.
describe("the audit sink only writes columns the migrations declare (#1049)", () => {
  const SINK = join(__dirname, "..", "lib", "demeter-audit-sink.ts");
  const TABLE = "mae_query_log";

  /** The keys of the object literal passed to .insert({ ... }). */
  const insertedColumns = (): string[] => {
    const src = readFileSync(SINK, "utf8");
    const at = src.indexOf(".insert({");
    expect(at, "the sink's insert call").toBeGreaterThan(-1);
    // Balance braces so a nested object cannot truncate the scan.
    let depth = 0;
    let end = at + ".insert(".length;
    for (let i = end; i < src.length; i++) {
      if (src[i] === "{") depth++;
      else if (src[i] === "}") {
        depth--;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }
    const body = src.slice(at, end);
    return [...body.matchAll(/^\s{6,8}([a-z_][a-z0-9_]*):/gm)].map((m) => m[1]!);
  };

  /** Every column the migrations ever give that table. */
  const declaredColumns = (): Set<string> => {
    const cols = new Set<string>();
    for (const f of readdirSync(MIGRATIONS).filter((n) => n.endsWith(".sql"))) {
      const sql = readFileSync(join(MIGRATIONS, f), "utf8");
      if (!sql.includes(TABLE)) continue;
      // create table … ( … )
      const created = sql.match(
        new RegExp(`create\\s+table[^;]*?${TABLE}\\s*\\(([\\s\\S]*?)\\n\\s*\\);`, "i"),
      );
      if (created) {
        for (const line of created[1]!.split("\n")) {
          const m = /^\s*([a-z_][a-z0-9_]*)\s+[a-z]/i.exec(line);
          if (m && !/^(constraint|primary|unique|foreign|check)$/i.test(m[1]!)) cols.add(m[1]!);
        }
      }
      // alter table … add column [if not exists] x type
      for (const m of sql.matchAll(
        /add\s+column\s+(?:if\s+not\s+exists\s+)?([a-z_][a-z0-9_]*)/gi,
      )) {
        if (new RegExp(`alter\\s+table[^;]*${TABLE}`, "i").test(sql)) cols.add(m[1]!);
      }
    }
    return cols;
  };

  it("finds the sink's insert and the table's declared columns", () => {
    // A guard that silently matched nothing would pass forever.
    expect(insertedColumns().length, "no columns parsed from the insert").toBeGreaterThan(10);
    expect(declaredColumns().size, "no columns parsed from the migrations").toBeGreaterThan(10);
  });

  it("declares every column it inserts", () => {
    const declared = declaredColumns();
    const missing = insertedColumns().filter((c) => !declared.has(c));
    expect(
      missing,
      `the sink writes ${missing.join(", ")}, which no migration in this repo ` +
        `declares. Postgres will reject the insert and the sink will swallow it, ` +
        `so the row is lost silently — the shape of #1049, though not its cause ` +
        `(there the migration existed and was simply never applied to prod).`,
    ).toEqual([]);
  });

  it("raises the swallowed error loudly enough to reach Sentry", () => {
    // Best-effort is right: an audit failure must never break someone's
    // answer. But console.info is not an alarm, and a TOTAL logging outage
    // looked like nothing at all for twelve days.
    const src = readFileSync(SINK, "utf8");
    expect(src, "the sink still swallows at console.info").not.toMatch(
      /console\.info\(\s*\n?\s*"\[demeter-audit\]/,
    );
    expect(src).toMatch(/console\.error\(/);
  });
});
