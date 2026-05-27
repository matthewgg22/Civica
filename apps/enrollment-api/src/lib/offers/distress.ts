/**
 * Distress-flag check for the offer-moment platform.
 *
 * Source plan: ceo-plans/2026-05-26-ebt-offer-moment-platform.md (E3 + E8).
 *
 * Re-check contract: this function is called THREE times per user
 * interaction in the worst case (resolver → event write → redemption write).
 * The schema's partial index on `(user_id) WHERE active = true` makes the
 * EXISTS query sub-millisecond, so the redundant calls defeat any race
 * between the offer-fetch response and the subsequent event/redeem write.
 *
 * Silent-honor contract: callers MUST NOT surface "you are flagged" to
 * the user. When `isDistressed(userId) === true`, the route returns
 * `free_resources` rendered in identical UI structure to offer rows.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Returns true if the user has any active distress flag.
 * Hot-path query — single EXISTS check against an indexed partial index.
 */
export async function isDistressed(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: SupabaseClient<any, "snap_enrollment", any> | any,
  userId: string,
): Promise<boolean> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (db.schema("snap_enrollment").from("distress_flags" as any) as any)
    .select("flag_id")
    .eq("user_id", userId)
    .eq("active", true)
    .limit(1);
  if (error) {
    // Fail closed: if the distress check itself errors, treat as if the user
    // IS in distress. Better to silently show free_resources than to push an
    // offer to someone in crisis because Supabase blipped.
    return true;
  }
  return Array.isArray(data) && data.length > 0;
}
