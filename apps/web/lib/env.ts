// Typed access to the env vars used by the B2C web app. Throws at the
// boundary if a required public var is missing, so we surface config
// problems before they manifest as a confusing 401 from Supabase or a
// network error from the gateway.

export function publicEnv() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const enrollmentApiUrl = process.env.NEXT_PUBLIC_ENROLLMENT_API_URL;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Missing Supabase config: set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
  }

  return {
    supabaseUrl,
    supabaseAnonKey,
    // Gateway URL is allowed to be unset in marketing-only deploys; callers
    // that need it should check explicitly. We don't throw here because the
    // landing page should still render without it.
    enrollmentApiUrl: enrollmentApiUrl ?? null,
  };
}

export function requireEnrollmentApiUrl(): string {
  const { enrollmentApiUrl } = publicEnv();
  if (!enrollmentApiUrl) {
    throw new Error(
      "Missing NEXT_PUBLIC_ENROLLMENT_API_URL — set this to the Hono gateway origin so the web app can submit packets.",
    );
  }
  return enrollmentApiUrl;
}
