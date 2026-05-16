import { createClient } from "@supabase/supabase-js";
import type { Database } from "@civica/db-types";
import type { Env } from "../types.js";

export function makeServiceClient(env: Env) {
  return createClient<Database>(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
}

export function makeAnonClient(env: Env, jwt: string) {
  return createClient<Database>(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
}
