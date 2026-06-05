"use client";

import { createBrowserClient } from "@supabase/ssr";

// Browser-side Supabase client. Session is managed via HttpOnly cookies
// set by the server-side verify route — the SDK reads those cookies
// automatically. persistSession is handled by @supabase/ssr internally.
export function supabaseBrowser() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
