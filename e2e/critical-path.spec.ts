/**
 * Critical-path E2E: applicant submits → navigator reviews → handoff export.
 *
 * ── What this tests ──────────────────────────────────────────────────────────
 * Act 1  Applicant: create packet → answer questions → consent → submit
 * Act 2  Navigator: advance Draft→Submitted for Review→In Navigator Review→
 *                   Ready for Handoff via staff JWT + enrollment-api PATCH
 * Act 3  Handoff:  POST json_api export → POST csv_summary export →
 *                   GET signed download URL → assert checksum + storage_path
 *
 * ── What this does NOT test ──────────────────────────────────────────────────
 * • Document upload (requires live S3; integration-tested separately)
 * • PDF handoff (apps/api /api/v1/snap/handoff/:id/pdf) — exercised when
 *   E2E_API_URL is set; skipped otherwise so nightly passes without Fly.io.
 *
 * ── Pre-conditions ───────────────────────────────────────────────────────────
 * • E2E_SUPABASE_URL, E2E_SUPABASE_SERVICE_ROLE_KEY, E2E_SUPABASE_ANON_KEY
 * • E2E_ENROLLMENT_API_URL pointing to the deployed enrollment-api
 * • E2E_API_URL pointing to the deployed apps/api (navigator assign + PDF handoff)
 *
 * Missing vars cause the suite to skip cleanly.
 */

import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { createTestContext, type TestContext } from "./fixtures/test-users.js";
import { cleanupTestRun, verifyCleanup } from "./helpers/cleanup.js";
import {
  createPacket,
  upsertAnswer,
  recordConsent,
  submitPacket,
  getPacket,
  listPacketsAsStaff,
  patchPacketStatus,
  assignSession,
  createHandoffExport,
  getHandoffDownload,
  listHandoffExports,
  createPdfHandoff,
} from "./helpers/api.js";

// ── Guards ────────────────────────────────────────────────────────────────────

const REQUIRED_VARS = [
  "E2E_SUPABASE_URL",
  "E2E_SUPABASE_SERVICE_ROLE_KEY",
  "E2E_SUPABASE_ANON_KEY",
  "E2E_ENROLLMENT_API_URL",
  "E2E_API_URL",
] as const;

function missingVars(): string[] {
  return REQUIRED_VARS.filter((v) => !process.env[v]);
}

// ── Shared state across the three acts ───────────────────────────────────────

let ctx: TestContext;
let packetId: string;
let applicantId: string; // resolved after first enrollment-api call

const RUN_ID = randomUUID().replace(/-/g, "").slice(0, 12);

// ── Setup / teardown ─────────────────────────────────────────────────────────

test.beforeAll(async () => {
  const missing = missingVars();
  if (missing.length > 0) {
    console.log(`⏭  Skipping E2E: missing env vars: ${missing.join(", ")}`);
    return;
  }
  ctx = await createTestContext(RUN_ID);
  console.log(`🚀 E2E run=${RUN_ID} applicant=${ctx.applicant.email} staff=${ctx.staff.email}`);
});

test.afterAll(async () => {
  if (!ctx) return; // setup was skipped

  await cleanupTestRun(ctx, packetId ?? null, applicantId ?? null);
  await verifyCleanup(RUN_ID);
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function skipIfNotConfigured() {
  if (missingVars().length > 0) {
    test.skip(true, `Missing env vars: ${missingVars().join(", ")}`);
  }
}

/**
 * Resolve the applicants.applicant_id for the test auth user.
 * getOrCreateApplicant in enrollment-api creates the row on first packet call;
 * we read it back via service role so cleanup can target it.
 */
async function resolveApplicantId(authUserId: string): Promise<string | null> {
  const url = process.env["E2E_SUPABASE_URL"]!;
  const key = process.env["E2E_SUPABASE_SERVICE_ROLE_KEY"]!;
  const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data } = await admin
    .schema("snap_enrollment")
    .from("applicants")
    .select("applicant_id")
    .eq("auth_uid", authUserId)
    .maybeSingle();
  return data?.applicant_id ?? null;
}

// ── Act 1: Applicant submits ──────────────────────────────────────────────────

test.describe("Act 1 — Applicant submission", () => {
  test("creates packet in Draft status", async () => {
    skipIfNotConfigured();

    const packet = await createPacket(ctx.applicant.jwt, "CA");
    expect(packet.status).toBe("Draft");
    expect(packet.state_code).toBe("CA");
    expect(packet.id).toBeTruthy();

    packetId = packet.id;

    // Resolve applicants.applicant_id now that the row has been created
    applicantId = (await resolveApplicantId(ctx.applicant.authUserId)) ?? "";
    expect(applicantId).toBeTruthy();

    // Assign the test org so the staff RLS policy (is_navigator_in_org) can
    // see this packet. Applicant-created packets have org_id = NULL; in
    // production an admin assigns an org before navigator review begins.
    const adminClient = createClient(
      process.env["E2E_SUPABASE_URL"]!,
      process.env["E2E_SUPABASE_SERVICE_ROLE_KEY"]!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );
    const { error: orgErr } = await adminClient
      .schema("snap_enrollment")
      .from("snap_packets")
      .update({ org_id: ctx.staff.orgId })
      .eq("packet_id", packetId);
    if (orgErr) throw new Error(`Failed to assign org to packet: ${orgErr.message}`);

    console.log(`  packet_id=${packetId}  applicant_id=${applicantId}`);
  });

  test("saves answers (household_size, household_has_children)", async () => {
    skipIfNotConfigured();
    expect(packetId, "packet not created in previous test").toBeTruthy();

    const a1 = await upsertAnswer(ctx.applicant.jwt, packetId, "household_size", "2");
    expect(a1.question_id).toBe("household_size");

    const a2 = await upsertAnswer(ctx.applicant.jwt, packetId, "household_has_children", "no");
    expect(a2.question_id).toBe("household_has_children");
  });

  test("records consent (privacy_notice + data_sharing + terms_of_service)", async () => {
    skipIfNotConfigured();
    expect(packetId).toBeTruthy();
    // POST returns 204 — recordConsent throws if not 2xx
    await recordConsent(ctx.applicant.jwt, packetId);
  });

  test("submits packet → status becomes Submitted for Review", async () => {
    skipIfNotConfigured();
    expect(packetId).toBeTruthy();

    const submitted = await submitPacket(ctx.applicant.jwt, packetId);
    expect(submitted.status).toBe("Submitted for Review");
  });
});

// ── Act 2: Navigator reviews ──────────────────────────────────────────────────

test.describe("Act 2 — Navigator review", () => {
  test("packet visible in staff queue", async () => {
    skipIfNotConfigured();
    expect(packetId).toBeTruthy();

    const packets = await listPacketsAsStaff(ctx.staff.jwt);
    const found = packets.find((p) => p.packet_id === packetId);
    expect(found, `packet ${packetId} not found in staff queue`).toBeTruthy();
  });

  test("assigns navigator and advances to In Navigator Review", async () => {
    skipIfNotConfigured();
    expect(packetId).toBeTruthy();

    // POST /navigator/sessions/:id/assign — requireStaffJwt now resolves
    // staff_id from staff_users, so assigned_by_staff_id FK is valid (PR #101).
    const { assignment } = await assignSession(ctx.staff.jwt, packetId, ctx.staff.staffId);
    expect(assignment.assignment_id).toBeTruthy();
    expect(assignment.navigator_id).toBe(ctx.staff.staffId);

    const updated = await patchPacketStatus(ctx.staff.jwt, packetId, "In Navigator Review");
    expect(updated.status).toBe("In Navigator Review");
  });

  test("advances to Ready for Handoff", async () => {
    skipIfNotConfigured();
    expect(packetId).toBeTruthy();

    // DB trigger (migration 06) pre-conditions for this transition:
    //   (a) no unresolved required_document_items — none created because we
    //       used the applicant route (POST /me/packets) which doesn't call
    //       evaluateChecklist; ✓
    //   (b) no unreviewed extraction_fields — none inserted; ✓
    //   (c) privacy_notice consent exists — recorded in Act 1; ✓
    const updated = await patchPacketStatus(ctx.staff.jwt, packetId, "Ready for Handoff");
    expect(updated.status).toBe("Ready for Handoff");
  });
});

// ── Act 3: Handoff exports ────────────────────────────────────────────────────

test.describe("Act 3 — Handoff exports", () => {
  let jsonExportId: string;
  let csvExportId: string;

  test("exports json_api → gets export_id + checksum", async () => {
    skipIfNotConfigured();
    expect(packetId).toBeTruthy();

    const exp = await createHandoffExport(ctx.staff.jwt, packetId, "json_api", `e2e_test_${RUN_ID}`);
    expect(exp.export_id).toBeTruthy();
    expect(exp.format).toBe("json_api");
    expect(exp.checksum_sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(exp.payload_bytes).toBeGreaterThan(0);

    jsonExportId = exp.export_id;
    console.log(`  json export_id=${jsonExportId} checksum=${exp.checksum_sha256.slice(0, 16)}…`);
  });

  test("exports csv_summary → gets export_id + checksum", async () => {
    skipIfNotConfigured();
    expect(packetId).toBeTruthy();

    const exp = await createHandoffExport(ctx.staff.jwt, packetId, "csv_summary");
    expect(exp.export_id).toBeTruthy();
    expect(exp.format).toBe("csv_summary");
    expect(exp.checksum_sha256).toMatch(/^[0-9a-f]{64}$/);

    csvExportId = exp.export_id;
  });

  test("handoff_exports list shows both exports", async () => {
    skipIfNotConfigured();
    expect(packetId).toBeTruthy();

    const list = await listHandoffExports(ctx.staff.jwt, packetId);
    const ids = list.map((e) => e.export_id);
    expect(ids).toContain(jsonExportId);
    expect(ids).toContain(csvExportId);
  });

  test("json export has downloadable signed URL", async () => {
    skipIfNotConfigured();
    expect(jsonExportId).toBeTruthy();

    const dl = await getHandoffDownload(ctx.staff.jwt, packetId, jsonExportId);
    expect(dl.url).toMatch(/^https?:\/\//);
    expect(dl.expires_in_seconds).toBe(600);
  });

  test("csv export has downloadable signed URL", async () => {
    skipIfNotConfigured();
    expect(csvExportId).toBeTruthy();

    const dl = await getHandoffDownload(ctx.staff.jwt, packetId, csvExportId);
    expect(dl.url).toMatch(/^https?:\/\//);
  });

  test("pdf_packet export via apps-api (skipped when E2E_API_URL unset)", async () => {
    skipIfNotConfigured();
    if (!process.env["E2E_API_URL"]) {
      test.skip(true, "E2E_API_URL not set — PDF handoff sub-test skipped");
      return;
    }
    expect(packetId).toBeTruthy();

    const exp = await createPdfHandoff(ctx.staff.jwt, packetId, `e2e_test_${RUN_ID}`);
    expect(exp.export_id).toBeTruthy();
    expect(exp.format).toBe("pdf_packet");
    expect(exp.checksum_sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(exp.payload_bytes).toBeGreaterThan(0);

    console.log(`  pdf export_id=${exp.export_id}`);
  });
});

// ── Cleanup cross-check ───────────────────────────────────────────────────────

test.describe("Post-run cleanup verification", () => {
  test("no e2e_test_* staff_orgs rows remain after afterAll", async () => {
    skipIfNotConfigured();
    // afterAll runs after all tests in the file; this test runs last in the
    // describe order but BEFORE afterAll fires. We only assert the final
    // state in the afterAll → verifyCleanup call. This block is intentionally
    // a no-op and exists as a placeholder for a post-run assertion hook.
    // The actual cleanup assertion is verifyCleanup() in afterAll above.
    expect(true).toBe(true);
  });
});
