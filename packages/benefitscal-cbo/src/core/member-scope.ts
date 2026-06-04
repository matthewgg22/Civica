/**
 * Household-member payload scoping for the step-2 People sub-flow (V1-5 PR4, #314).
 *
 * BenefitsCal walks one set of pages PER household member (ABNMI_MEMBER name,
 * ABHHR relationship, ABPSM program inclusion, …). Each repetition reuses the
 * same URL and the same PortalPage selectors. To fill member N's data on the
 * Nth repetition, the extension's content script tracks a member index in
 * sessionStorage (see content.ts) and calls this function to produce a payload
 * scoped to that member.
 *
 * Scoping strategy — the "index-0 proxy":
 *   Repeating PortalPage source paths are written as `household_members[0].X`.
 *   This function returns a shallow copy of the payload whose
 *   `household_members` array contains EXACTLY the target member at index 0.
 *   So `household_members[0].first_name` resolves to member N's first name
 *   without touching resolvePath (which already understands `[0]`) and without
 *   mutating the shared FieldSelector objects.
 *
 * Out-of-bounds / empty handling (correctness-critical):
 *   If `memberIndex` has no corresponding member (empty household, or the human
 *   advanced past the last known member by clicking "add another" an extra
 *   time), we scope to an EMPTY array — NOT the original payload. Returning the
 *   original would make `household_members[0]` resolve to the FIRST member and
 *   wrongly stamp member 0's name onto a later member's page. An empty array
 *   makes every member source resolve to null → no-value → needs-review, which
 *   correctly leaves the page for the human.
 *
 * Pure compute. Browser-safe per the /core contract: no DOM, no Chrome APIs,
 * no I/O. Imported by content.ts and by the step-2 unit tests.
 */

export function scopePayloadForMember(
  payload: unknown,
  memberIndex: number,
): unknown {
  if (!payload || typeof payload !== "object") return payload;
  const p = payload as Record<string, unknown>;
  const members = p["household_members"];
  // No household_members array at all → nothing to scope; pass through so
  // non-member fields on the page still resolve normally.
  if (!Array.isArray(members)) return payload;

  const member = members[memberIndex];
  if (!member || typeof member !== "object") {
    // Empty household or index past the last member: scope to an empty array
    // so member sources resolve null (no-value), never bleeding member 0's
    // data onto a later page.
    return { ...p, household_members: [] };
  }
  // Place the target member at index 0 so `household_members[0].X` paths hit it.
  return { ...p, household_members: [member] };
}
