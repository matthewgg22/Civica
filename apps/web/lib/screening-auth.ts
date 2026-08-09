// Who is running this screening: an org member, or a guest.
//
// Two identities, deliberately kept separate rather than unified behind one
// "user" concept: an org member is a real Supabase auth session tied to
// org membership (demeter_org_members); a guest is nothing but an opaque
// signed cookie value with no account behind it at all. Access control for
// BOTH goes through these server-side checks — no screening table is ever
// exposed to anon PostgREST, matching every other Demeter table's lockdown.

import { cookies } from "next/headers";
import { randomBytes } from "node:crypto";
import { createSupabaseServerClient } from "./supabase-server";
import { supabaseAdmin } from "./supabase-server";

export const GUEST_COOKIE = "demeter_guest_token";
export const GUEST_CAP = 5;

export interface OrgIdentity {
  kind: "org";
  userId: string;
  orgId: string;
  orgName: string;
  stateCode: string;
  casePrefix: string;
}

export interface GuestIdentity {
  kind: "guest";
  guestToken: string;
  /** Screenings this token has EVER started (lifetime, not a rolling
   *  window — continuing an existing one never adds to this). */
  screeningsUsed: number;
}

export type ScreeningIdentity = OrgIdentity | GuestIdentity;

/**
 * Resolve who's asking. Tries an authenticated org member first; falls back
 * to (or creates) a guest token. Never throws — an unauthenticated,
 * cookie-less first visit becomes a fresh guest identity, which is the
 * point of anonymous-first: nobody is blocked from starting a screening.
 */
export async function resolveScreeningIdentity(): Promise<ScreeningIdentity> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const db = supabaseAdmin();
    const { data: membership } = await db
      .schema("snap_enrollment")
      .from("demeter_org_members")
      .select("org_id, demeter_orgs(name, state_code, case_label_prefix)")
      .eq("user_id", user.id)
      .maybeSingle();
    if (membership?.org_id) {
      // Supabase's typed join returns an array or object depending on the
      // relationship shape; normalize defensively rather than assume.
      const org = Array.isArray(membership.demeter_orgs)
        ? membership.demeter_orgs[0]
        : membership.demeter_orgs;
      if (org) {
        return {
          kind: "org",
          userId: user.id,
          orgId: membership.org_id as string,
          orgName: org.name as string,
          stateCode: org.state_code as string,
          casePrefix: org.case_label_prefix as string,
        };
      }
    }
    // Authenticated but not (yet) attached to an org — treat as guest rather
    // than fail; org onboarding is a separate flow (mockup's "Request access").
  }

  return resolveGuestIdentity();
}

async function resolveGuestIdentity(): Promise<GuestIdentity> {
  const jar = await cookies();
  let token = jar.get(GUEST_COOKIE)?.value;
  if (!token) {
    token = randomBytes(16).toString("hex");
    jar.set(GUEST_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 365, // a year — a guest's quota is lifetime, so the cookie should outlive a session
      path: "/",
    });
  }

  let screeningsUsed = 0;
  try {
    const db = supabaseAdmin();
    const { data, error } = await db
      .schema("snap_enrollment")
      .rpc("demeter_guest_screening_count", { p_guest_token: token });
    if (error) throw error;
    screeningsUsed = Number(data ?? 0);
  } catch {
    // Store unreachable — fail OPEN on the read (don't block a guest from
    // continuing to chat) but the CREATE path re-checks independently before
    // ever inserting a new row, so this can't be used to bypass the cap.
    screeningsUsed = 0;
  }

  return { kind: "guest", guestToken: token, screeningsUsed };
}
