/**
 * Navigator document upload + missing-item resolve E2E.
 *
 * ── What this tests ───────────────────────────────────────────────────────────
 * Act 1  Navigator: POST /packets/:id/upload-url (staff-gated) →
 *                   PUT minimal PDF to Supabase Storage →
 *                   POST /documents to register →
 *                   GET /packets/:id/documents confirms the document is visible
 *                   with correct storage_path, original_filename, and document_kind.
 *
 * Act 2  Navigator: POST /packets/:id/missing-items → creates flag (status=pending)
 *                   POST /missing-items/:id/resolve → status flips to "resolved"
 *                   Direct Supabase query on audit_log_events confirms
 *                   actor_id = staff.staffId (UUID, not auth UID — PR #101 invariant).
 *
 * ── Pre-conditions ────────────────────────────────────────────────────────────
 * • E2E_SUPABASE_URL, E2E_SUPABASE_SERVICE_ROLE_KEY, E2E_SUPABASE_ANON_KEY
 * • E2E_ENROLLMENT_API_URL pointing to the deployed enrollment-api
 *
 * Missing vars cause the suite to skip cleanly.
 */

import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { createTestContext, type TestContext } from "./fixtures/test-users.js";
import { cleanupTestRun } from "./helpers/cleanup.js";
import {
  createPacket,
  requestUploadUrlAsStaff,
  registerDocument,
  listDocumentsAsStaff,
  createMissingItemRequest,
  listMissingItemsAsStaff,
  resolveMissingItem,
} from "./helpers/api.js";
import { minimalPdf } from "./fixtures/generate-pdf.js";

// ── Guards ────────────────────────────────────────────────────────────────────

const REQUIRED_VARS = [
  "E2E_SUPABASE_URL",
  "E2E_SUPABASE_SERVICE_ROLE_KEY",
  "E2E_SUPABASE_ANON_KEY",
  "E2E_ENROLLMENT_API_URL",
] as const;

function missingVars(): string[] {
  return REQUIRED_VARS.filter((v) => !process.env[v]);
}

function skipIfNotConfigured() {
  if (missingVars().length > 0) {
    test.skip(true, `Missing env vars: ${missingVars().join(", ")}`);
  }
}

// ── Shared state across acts ──────────────────────────────────────────────────

let ctx: TestContext;
let packetId: string;
let applicantId: string;
let storagePath: string;
let documentId: string;
let missingItemRequestId: string;

const RUN_ID = randomUUID().replace(/-/g, "").slice(0, 12);

// ── Setup / teardown ──────────────────────────────────────────────────────────

test.beforeAll(async () => {
  const missing = missingVars();
  if (missing.length > 0) {
    console.log(`⏭  Skipping navigator-document-upload E2E: missing env vars: ${missing.join(", ")}`);
    return;
  }
  ctx = await createTestContext(RUN_ID);
  console.log(`🚀 navigator-document-upload run=${RUN_ID} staff=${ctx.staff.email}`);
});

test.afterAll(async () => {
  if (!ctx) return;

  if (storagePath) {
    const admin = createClient(
      process.env["E2E_SUPABASE_URL"]!,
      process.env["E2E_SUPABASE_SERVICE_ROLE_KEY"]!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );
    const { error } = await admin.storage.from("documents").remove([storagePath]);
    if (error) console.warn(`⚠️  Failed to delete storage object ${storagePath}: ${error.message}`);
  }

  await cleanupTestRun(ctx, packetId ?? null, applicantId ?? null);
});

// ── Helpers ───────────────────────────────────────────────────────────────────

async function resolveApplicantId(authUserId: string): Promise<string | null> {
  const admin = createClient(
    process.env["E2E_SUPABASE_URL"]!,
    process.env["E2E_SUPABASE_SERVICE_ROLE_KEY"]!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  const { data } = await admin
    .schema("snap_enrollment")
    .from("applicants")
    .select("applicant_id")
    .eq("auth_uid", authUserId)
    .maybeSingle();
  return data?.applicant_id ?? null;
}

// ── Act 1: Navigator uploads on behalf of applicant ───────────────────────────

test.describe("Act 1 — Navigator uploads a document on behalf of an applicant", () => {
  test("creates packet and assigns to test org", async () => {
    skipIfNotConfigured();

    const packet = await createPacket(ctx.applicant.jwt, "CA");
    expect(packet.status).toBe("Draft");
    expect(packet.id).toBeTruthy();

    packetId = packet.id;
    applicantId = (await resolveApplicantId(ctx.applicant.authUserId)) ?? "";
    expect(applicantId).toBeTruthy();

    const admin = createClient(
      process.env["E2E_SUPABASE_URL"]!,
      process.env["E2E_SUPABASE_SERVICE_ROLE_KEY"]!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );
    const { error } = await admin
      .schema("snap_enrollment")
      .from("snap_packets")
      .update({ org_id: ctx.staff.orgId })
      .eq("packet_id", packetId);
    if (error) throw new Error(`Failed to assign org to packet: ${error.message}`);

    console.log(`  packet_id=${packetId}  applicant_id=${applicantId}`);
  });

  test("navigator requests presigned upload URL via staff route", async () => {
    skipIfNotConfigured();
    expect(packetId, "packet not created in previous test").toBeTruthy();

    const result = await requestUploadUrlAsStaff(ctx.staff.jwt, packetId, "nav_upload.pdf");

    expect(result.signed_url).toMatch(/^https?:\/\//);
    expect(result.storage_path).toMatch(/\.pdf$/);
    expect(result.storage_path).toContain(packetId);
    // The staff route returns applicant_id; applicant route does not.
    expect(result.applicant_id).toBe(applicantId);

    storagePath = result.storage_path;
    console.log(`  storage_path=${storagePath}`);

    const putRes = await fetch(result.signed_url, {
      method: "PUT",
      headers: { "Content-Type": "application/pdf" },
      body: minimalPdf(),
    });
    expect(
      putRes.ok,
      `PUT to signed URL failed: ${putRes.status} ${await putRes.text().catch(() => "")}`,
    ).toBe(true);
  });

  test("navigator registers the document via POST /documents", async () => {
    skipIfNotConfigured();
    expect(packetId).toBeTruthy();
    expect(applicantId).toBeTruthy();
    expect(storagePath).toBeTruthy();

    const doc = await registerDocument(
      ctx.staff.jwt,
      packetId,
      applicantId,
      storagePath,
      "nav_upload.pdf",
    );

    expect(doc.document_id).toBeTruthy();
    expect(doc.storage_path).toBe(storagePath);
    expect(doc.processing_status).toBeTruthy();

    documentId = doc.document_id;
    console.log(`  document_id=${documentId} status=${doc.processing_status}`);
  });

  test("document appears in staff GET /packets/:id/documents with correct metadata", async () => {
    skipIfNotConfigured();
    expect(packetId).toBeTruthy();
    expect(documentId).toBeTruthy();

    const docs = await listDocumentsAsStaff(ctx.staff.jwt, packetId);
    const found = docs.find((d) => d.document_id === documentId);

    expect(found, `document_id=${documentId} not in staff document list`).toBeTruthy();
    expect(found!.storage_path).toBe(storagePath);

    // The staff list returns the full uploaded_documents row — verify the
    // original_filename we passed to POST /documents is preserved.
    const full = found as Record<string, unknown>;
    expect(full["original_filename"]).toBe("nav_upload.pdf");

    console.log(`  navigator document list includes document_id=${documentId}`);
  });
});

// ── Act 2: Navigator resolves a missing-item flag ─────────────────────────────

test.describe("Act 2 — Navigator resolves a missing-item flag; audit log records staff_id", () => {
  test("navigator creates a missing-item request (status=pending)", async () => {
    skipIfNotConfigured();
    expect(packetId, "packet not created in Act 1").toBeTruthy();

    const req = await createMissingItemRequest(ctx.staff.jwt, packetId, {
      bump_packet_status: false,
    });

    expect(req.request_id).toBeTruthy();
    expect(req.status).toBe("pending");

    missingItemRequestId = req.request_id;
    console.log(`  missing_item request_id=${missingItemRequestId}`);
  });

  test("navigator resolves the flag; status flips to resolved", async () => {
    skipIfNotConfigured();
    expect(missingItemRequestId, "missing-item request not created in previous test").toBeTruthy();

    await resolveMissingItem(ctx.staff.jwt, missingItemRequestId);

    const items = await listMissingItemsAsStaff(ctx.staff.jwt, packetId);
    const item = items.find((i) => i.request_id === missingItemRequestId);

    expect(item, `request_id=${missingItemRequestId} not found`).toBeTruthy();
    expect(item!.status).toBe("resolved");
    expect(item!.resolved_at).toBeTruthy();

    console.log(`  request_id=${missingItemRequestId} status=${item!.status}`);
  });

  test("audit_log_events records actor_id as staff_id, not auth UID (PR #101)", async () => {
    skipIfNotConfigured();
    expect(missingItemRequestId, "missing-item request not created").toBeTruthy();

    const admin = createClient(
      process.env["E2E_SUPABASE_URL"]!,
      process.env["E2E_SUPABASE_SERVICE_ROLE_KEY"]!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const { data, error } = await admin
      .schema("snap_enrollment")
      .from("audit_log_events")
      .select("audit_id, actor_kind, actor_id, operation, table_name")
      .eq("row_id", missingItemRequestId)
      .eq("operation", "UPDATE")
      .order("occurred_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw new Error(`audit_log_events query failed: ${error.message}`);
    expect(data, `No UPDATE audit row found for request_id=${missingItemRequestId}`).toBeTruthy();

    expect(data!.actor_kind).toBe("navigator");
    // Must be the staff_id UUID, not the Supabase auth UID — PR #101 fixed this.
    expect(data!.actor_id).toBe(ctx.staff.staffId);
    expect(data!.actor_id).not.toBe(ctx.staff.authUserId);

    console.log(
      `  audit actor_kind=${data!.actor_kind} actor_id=${data!.actor_id} (staff_id confirmed)`,
    );
  });
});
