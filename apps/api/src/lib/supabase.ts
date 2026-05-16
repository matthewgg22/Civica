import { createClient } from "@supabase/supabase-js";

// Service-role client: bypasses RLS — only for server-side use.
// Never expose this key to the client.
export const supabaseAdmin = createClient(
  process.env["SUPABASE_URL"] ?? "",
  process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? "",
  { auth: { persistSession: false } },
);
