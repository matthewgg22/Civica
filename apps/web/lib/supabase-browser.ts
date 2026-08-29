"use client";

import { createBrowserClient } from "@supabase/ssr";

// Browser-side Supabase client. @supabase/ssr keeps the session in cookies
// shared with the server so both sides stay in sync. Those cookies are NOT
// HttpOnly — this SDK reads and writes them from JS (document.cookie), which
// an HttpOnly cookie forbids by definition. So treat the session token as
// reachable by page scripts for XSS threat-modeling; it is not shielded the way
// a server-only HttpOnly cookie would be. persistSession is handled internally.
export function supabaseBrowser() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
