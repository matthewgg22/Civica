// Role-based routing for the navigator dashboard.
//
// Two role tiers:
//   • Operational  — navigator, supervisor, admin. Full access to all staff
//                    routes. Default home: /packets.
//   • Audience     — state_deputy, county_director, cbo_preview. Restricted
//                    to ONE assigned route each. Created for T5 — the
//                    three-audience view (CDSS state deputy / county DPSS
//                    director / prospective CBO licensee). A county director
//                    should not see the navigator queue and vice versa.
//
// Source of truth for role names and per-role allowlists. Middleware and
// per-route server components both import from here so they can't drift.

export const STAFF_ROLES = new Set<string>([
  // Operational
  "navigator",
  "supervisor",
  "admin",
  // T5 audience views
  "state_deputy",
  "county_director",
  "cbo_preview",
]);

export const ROLE_HOMES: Record<string, string> = {
  // Navigators land on the queue-driven daily-driver, not the browse-everything
  // view. /outreach is "what do I do next?"; /packets is "browse everything".
  // Supervisors stay on /packets — they do cohort review, not queue work.
  // Admin stays on /packets — broadest view for full-access roles.
  navigator: "/outreach",
  supervisor: "/packets",
  admin: "/packets",
  state_deputy: "/cdss",
  county_director: "/county",
  cbo_preview: "/cbo-preview",
};

// Restricted roles can ONLY access these prefixes (plus PUBLIC_PREFIXES).
// Absent from this map = operational role with full access.
const RESTRICTED_ROLE_ALLOWED_PREFIXES: Record<string, string[]> = {
  state_deputy: ["/cdss"],
  county_director: ["/county"],
  cbo_preview: ["/cbo-preview"],
};

// Always allowed regardless of role. Auth/sign-out and API routes must
// remain reachable so users can recover from a stuck session and so the
// app's internal API calls aren't blocked.
const PUBLIC_PREFIXES = ["/auth/", "/api/", "/login", "/qc"];

// Routes that bypass auth entirely — no Supabase session required.
// Reserved for shareable public artifacts (e.g. per-county compliance briefs
// that procurement officers forward to council members). Resolved in
// middleware BEFORE supabase.auth.getUser() so the page renders to anyone.
//
// IMPORTANT: keep this list tight. Adding a prefix here removes the staff
// gate for every nested route. /compliance itself is intentionally NOT
// public — only /compliance/county/* is shareable.
const FULLY_PUBLIC_PREFIXES = ["/compliance/county/"];

/**
 * True if `path` should be served without any auth gate.
 * Used by middleware to short-circuit before the Supabase round-trip.
 */
export function isPubliclyAccessible(path: string): boolean {
  return FULLY_PUBLIC_PREFIXES.some((prefix) => path.startsWith(prefix));
}

export function isStaff(role: unknown): role is string {
  return typeof role === "string" && STAFF_ROLES.has(role);
}

export function homeForRole(role: string): string {
  return ROLE_HOMES[role] ?? "/packets";
}

/**
 * True if `role` is allowed to access `path`.
 *
 * Operational roles (navigator/supervisor/admin): full access.
 * Audience roles (state_deputy/county_director/cbo_preview): only their
 *   assigned route + public prefixes.
 */
export function isPathAllowedForRole(path: string, role: string): boolean {
  if (PUBLIC_PREFIXES.some((p) => path === p || path.startsWith(p))) return true;
  const allowed = RESTRICTED_ROLE_ALLOWED_PREFIXES[role];
  if (!allowed) return true; // operational role
  return allowed.some((prefix) => path === prefix || path.startsWith(prefix + "/"));
}
