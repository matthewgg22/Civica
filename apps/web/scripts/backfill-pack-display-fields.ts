// One-time backfill: give every pack the display fields it should have had.
//
// program / agency / portal.name are written for the MODEL. They carry corpus
// annotation behind em-dashes, division and sub-division chains up to 211
// characters, and parentheticals that are sometimes an acronym expansion and
// sometimes the only warning on the row. Every surface that showed them was
// cutting that text at RENDER time, which is why the same leak was found and
// fixed four separate times (#931) and why the state directory needed three
// more helpers on top.
//
// The fix the code comments have asked for since program-name.ts was written:
// put the reader-facing form in the pack. The cut still happens exactly once —
// here — and the values are then data that a human can correct where the rule
// gets it wrong, which is the whole point of having the field.
//
// Idempotent: re-running produces the same file. Safe to re-run after adding a
// pack, but check what it wrote — a generated short name is a starting point,
// not an authority.
//
//   pnpm --filter civica-web exec tsx scripts/backfill-pack-display-fields.ts

import { readFileSync, writeFileSync } from "node:fs";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import {
  primaryAgency,
  programDisplayName,
  splitPortalName,
} from "../lib/program-name";

const STATES = join(__dirname, "..", "..", "..", "packages", "demeter-engine", "src", "states");

/** Hand-written, from the jurisdiction's own published instructions — NOT
 *  derived, because "there is no online application" is a claim about the
 *  world and no text rule can produce it.
 *
 *  USVI: dhs.vi.gov/family-assistance-programs says the form is picked up at a
 *  local SNAP office, mailed on request, or printed from the DHS site, then
 *  filed with an office. No web submission exists. Without this the row shows
 *  an Ask link and nothing else, which reads as a gap in our data. */
const APPLY_NOTE: Record<string, string> = {
  VI: "No online application — file the printed form at a local office",
};

/** Rebuild the object with the new keys beside the ones they describe, rather
 *  than appended at the end where nobody reading the file will connect them. */
function withDisplayFields(pack: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(pack)) {
    if (key === "program_short" || key === "agency_short" || key === "apply_note") continue;
    out[key] = value;
    if (key === "program") out.program_short = programDisplayName(String(value));
    if (key === "agency") out.agency_short = primaryAgency(String(value));
  }

  if (out.portal && typeof out.portal === "object") {
    const p = out.portal as Record<string, unknown>;
    const { label, note } = splitPortalName(String(p.name));
    const rebuilt: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(p)) {
      if (key === "short" || key === "note") continue;
      rebuilt[key] = value;
      if (key === "name") {
        rebuilt.short = label;
        if (note) rebuilt.note = note;
      }
    }
    out.portal = rebuilt;
  }

  const note = APPLY_NOTE[String(out.code)];
  if (note && !out.portal) out.apply_note = note;
  return out;
}

let changed = 0;
for (const dir of readdirSync(STATES).sort()) {
  const file = join(STATES, dir, "pack.json");
  let raw: string;
  try {
    raw = readFileSync(file, "utf8");
  } catch {
    continue;
  }
  const next = JSON.stringify(withDisplayFields(JSON.parse(raw)), null, 2) + "\n";
  if (next !== raw) {
    writeFileSync(file, next);
    changed++;
  }
}
console.log(`backfilled ${changed} pack(s)`);
