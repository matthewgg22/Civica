import type { Env } from "../types.js";

// Clear app_metadata.role for a buddy user — but ONLY if it is currently
// 'buddy'. A caseworker (navigator/admin) can hold a buddy_relationship row via
// the shared invite link or the dashboard self-referral flow; nulling their role
// here would destroy their staff access. So we read the current role first and
// only clear an actual 'buddy'. Any other role (or none) is left untouched.
//
// Returns true on success OR when the role wasn't 'buddy' (nothing to do), so
// callers can treat "left a staff role alone" the same as "cleared a buddy".
// Returns false only when the Admin API read/write actually failed.
export async function clearBuddyRoleIfBuddy(env: Env, userId: string): Promise<boolean> {
  const url = `${env.SUPABASE_URL}/auth/v1/admin/users/${userId}`;
  const authHeaders = {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
  };

  const getRes = await fetch(url, { headers: authHeaders });
  if (!getRes.ok) return false;
  const user = (await getRes.json()) as { app_metadata?: { role?: string | null } };
  if (user.app_metadata?.role !== "buddy") {
    return true; // not a cron-managed buddy role — never touch staff roles
  }

  const res = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...authHeaders },
    body: JSON.stringify({ app_metadata: { role: null } }),
  });
  return res.ok;
}
