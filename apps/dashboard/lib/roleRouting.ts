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
  // Civica-internal corporate monetization dashboard access (/ops).
  // Set manually via Supabase admin — no self-serve.
  // See ceo-plans/2026-05-25-ebt-monetization-dashboard.md.
  "operator",
  // RegOps Engine counsel reviewers (external lawyers). Domain
  // scoping (federal / CA / MA / FTC) is enforced by RLS reading
  // regops.counsel_assignments — see
  // supabase/migrations/20260594_regops_counsel_role.sql and
  // apps/dashboard/lib/counselAuth.ts. The role gate here only
  // controls URL-path access (/regops/*); a counsel user with the
  // role but no domain assignment sees an empty inbox, not a 403.
  "counsel",
  // Partner-CBO assisters (Mode B). Restricted to /cbo; org-scoped to their
  // own CBO's packets via RLS (is_navigator_in_org includes cbo_assister —
  // see supabase/migrations/20260608_cbo_assister_rls.sql). Navigator/admin
  // (Civica staff, Mode A) reach /cbo too via their full operational access.
  "cbo_assister",
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
  operator: "/ops",
  counsel: "/regops/queue",
  cbo_assister: "/cbo",
};

// Restricted roles can ONLY access these prefixes (plus PUBLIC_PREFIXES).
// Absent from this map = operational role with full access.
const RESTRICTED_ROLE_ALLOWED_PREFIXES: Record<string, string[]> = {
  state_deputy: ["/cdss"],
  county_director: ["/county"],
  cbo_preview: ["/cbo-preview"],
  operator: ["/ops"],
  // Counsel reviewers can ONLY see /regops/*. They are external
  // attorneys and must not see operational staff routes, audience
  // routes, or the corporate /ops dashboard.
  counsel: ["/regops"],
  // Partner-CBO assisters see ONLY their authenticated CBO workspace. Real
  // applicant PII lives here (org-scoped by RLS), so the path gate is tight —
  // they must not reach the navigator queue, audience views, or /ops.
  cbo_assister: ["/cbo"],
};

// /ops is operator-ONLY — even operational roles (navigator/supervisor/admin)
// must not see it. The standard "operational role has full access" pattern
// would otherwise leak the corporate monetization dashboard to staff who
// shouldn't see it. Enforced via isOpsRouteAllowed() before the standard
// allowlist check.
const OPS_PREFIX = "/ops";

/**
 * True if `role` is allowed to access `/ops/*`.
 *
 * Operational staff (navigator/supervisor/admin) + the dedicated `operator`
 * role all have access — /ops is the internal corporate dashboard.
 *
 * Audience roles (county_director, state_deputy, cbo_preview) are blocked.
 * They are B2G / external-facing identities and must not see partner-offer
 * P&L or notification-outlay — that's the audience-segregation guard from
 * the CEO plan D10/D13 decisions.
 */
export function isOpsRouteAllowed(role: string): boolean {
  return role === "operator"
      || role === "admin"
      || role === "navigator"
      || role === "supervisor";
}

// Always allowed regardless of role. Auth/sign-out and API routes must
// remain reachable so users can recover from a stuck session and so the
// app's internal API calls aren't blocked.
const PUBLIC_PREFIXES = ["/auth/", "/api/", "/login", "/sign-up", "/qc"];

// Routes that bypass auth entirely — no Supabase session required.
// Reserved for shareable public artifacts and outbound sales surfaces.
// Resolved in middleware BEFORE supabase.auth.getUser() so the page
// renders to anyone — including procurement officers, council members,
// and prospective CBO buyers who do not have a Civica account.
//
// Current public surfaces:
//   • /compliance/county/* — per-county compliance briefs (B2G share-out)
//   • /county-demo/*       — county-facing demo URL (B2G outbound)
//   • /cbo-preview         — CBO partnership landing page (B2B outbound)
//
// IMPORTANT: keep this list tight. Adding a prefix here removes the staff
// gate for every nested route. /compliance itself is intentionally NOT
// public — only /compliance/county/* is shareable.
const FULLY_PUBLIC_PREFIXES = [
  "/compliance/county/",
  "/county-demo",
  "/cbo-preview",
  // Demo packet detail pages — IDs begin with `demo-pkt-` and are served
  // from in-memory fixtures via getDemoPacketDetail() (see lib/demo-data.ts).
  // Real packets use UUIDs, so this prefix cannot match a production row.
  // Lets the public /cbo-preview queue link directly into the navigator
  // review surface without exposing real packet data.
  "/packets/demo-pkt-",
  // Findings ledger — public read-only surface over docs/findings/*.md.
  // Each finding has an evidence trail; the index is intentionally
  // shareable so a county / CBO / counsel reader can land on a specific
  // analytical claim via OG-card'd URL (e.g. /findings/2026-05-28-…).
  // No auth, no Supabase round-trip; all data comes from build-time
  // markdown reads via apps/dashboard/lib/findings.ts.
  "/findings",
];

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
  // /ops/* is operator-ONLY, even for operational roles with otherwise full access.
  if (path === OPS_PREFIX || path.startsWith(OPS_PREFIX + "/")) {
    return isOpsRouteAllowed(role);
  }
  if (PUBLIC_PREFIXES.some((p) => path === p || path.startsWith(p))) return true;
  const allowed = RESTRICTED_ROLE_ALLOWED_PREFIXES[role];
  if (!allowed) return true; // operational role
  return allowed.some((prefix) => path === prefix || path.startsWith(prefix + "/"));
}
