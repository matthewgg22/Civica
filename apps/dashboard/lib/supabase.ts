import { createBrowserClient, createServerClient } from "@supabase/ssr";
import type { Database } from "@civica/db-types";
import type { cookies } from "next/headers";

function supabaseEnvVars(): { url: string; anonKey: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set. " +
        "Add them to .env.local for local dev or the Vercel project env vars for deployed environments."
    );
  }
  return { url, anonKey };
}

export function createClient() {
  const { url, anonKey } = supabaseEnvVars();
  return createBrowserClient<Database>(url, anonKey);
}

export function createServerClientFromCookies(cookieStore: Awaited<ReturnType<typeof cookies>>) {
  const { url, anonKey } = supabaseEnvVars();
  return createServerClient<Database>(
    url,
    anonKey,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        },
      },
    }
  );
}
