import { createClient } from "@supabase/supabase-js";
import type { Database } from "@civica/db-types";
import type { Env } from "../types.js";

function resolveEnv(env?: Partial<Env>) {
  return {
    url: env?.SUPABASE_URL ?? process.env["SUPABASE_URL"] ?? "",
    serviceKey: env?.SUPABASE_SERVICE_ROLE_KEY ?? process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? "",
    anonKey: env?.SUPABASE_ANON_KEY ?? process.env["SUPABASE_ANON_KEY"] ?? "",
  };
}

// Service-role client singleton for civic/* routes (process.env-based).
// Never expose this key to the client.
export const supabaseAdmin = createClient(
  process.env["SUPABASE_URL"] ?? "",
  process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? "",
  { auth: { persistSession: false } },
);

// Factory functions for enrollment routes — work in both CF Workers
// (c.env populated by runtime) and Node.js (falls back to process.env).
export function makeServiceClient(env?: Partial<Env>) {
  const { url, serviceKey } = resolveEnv(env);
  return createClient<Database>(url, serviceKey, { auth: { persistSession: false } });
}

export function makeAnonClient(env: Partial<Env> | undefined, jwt: string) {
  const { url, anonKey } = resolveEnv(env);
  return createClient<Database>(url, anonKey, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
}
