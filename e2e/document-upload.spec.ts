/**
 * Document-upload E2E: applicant uploads a PDF → navigator sees it.
 *
 * ── What this tests ───────────────────────────────────────────────────────────
 * Act 1  Applicant: create packet → request presigned upload URL →
 *                   PUT minimal PDF directly to Supabase Storage →
 *                   register document via enrollment-api POST /documents
 * Act 2  Navigator: GET /packets/:id/documents confirms the document appears
 *
 * ── Pre-conditions ────────────────────────────────────────────────────────────
 * • E2E_SUPABASE_URL, E2E_SUPABASE_SERVICE_ROLE_KEY, E2E_SUPABASE_ANON_KEY
 * • E2E_ENROLLMENT_API_URL pointing to the deployed enrollment-api
 * • The `documents` Supabase Storage bucket must exist (migration 12)
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
  requestUploadUrl,
  registerDocument,
  listDocumentsAsStaff,
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

// ── Shared state across acts ──────────────────────────────────────────────────

let ctx: TestContext;
let packetId: string;
let applicantId: string;
let documentId: string;
let storagePath: string;

const RUN_ID = randomUUID().replace(/-/g, "").slice(0, 12);

// ── Setup / teardown ──────────────────────────────────────────────────────────

test.beforeAll(async () => {
  const missing = missingVars();
  if (missing.length > 0) {
    console.log(`⏭  Skipping document-upload E2E: missing env vars: ${missing.join(", ")}`);
    return;
  }
  ctx = await createTestContext(RUN_ID);
  console.log(`🚀 document-upload run=${RUN_ID} applicant=${ctx.applicant.email}`);
});

test.afterAll(async () => {
  if (!ctx) return;

  // Remove the uploaded file from Storage so we don't accumulate test objects.
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

function skipIfNotConfigured() {
  if (missingVars().length > 0) {
    test.skip(true, `Missing env vars: ${missingVars().join(", ")}`);
  }
}

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

// ── Act 1: Applicant uploads ──────────────────────────────────────────────────

test.describe("Act 1 — Applicant uploads a PDF", () => {
  test("creates packet in Draft status", async () => {
    skipIfNotConfigured();

    const packet = await createPacket(ctx.applicant.jwt, "CA");
    expect(packet.status).toBe("Draft");
    expect(packet.id).toBeTruthy();

    packetId = packet.id;
    applicantId = (await resolveApplicantId(ctx.applicant.authUserId)) ?? "";
    expect(applicantId).toBeTruthy();

    // Assign test org so the staff RLS policy (is_navigator_in_org) can see the packet.
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

  test("requests presigned upload URL from enrollment-api", async () => {
    skipIfNotConfigured();
    expect(packetId, "packet not created in previous test").toBeTruthy();

    const result = await requestUploadUrl(ctx.applicant.jwt, packetId, "e2e_test.pdf");

    expect(result.signed_url).toMatch(/^https?:\/\//);
    expect(result.storage_path).toMatch(/\.pdf$/);
    expect(result.storage_path).toContain(packetId);

    storagePath = result.storage_path;
    console.log(`  storage_path=${storagePath}`);

    // PUT the minimal PDF directly to the Supabase Storage signed URL.
    const putRes = await fetch(result.signed_url, {
      method: "PUT",
      headers: { "Content-Type": "application/pdf" },
      body: minimalPdf(),
    });
    expect(putRes.ok, `PUT to signed URL failed: ${putRes.status} ${await putRes.text().catch(() => "")}`).toBe(true);
  });

  test("registers the document via enrollment-api POST /documents", async () => {
    skipIfNotConfigured();
    expect(packetId).toBeTruthy();
    expect(applicantId).toBeTruthy();
    expect(storagePath).toBeTruthy();

    const doc = await registerDocument(
      ctx.applicant.jwt,
      packetId,
      applicantId,
      storagePath,
      "e2e_test.pdf",
    );

    expect(doc.document_id).toBeTruthy();
    expect(doc.storage_path).toBe(storagePath);
    expect(doc.processing_status).toBeTruthy();

    documentId = doc.document_id;
    console.log(`  document_id=${documentId} status=${doc.processing_status}`);
  });
});

// ── Act 2: Navigator inbox ────────────────────────────────────────────────────

test.describe("Act 2 — Navigator inbox shows the uploaded document", () => {
  test("staff GET /packets/:id/documents returns the new document", async () => {
    skipIfNotConfigured();
    expect(packetId).toBeTruthy();
    expect(documentId).toBeTruthy();

    const docs = await listDocumentsAsStaff(ctx.staff.jwt, packetId);
    const found = docs.find((d) => d.document_id === documentId);

    expect(found, `document_id=${documentId} not found in staff document list`).toBeTruthy();
    expect(found!.storage_path).toBe(storagePath);

    console.log(`  navigator sees document_id=${documentId} status=${found!.processing_status}`);
  });
});
