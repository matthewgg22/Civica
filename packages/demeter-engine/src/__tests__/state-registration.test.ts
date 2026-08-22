// Every state pack on disk is actually wired in (#779).
//
// Adding a state takes FOUR manual steps: the import, the REGISTRY entry, the
// StateCode union member (states/index.ts), and a separate entry in packs.ts.
// Nothing checked that they all happened, and the two existing gates look at
// different things — pack-freshness.test.ts scans the FILESYSTEM, so it
// happily validates a pack nobody registered, while state-packs.test.ts walks
// the REGISTRY, so it never sees one. A directory can sit fully valid on disk,
// pass its freshness check, and never be served by retrieval, citation
// verification or anything else.
//
// That failure is silent in the worst way: the state looks supported to
// whoever built it, and answers for it quietly fall back to the federal floor
// for everyone who lives there.
import { describe, it, expect } from "vitest";
import { readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";
import { registeredStates, getStatePack, type StateCode } from "../states/index";
import { VERIFIED_STATES } from "../packs";

const STATES_DIR = join(__dirname, "..", "states");

/** Directories under src/states/ that hold a pack — the filesystem's own
 *  answer to "which states exist", independent of any code registry. */
function packDirsOnDisk(): string[] {
  return readdirSync(STATES_DIR)
    .filter((entry) => {
      const full = join(STATES_DIR, entry);
      if (!statSync(full).isDirectory()) return false;
      // A pack is a directory with a pack.json; anything else is scaffolding.
      return existsSync(join(full, "pack.json"));
    })
    .map((d) => d.toUpperCase());
}

describe("a state pack on disk is a state the engine actually serves (#779)", () => {
  it("every pack directory is in REGISTRY", () => {
    const onDisk = packDirsOnDisk().sort();
    const registered = registeredStates().sort();
    const unregistered = onDisk.filter((code) => !registered.includes(code as StateCode));
    expect(
      unregistered,
      `Pack director${unregistered.length === 1 ? "y" : "ies"} on disk but NOT in REGISTRY ` +
        `(states/index.ts). Freshness checks pass for these and retrieval never sees them, ` +
        `so answers for anyone living there silently fall back to the federal floor. ` +
        `Add the import, the REGISTRY entry and the StateCode union member: ${unregistered.join(", ")}`,
    ).toEqual([]);
  });

  it("every REGISTRY entry resolves to a pack — no dangling registration", () => {
    // The other direction: registered but the directory is gone or empty.
    for (const code of registeredStates()) {
      expect(getStatePack(code), `${code} is registered but getStatePack returns null`).not.toBeNull();
    }
  });

  it("every registered state is also in packs.ts, the fourth step", () => {
    // packs.ts is what the WEB app enumerates — the picker, the map, the guide
    // pages. A state can be registered in the engine and still be invisible to
    // every reader if this step is missed.
    const inPacks = VERIFIED_STATES.map((p) => p.code).sort();
    const missing = registeredStates().filter((code) => !inPacks.includes(code));
    expect(
      missing,
      `Registered in the engine but absent from packs.ts, so no reader can select ` +
        `${missing.length === 1 ? "it" : "them"}: ${missing.join(", ")}`,
    ).toEqual([]);
  });

  it("and packs.ts names nothing the engine cannot serve", () => {
    const unservable = VERIFIED_STATES.map((p) => p.code).filter((c) => getStatePack(c) === null);
    expect(
      unservable,
      `Offered to readers in packs.ts but getStatePack returns null — picking ` +
        `${unservable.length === 1 ? "it" : "one"} would answer with the federal floor while ` +
        `the UI says the state is verified: ${unservable.join(", ")}`,
    ).toEqual([]);
  });
});
