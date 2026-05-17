import { createClient } from "@supabase/supabase-js";

// Service-role client singleton for civic routes (process.env-based).
// Never expose this key to the client.
export const supabaseAdmin = createClient(
  process.env["SUPABASE_URL"] ?? "",
  process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? "",
  { auth: { persistSession: false } },
);

// Anon client singleton used by requireAuth / optionalAuth.
export const supabaseAnon = createClient(
  process.env["SUPABASE_URL"] ?? "",
  process.env["SUPABASE_ANON_KEY"] ?? "",
  { auth: { persistSession: false } },
);
