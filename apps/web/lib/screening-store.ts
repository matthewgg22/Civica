// Load/save a screening case file. Thin persistence over
// snap_enrollment.demeter_screenings — the actual screening LOGIC lives in
// @civica/demeter-engine's screenHousehold; this only reads/writes rows and
// enforces who is allowed to touch which row.

import type { PartialFacts } from "@civica/demeter-engine";
import { supabaseAdmin } from "./supabase-server";
import { GUEST_CAP, type ScreeningIdentity } from "./screening-auth";

export interface ScreeningMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ScreeningRow {
  id: string;
  caseLabel: string | null;
  stateCode: string;
  facts: PartialFacts;
  messages: ScreeningMessage[];
  outcome: string | null;
  status: "active" | "exported";
}

/** Ownership check baked into every query: an org screening is visible only
 *  to that org; a guest screening only to the exact token that created it.
 *  There is no path that lets one guest read another's case. */
function scopeFilter(identity: ScreeningIdentity) {
  return identity.kind === "org"
    ? { column: "org_id", value: identity.orgId }
    : { column: "guest_token", value: identity.guestToken };
}

export async function loadScreening(
  id: string,
  identity: ScreeningIdentity,
): Promise<ScreeningRow | null> {
  const db = supabaseAdmin();
  const scope = scopeFilter(identity);
  const { data, error } = await db
    .schema("snap_enrollment")
    .from("demeter_screenings")
    .select("id, case_label, state_code, facts, messages, outcome, status")
    .eq("id", id)
    .eq(scope.column, scope.value)
    .maybeSingle();
  if (error || !data) return null;
  return {
    id: data.id as string,
    caseLabel: data.case_label as string | null,
    stateCode: data.state_code as string,
    facts: (data.facts as PartialFacts) ?? {},
    messages: (data.messages as ScreeningMessage[]) ?? [],
    outcome: data.outcome as string | null,
    status: data.status as "active" | "exported",
  };
}

export class GuestCapReachedError extends Error {
  constructor() {
    super(`Guest screening cap reached (${GUEST_CAP})`);
  }
}

/** Create a new screening. Enforces the guest lifetime cap HERE, immediately
 *  before the insert — resolveScreeningIdentity's own count is read-only and
 *  fails open, so this is the actual gate; nothing can create a 6th guest
 *  screening no matter what the identity resolver reported. */
export async function createScreening(
  identity: ScreeningIdentity,
  stateCode: string,
): Promise<ScreeningRow> {
  const db = supabaseAdmin();

  if (identity.kind === "guest") {
    const { data: countData, error: countErr } = await db
      .schema("snap_enrollment")
      .rpc("demeter_guest_screening_count", { p_guest_token: identity.guestToken });
    if (countErr) throw countErr;
    if (Number(countData ?? 0) >= GUEST_CAP) throw new GuestCapReachedError();
  }

  let caseLabel: string | null = null;
  if (identity.kind === "org") {
    const { data, error } = await db
      .schema("snap_enrollment")
      .rpc("demeter_next_case_label", { p_org_id: identity.orgId });
    if (error) throw error;
    caseLabel = data as string;
  }

  const { data, error } = await db
    .schema("snap_enrollment")
    .from("demeter_screenings")
    .insert({
      case_label: caseLabel,
      org_id: identity.kind === "org" ? identity.orgId : null,
      created_by: identity.kind === "org" ? identity.userId : null,
      guest_token: identity.kind === "guest" ? identity.guestToken : null,
      state_code: stateCode,
      facts: {},
      messages: [],
    })
    .select("id, case_label, state_code, facts, messages, outcome, status")
    .single();
  if (error || !data) throw error ?? new Error("insert returned no row");

  return {
    id: data.id as string,
    caseLabel: data.case_label as string | null,
    stateCode: data.state_code as string,
    facts: {},
    messages: [],
    outcome: null,
    status: "active",
  };
}

export async function saveScreeningTurn(
  id: string,
  identity: ScreeningIdentity,
  patch: { facts: PartialFacts; messages: ScreeningMessage[]; outcome: string },
): Promise<void> {
  const db = supabaseAdmin();
  const scope = scopeFilter(identity);
  await db
    .schema("snap_enrollment")
    .from("demeter_screenings")
    .update({
      facts: patch.facts,
      messages: patch.messages,
      outcome: patch.outcome,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq(scope.column, scope.value);
}
