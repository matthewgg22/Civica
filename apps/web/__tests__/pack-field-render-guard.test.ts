// THE GUARD (#931). Model-facing pack fields must not reach a reader raw.
//
// `pack.program` and `pack.agency` are written for the CORPUS, not for
// someone applying for food assistance: 32 packs carry a research annexe in
// `program` and 7 in `agency`, always behind an em-dash. programDisplayName
// and agencyDisplayName cut it. The helpers existed for a year and were
// applied site by site, reactively — the same leak was found and fixed FOUR
// separate times, each after a human noticed it in a screenshot, and each
// time other sites kept leaking silently (#761 covers the data side).
//
// So this is a static scan rather than a rendering test: the point is to
// catch the NEXT site at the moment it is written, including ones no test
// renders — page metadata, JSON-LD, an emailed PDF.
//
// A "reader" here includes a search index and a PDF, not just the screen.
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "..");
const DIRS = ["components", "app", "lib"];

/** Objects whose `.program` / `.agency` are COPY keys, not pack fields. */
const COPY_IDENTIFIERS = new Set(["copy", "c", "t", "dt", "T"]);

/** Deliberate raw reads, each with the reason it is safe. */
const ALLOWED: Array<{ match: string; why: string }> = [
  {
    match: "[s.code, stateName(s.code), s.program, s.agency].some",
    why: "Search predicate: someone typing the full official agency name should still match their state. Nothing is rendered from it.",
  },
  {
    match: "[j.code, j.name, j.program, j.agency].some",
    why: "Same search predicate, NAP jurisdictions.",
  },
];

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "__tests__" || entry === "node_modules") continue;
      walk(full, out);
    } else if (/\.tsx?$/.test(entry) && !full.endsWith("program-name.ts")) {
      out.push(full);
    }
  }
  return out;
}

describe("model-facing pack fields never reach a reader raw (#931)", () => {
  it("every .program / .agency read goes through a display helper", () => {
    const offenders: string[] = [];

    for (const file of DIRS.flatMap((d) => walk(join(ROOT, d)))) {
      const rel = file.slice(ROOT.length + 1);
      let inBlockComment = false;
      readFileSync(file, "utf8")
        .split("\n")
        .forEach((line, i) => {
          // Track block comments: this file's own prose explains the leak in
          // terms of `pack.agency`, and a scanner that flags its own
          // documentation is a scanner nobody keeps.
          const opens = line.includes("/*");
          const closes = line.includes("*/");
          const wasInComment = inBlockComment;
          if (opens && !closes) inBlockComment = true;
          if (closes) inBlockComment = false;
          if (wasInComment || (opens && !closes)) return;
          // The identifier before the dot decides whether this is a pack
          // field at all — `copy.agency` is a label, `pack.agency` is not.
          const reads = [...line.matchAll(/(\w+)\??\.(program|agency)\b/g)].filter(
            (m) => !COPY_IDENTIFIERS.has(m[1]!),
          );
          if (reads.length === 0) return;
          if (line.trimStart().startsWith("//") || line.trimStart().startsWith("*")) return;
          // primaryAgency runs agencyDisplayName itself, so it is safe on a
          // raw field. hasLocalProgramName returns a BOOLEAN — a predicate
          // over the raw string publishes nothing, and it normalizes through
          // programDisplayName internally. Both are in program-name.ts, which
          // this scan already exempts as the place the cutting happens.
          if (
            /programDisplayName\(|agencyDisplayName\(|primaryAgency\(|hasLocalProgramName\(/.test(
              line,
            )
          )
            return;
          if (ALLOWED.some((a) => line.includes(a.match))) return;
          offenders.push(`${rel}:${i + 1}  ${line.trim().slice(0, 110)}`);
        });
    }

    expect(
      offenders,
      `Raw pack field(s) reaching a reader. Wrap in programDisplayName()/agencyDisplayName(), ` +
        `or add to ALLOWED in this file with the reason it is safe:\n${offenders.join("\n")}`,
    ).toEqual([]);
  });
});
