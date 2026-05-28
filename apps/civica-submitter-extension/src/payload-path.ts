/**
 * Resolve a dot-path into a BenefitsCalPayload-shaped object.
 *
 * Supported syntax (kept intentionally tiny — no full lodash.get):
 *   "first_name"                 → root.first_name
 *   "address.zip"                → root.address.zip
 *   "household_members[0].name"  → root.household_members[0].name
 *
 * Returns null when any segment is missing/undefined (no exceptions on
 * misses — easier to compose with field-fill loops that skip nulls).
 */
export function resolvePath(root: unknown, path: string): unknown {
  if (!root || typeof root !== "object") return null;
  let cur: unknown = root;
  // Split on `.` but preserve bracket indices: "members[0].name" → ["members[0]", "name"]
  const segments = path.split(".");
  for (const seg of segments) {
    if (cur === null || cur === undefined) return null;
    // Match leading identifier + optional bracketed index.
    const m = /^([A-Za-z_][A-Za-z0-9_]*)(?:\[(\d+)\])?$/.exec(seg);
    if (!m) return null;
    const key = m[1];
    if (!key) return null;
    const idx = m[2];
    const obj = cur as Record<string, unknown>;
    const next = obj[key];
    if (idx === undefined) {
      cur = next;
    } else {
      if (!Array.isArray(next)) return null;
      const i = Number.parseInt(idx, 10);
      cur = next[i] ?? null;
    }
  }
  return cur ?? null;
}
