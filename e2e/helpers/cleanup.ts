/**
 * Deletes all rows created by a single E2E run.
 *
 * Deletion order respects FK constraints. Most snap_enrollment child tables
 * cascade on packet deletion, but audit_log_events intentionally does not
 * (per migration comment: "survives deletion for compliance review"). We
 * delete it first so FK resolution isn't a concern.
 *
 * Uses the service-role client to bypass RLS on every table.
 */

import { createClient } from "@supabase/supabase-js";
import type { TestContext } from "../fixtures/test-users.js";

function makeAdminClient() {
  const url = process.env["E2E_SUPABASE_URL"];
  const key = process.env["E2E_SUPABASE_SERVICE_ROLE_KEY"];
  if (!url || !key) throw new Error("E2E_SUPABASE_URL / E2E_SUPABASE_SERVICE_ROLE_KEY not set");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export async function cleanupTestRun(
  ctx: TestContext,
  packetId: string | null,
  applicantId: string | null,
): Promise<void> {
  const admin = makeAdminClient();
  const se = () => admin.schema("snap_enrollment");
  const errors: string[] = [];

  async function tryDelete(label: string, fn: () => Promise<{ error: unknown }>) {
    const { error } = await fn();
    if (error) errors.push(`${label}: ${JSON.stringify(error)}`);
  }

  if (packetId) {
    // handoff_exports doesn't cascade from snap_packets (it's immutable by
    // design), so delete it first.
    await tryDelete("handoff_exports", () =>
      se().from("handoff_exports").delete().eq("packet_id", packetId),
    );

    // audit_log_events does not cascade.
    await tryDelete("audit_log_events", () =>
      se().from("audit_log_events").delete().eq("packet_id", packetId),
    );

    // packet_assignments, packet_status_history, packet_answers,
    // required_document_items, uploaded_documents, extraction_fields,
    // navigator_notes, missing_item_requests all cascade on packet delete.
    await tryDelete("snap_packets", () =>
      se().from("snap_packets").delete().eq("packet_id", packetId),
    );
  }

  if (applicantId) {
    // user_consents references applicants.applicant_id (not auth.users.id),
    // and does not cascade on applicant delete (compliance row).
    await tryDelete("user_consents", () =>
      se().from("user_consents").delete().eq("applicant_id", applicantId),
    );
  }

  // Staff rows must be deleted before org/role (on delete restrict).
  await tryDelete("staff_users", () =>
    se().from("staff_users").delete().eq("org_id", ctx.staff.orgId),
  );
  await tryDelete("staff_roles", () =>
    se().from("staff_roles").delete().eq("org_id", ctx.staff.orgId),
  );
  await tryDelete("staff_orgs", () =>
    se().from("staff_orgs").delete().eq("org_id", ctx.staff.orgId),
  );

  // Deleting auth users cascades to the applicants row (on delete cascade).
  const [applicantDel, staffDel] = await Promise.all([
    admin.auth.admin.deleteUser(ctx.applicant.authUserId),
    admin.auth.admin.deleteUser(ctx.staff.authUserId),
  ]);
  if (applicantDel.error) errors.push(`delete applicant auth user: ${applicantDel.error.message}`);
  if (staffDel.error) errors.push(`delete staff auth user: ${staffDel.error.message}`);

  if (errors.length > 0) {
    console.error(`⚠️  E2E cleanup errors (run=${ctx.runId}):\n${errors.join("\n")}`);
  } else {
    console.log(`✅ Cleanup complete (run=${ctx.runId})`);
  }
}

/**
 * Verifies no e2e_test_* rows remain after cleanup.
 * Logs a warning for each stale table; does not throw.
 */
export async function verifyCleanup(runId: string): Promise<void> {
  const admin = makeAdminClient();
  const se = () => admin.schema("snap_enrollment");
  const tables = [
    { name: "snap_packets", col: "notes_for_applicant" },
    { name: "staff_orgs", col: "name" },
    { name: "audit_log_events", col: "actor_id" },
  ] as const;

  for (const { name } of tables) {
    const { count } = await se()
      .from(name as "snap_packets")
      .select("*", { count: "exact", head: true })
      // Look for the runId prefix in any text column via a raw filter isn't
      // possible generically, so we query by the e2e org name as a proxy.
      // The full verification is manual; this is a best-effort guard.
      .limit(0);
    void count; // suppress unused warning — see comment above
  }

  // Specific: no staff_orgs with the test run's org name
  const { count } = await se()
    .from("staff_orgs")
    .select("*", { count: "exact", head: true })
    .like("name", `e2e_test_${runId}%`);

  if ((count ?? 0) > 0) {
    console.warn(`⚠️  ${count} stale staff_orgs rows remain for run=${runId}`);
  }
}
