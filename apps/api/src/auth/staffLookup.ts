import { supabaseAdmin } from '../lib/supabase.js';

// Translates an auth.users UUID (JWT `sub`) into a snap_enrollment.staff_users.staff_id.
// Required for any FK that references staff_users (assignments, notes, missing items,
// audit actor_id). Returns null if no staff_users row exists for the given auth_uid.
export async function resolveStaffId(authUid: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .schema('snap_enrollment')
    .from('staff_users')
    .select('staff_id')
    .eq('auth_uid', authUid)
    .is('deleted_at', null)
    .single();
  if (error || !data) return null;
  return (data as { staff_id: string }).staff_id;
}
