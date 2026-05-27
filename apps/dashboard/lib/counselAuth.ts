// Counsel authorization helper.
//
// Companion to supabase/migrations/20260594_regops_counsel_role.sql.
// Counsel reviewers (state policy lawyers, federal SNAP counsel, FTC
// marketing counsel) authenticate via the standard dashboard auth flow
// and gain access to /regops/* via two things:
//
//   1. A 'counsel' role in roleRouting.STAFF_ROLES (this lets them
//      reach /regops/* through the middleware allowlist).
//   2. At least one active row in regops.counsel_assignments naming
//      a domain (federal | CA | MA | FTC). The RLS policies on
//      regops.source_audit_log + future counsel-queue tables read
//      this table to scope what each reviewer can SELECT.
//
// The split is intentional. Role = "can you reach the URL path?"
// Assignment = "what data can you see once you're there?" A reviewer
// without an assignment authenticates, reaches the queue, and sees
// nothing — no 500s, no cross-domain leakage, just an empty inbox
// with an "ask ops to assign you to a domain" message.

import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * The four domains a counsel reviewer can be assigned to. Mirrors the
 * `regops.counsel_domain` postgres enum + the source-adapter registry.
 */
export type CounselDomain = "federal" | "CA" | "MA" | "FTC";

export const COUNSEL_DOMAINS: readonly CounselDomain[] = ["federal", "CA", "MA", "FTC"] as const;

export interface CounselAssignment {
  readonly assignment_id: string;
  readonly user_id: string;
  readonly domain: CounselDomain;
  readonly assigned_at: string;
  readonly revoked_at: string | null;
}

/**
 * Minimal Supabase client surface the helper needs. Keeps the helper
 * loosely coupled to the generated Database type (which doesn't yet
 * include the regops schema — that's a follow-up regen).
 */
interface CounselQueryClient {
  schema(name: string): {
    from(table: string): {
      select(query: string): {
        eq(column: string, value: string): {
          is(column: string, value: null): Promise<{
            data: CounselAssignment[] | null;
            error: { message: string } | null;
          }>;
        };
      };
    };
  };
}

/**
 * Return every active domain assignment for the given user. Empty
 * array means "authenticated but no domain authorization" — the queue
 * UI should render an empty inbox + onboarding message in that case,
 * NOT a 403 (the reviewer's identity is valid; they just don't have
 * data yet).
 *
 * Throws on real DB errors so the caller doesn't silently swallow an
 * RLS misconfiguration as "no assignments."
 */
export async function getActiveCounselDomains(
  supabase: SupabaseClient | CounselQueryClient,
  userId: string,
): Promise<readonly CounselDomain[]> {
  const client = supabase as unknown as CounselQueryClient;
  const { data, error } = await client
    .schema("regops")
    .from("counsel_assignments")
    .select("assignment_id, user_id, domain, assigned_at, revoked_at")
    .eq("user_id", userId)
    .is("revoked_at", null);

  if (error) {
    throw new Error(`getActiveCounselDomains: ${error.message}`);
  }
  const rows = data ?? [];
  // Defensive dedupe + filter for known domain values. The DB enum
  // should prevent unknowns, but be safe against future schema drift.
  const seen = new Set<CounselDomain>();
  for (const row of rows) {
    if (isCounselDomain(row.domain) && !seen.has(row.domain)) {
      seen.add(row.domain);
    }
  }
  return [...seen];
}

/**
 * True iff the user has at least one active assignment. Used by the
 * middleware to decide "send to /regops/queue (has assignments)" vs.
 * "send to /regops/onboarding (counsel role but no assignments yet)."
 */
export async function isActiveCounselUser(
  supabase: SupabaseClient | CounselQueryClient,
  userId: string,
): Promise<boolean> {
  const domains = await getActiveCounselDomains(supabase, userId);
  return domains.length > 0;
}

/**
 * Assert the user is active counsel for a specific domain. Returns
 * void on success; throws CounselDomainDeniedError otherwise. Used by
 * server components / route handlers that gate a single-domain view.
 */
export async function assertCounselForDomain(
  supabase: SupabaseClient | CounselQueryClient,
  userId: string,
  domain: CounselDomain,
): Promise<void> {
  const domains = await getActiveCounselDomains(supabase, userId);
  if (!domains.includes(domain)) {
    throw new CounselDomainDeniedError(userId, domain, domains);
  }
}

export class CounselDomainDeniedError extends Error {
  readonly userId: string;
  readonly requestedDomain: CounselDomain;
  readonly grantedDomains: readonly CounselDomain[];

  constructor(
    userId: string,
    requestedDomain: CounselDomain,
    grantedDomains: readonly CounselDomain[],
  ) {
    super(
      `User ${userId} requested counsel access to domain '${requestedDomain}' ` +
        `but has active assignments only for [${grantedDomains.join(", ") || "none"}].`,
    );
    this.name = "CounselDomainDeniedError";
    this.userId = userId;
    this.requestedDomain = requestedDomain;
    this.grantedDomains = grantedDomains;
  }
}

/**
 * Type guard. Public so callers receiving free-form input (e.g. a
 * route param) can narrow safely before passing to assertCounselForDomain.
 */
export function isCounselDomain(value: unknown): value is CounselDomain {
  return (
    typeof value === "string" &&
    (COUNSEL_DOMAINS as readonly string[]).includes(value)
  );
}
