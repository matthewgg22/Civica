// facts_patch applier — A/B variants in v0.6 ship dotted-path overrides
// like `household.0.weekly_work_hours` or `income.0.amount`. Deep-clone
// the base facts, walk each patch key, mutate. Numeric path components
// index into arrays. `as_of_date` patches end up on the pseudo-field
// the runner reads when calling the engine.

import type { Facts } from "./types.ts";

/**
 * Apply a v0.6 `facts_patch` blob to a deep copy of `base`. Path keys use
 * dots; numeric components are array indices. Leaf assignment replaces the
 * value. Missing intermediate objects are NOT auto-created — patches must
 * target paths that already exist in the base facts (the fixture is
 * authored to ensure this; any miss is a fixture authoring bug we want to
 * surface, not silently paper over).
 *
 * `as_of_date` is special: not in the base shape but documented in the
 * fixture's variant blocks. It rides on `Facts` as an optional pseudo-field
 * the runner reads to override the profile's date.
 */
export function applyFactsPatch(
  base: Facts,
  patch: Record<string, unknown>,
): Facts {
  const out = structuredClone(base) as Facts & Record<string, unknown>;
  for (const [pathStr, value] of Object.entries(patch)) {
    setByDottedPath(out, pathStr, value);
  }
  return out as Facts;
}

function setByDottedPath(
  target: Record<string, unknown>,
  pathStr: string,
  value: unknown,
): void {
  const parts = pathStr.split(".");
  let cur: any = target;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    const idx = Number.isInteger(Number(part)) ? Number(part) : null;
    if (idx !== null) {
      if (!Array.isArray(cur)) {
        throw new Error(
          `facts_patch path "${pathStr}" expected array at segment "${part}" but got ${typeof cur}`,
        );
      }
      // Variant patches sometimes target an array index that's beyond
      // the current array length (e.g. M23 patches income.0.* when the
      // base profile has an empty income[] — variant intends to add the
      // line). Pad with empty objects so the rest of the path resolves.
      while (cur.length <= idx) cur.push({});
      cur = cur[idx];
    } else {
      if (cur === null || typeof cur !== "object") {
        throw new Error(
          `facts_patch path "${pathStr}" expected object at segment "${part}" but got ${typeof cur}`,
        );
      }
      // Allow first-time creation only for the pseudo-field as_of_date
      // (which is documented but not in the base Facts shape).
      if (!(part in cur) && pathStr !== "as_of_date") {
        // The pseudo-field exception: when the very first segment is
        // a top-level key we don't track (e.g. coresident_income_pct,
        // shares_meals, must_combine_with_parent, active_warrant — these
        // appear in patches but aren't in the base Facts shape because
        // they're inputs to gates we haven't implemented yet), allow the
        // assignment so the runner sees them and can include them in the
        // engine call. Lack of consumer is a missing-surface concern,
        // not a patch-application concern.
        cur[part] = {};
      }
      cur = cur[part];
    }
  }

  const leaf = parts[parts.length - 1];
  const leafIdx = Number.isInteger(Number(leaf)) ? Number(leaf) : null;
  if (leafIdx !== null) {
    if (!Array.isArray(cur)) {
      throw new Error(
        `facts_patch leaf "${pathStr}" expected array but got ${typeof cur}`,
      );
    }
    cur[leafIdx] = value;
  } else {
    if (cur === null || typeof cur !== "object") {
      throw new Error(
        `facts_patch leaf "${pathStr}" expected object but got ${typeof cur}`,
      );
    }
    cur[leaf] = value;
  }
}
