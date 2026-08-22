// No state's answer is built from another state's pack (#780).
//
// THIS BUG ALREADY SHIPPED ONCE. states/index.ts documents it as "the CA-leak
// fix": an anonymous user with no state selected inherited California's
// supplements instead of the federal floor. The fix is encoded as argument
// semantics — null means federal-only, undefined means the legacy CA default —
// and retrieve() threads state per call with no shared cache.
//
// Sound by design, and nothing asserted it. A caching layer, a new retrieval
// path or a refactor of getStatePack could reintroduce the same shape and no
// test would notice; the way it would surface is a Wisconsin reader being told
// California's rules, which they have no way to detect and every reason to
// believe.
//
// So this asserts the PROPERTY, not the implementation: whatever retrieval
// returns for state A contains nothing that belongs only to state B.
import { describe, it, expect } from "vitest";
import { retrieve } from "../retrieval";
import { getStatePack, registeredStates, type StateCode } from "../states/index";

/** Citations that belong to exactly one state's pack.
 *
 *  "Appears in only one pack" is the whole test — two packs carrying the same
 *  cite means it is shared, not leaked. The only extra exclusion is a BARE
 *  federal citation ("7 CFR 273.9"), which the federal corpus also returns on
 *  its own and would read as a false leak.
 *
 *  Note the exclusion is anchored, and that matters: a first pass here skipped
 *  anything CONTAINING "7 CFR", which threw away most of the set — CA's own
 *  topics are cited like "Operational — EBT customer service (issuance: 7 CFR
 *  274)". The guard passed while detecting almost nothing, and only failed on
 *  the leak once this was narrowed. */
function exclusiveCitations(): Map<string, StateCode> {
  const owners = new Map<string, Set<StateCode>>();
  for (const code of registeredStates()) {
    for (const topic of getStatePack(code)?.topics ?? []) {
      if (/^7 CFR\b/i.test(topic.citation.trim())) continue;
      const set = owners.get(topic.citation) ?? new Set<StateCode>();
      set.add(code);
      owners.set(topic.citation, set);
    }
  }
  const exclusive = new Map<string, StateCode>();
  for (const [citation, states] of owners) {
    if (states.size === 1) exclusive.set(citation, [...states][0]!);
  }
  return exclusive;
}

const EXCLUSIVE = exclusiveCitations();

/** A query built from a state's own pack terms, so its pack is actually
 *  exercised rather than the test passing because nothing matched. */
function probeFor(code: StateCode): string {
  const topic = getStatePack(code)?.topics?.[0];
  return (topic?.terms ?? []).slice(0, 4).join(" ") || "snap eligibility";
}

describe("retrieval never returns another state's pack content (#780)", () => {
  // A spread: the launch state, two later builds, and a territory.
  for (const code of ["CA", "WI", "TX", "NY"] as StateCode[]) {
    it(`${code}'s answer contains no other state's exclusive citations`, async () => {
      const chunks = await retrieve(probeFor(code), { state: code, k: 12 });
      const foreign = chunks
        .map((c) => ({ citation: c.citation, owner: EXCLUSIVE.get(c.citation) }))
        .filter((x) => x.owner !== undefined && x.owner !== code);
      expect(
        foreign,
        `Retrieval for ${code} returned citations belonging only to another state — ` +
          `a ${code} reader would be answered with someone else's rules: ` +
          foreign.map((f) => `${f.citation} (${f.owner})`).join(", "),
      ).toEqual([]);
    });
  }

  it("a CA-flavoured question asked for WI still yields no CA-only citations", async () => {
    // The pointed version of the above: the query itself is built from
    // California's pack terms, so anything CA-only that comes back was pulled
    // by the query rather than by the state — which is exactly how the
    // original leak behaved.
    const chunks = await retrieve(probeFor("CA" as StateCode), { state: "WI" as StateCode, k: 12 });
    const caOnly = chunks.filter((c) => EXCLUSIVE.get(c.citation) === "CA");
    expect(caOnly.map((c) => c.citation), "CA pack content served to a WI reader").toEqual([]);
  });
});

describe("the federal floor is actually federal (the CA-leak fix)", () => {
  it("state: null returns no state-pack content at all", async () => {
    const chunks = await retrieve(probeFor("CA" as StateCode), { state: null, k: 12 });
    const stateOwned = chunks.filter((c) => EXCLUSIVE.has(c.citation));
    expect(
      stateOwned.map((c) => `${c.citation} (${EXCLUSIVE.get(c.citation)})`),
      "An anonymous reader with no state selected inherited a state's supplements — " +
        "this is the CA-leak bug, returned",
    ).toEqual([]);
  });

  it("getStatePack keeps null and undefined meaning different things", () => {
    // The distinction IS the fix. Collapsing them (a refactor defaulting the
    // parameter, say) silently restores the leak for every anonymous user.
    expect(getStatePack(null), "null must mean federal floor").toBeNull();
    expect(getStatePack(undefined), "undefined is the legacy dashboard default").not.toBeNull();
    expect(getStatePack("ZZ"), "an unknown state degrades to the floor, never throws").toBeNull();
  });
});
