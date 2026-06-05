import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

function supabaseEnvVars() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "Missing Supabase config: set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
  }
  return { url, anonKey };
}

// Server-side Supabase client that reads/writes session cookies automatically.
// Replaces the former manual cookie stack (persistSession / clearSession /
// refreshWithToken). The @supabase/ssr SDK handles concurrent refresh with
// a built-in mutex, fixing the race condition in the old implementation.
export async function createSupabaseServerClient() {
  const jar = await cookies();
  const { url, anonKey } = supabaseEnvVars();
  return createServerClient(url, anonKey, {
    cookies: {
      getAll: () => jar.getAll(),
      setAll: (cs) =>
        cs.forEach(({ name, value, options }) => jar.set(name, value, options)),
    },
  });
}

// Returns the active access token, refreshing it if needed. Returns null
// when there is no valid session. Callers (enrollment routes) use this
// as a Bearer token for the Hono gateway.
export async function currentAccessToken(): Promise<string | null> {
  const supabase = await createSupabaseServerClient();
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

export async function currentUserId(): Promise<string | null> {
  const supabase = await createSupabaseServerClient();
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user.id ?? null;
}

// Service-role admin client — server-only. Used by the lead-capture route.
// Never expose to the browser.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function supabaseAdmin(): ReturnType<typeof createClient<any>> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "Missing Supabase admin config: set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    );
  }
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
