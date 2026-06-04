"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { publicEnv } from "./env";

let cached: SupabaseClient | null = null;

// Browser-side Supabase client. Used by the sign-in page to call
// signInWithOtp + verifyOtp (phone). Mirrors the iOS CivicaEnrollmentAuth
// pattern of hitting Supabase auth directly rather than going through
// the enrollment-api gateway.
//
// Session tokens are NOT stored in localStorage by Supabase here; we hand
// the verified session over to a server route that sets HttpOnly cookies.
// The browser client is configured with persistSession=false so the JS
// SDK doesn't fight the cookie-based session.
export function supabaseBrowser(): SupabaseClient {
  if (cached) return cached;
  const { supabaseUrl, supabaseAnonKey } = publicEnv();
  cached = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  return cached;
}
