/**
 * Typed fetch wrappers for the two backend APIs under test.
 *
 * enrollment-api (Cloudflare Workers)  → E2E_ENROLLMENT_API_URL
 * apps/api       (Fly.io / Hono Node)  → E2E_API_URL
 *
 * Each function throws if the response status is outside the caller's expected
 * range, with the response body included in the error message.
 */

function requireEnv(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`Missing required env var: ${name}`);
  return val;
}

function enrollmentUrl(path: string): string {
  const base = requireEnv("E2E_ENROLLMENT_API_URL").replace(/\/$/, "");
  return `${base}/v1/enrollment${path}`;
}

function apiUrl(path: string): string {
  const base = requireEnv("E2E_API_URL").replace(/\/$/, "");
  return `${base}${path}`;
}

async function assertOk(res: Response, label: string): Promise<Response> {
  if (!res.ok) {
    const body = await res.text().catch(() => "(unreadable body)");
    throw new Error(`${label} → ${res.status}: ${body}`);
  }
  return res;
}

function authHeaders(jwt: string): Record<string, string> {
  return {
    Authorization: `Bearer ${jwt}`,
    "Content-Type": "application/json",
  };
}

// ── Enrollment-API: applicant self-service ────────────────────────────────────

export async function createPacket(jwt: string, state_code: "CA" | "MA") {
  const res = await assertOk(
    await fetch(enrollmentUrl("/me/packets"), {
      method: "POST",
      headers: authHeaders(jwt),
      body: JSON.stringify({ state_code }),
    }),
    "POST /me/packets",
  );
  return (await res.json()) as { id: string; status: string; state_code: string };
}

export async function upsertAnswer(
  jwt: string,
  packetId: string,
  question_id: string,
  value: unknown,
) {
  const res = await assertOk(
    await fetch(enrollmentUrl(`/me/packets/${packetId}/answers`), {
      method: "POST",
      headers: authHeaders(jwt),
      body: JSON.stringify({ question_id, value }),
    }),
    `POST /me/packets/${packetId}/answers`,
  );
  return (await res.json()) as { question_id: string; value: unknown; saved_at: string };
}

export async function recordConsent(jwt: string, packetId: string) {
  const res = await fetch(enrollmentUrl(`/me/packets/${packetId}/consent`), {
    method: "POST",
    headers: authHeaders(jwt),
    body: JSON.stringify({
      signature: "e2e_test_sig",
      consented_at: new Date().toISOString(),
    }),
  });
  if (res.status !== 204 && !res.ok) {
    const body = await res.text();
    throw new Error(`POST /me/packets/${packetId}/consent → ${res.status}: ${body}`);
  }
}

export async function submitPacket(jwt: string, packetId: string) {
  const res = await assertOk(
    await fetch(enrollmentUrl(`/me/packets/${packetId}/submit`), {
      method: "POST",
      headers: authHeaders(jwt),
    }),
    `POST /me/packets/${packetId}/submit`,
  );
  return (await res.json()) as { id: string; status: string };
}

export async function getPacket(jwt: string, packetId: string) {
  const res = await assertOk(
    await fetch(enrollmentUrl(`/me/packets/${packetId}`), {
      headers: authHeaders(jwt),
    }),
    `GET /me/packets/${packetId}`,
  );
  return (await res.json()) as { id: string; status: string };
}

// ── Enrollment-API: staff routes ─────────────────────────────────────────────

export async function listPacketsAsStaff(jwt: string) {
  const res = await assertOk(
    await fetch(enrollmentUrl("/packets"), {
      headers: authHeaders(jwt),
    }),
    "GET /packets",
  );
  return (await res.json()) as Array<{ packet_id: string; status: string }>;
}

export async function patchPacketStatus(jwt: string, packetId: string, status: string) {
  const res = await assertOk(
    await fetch(enrollmentUrl(`/packets/${packetId}`), {
      method: "PATCH",
      headers: authHeaders(jwt),
      body: JSON.stringify({ status }),
    }),
    `PATCH /packets/${packetId}`,
  );
  return (await res.json()) as { packet_id: string; status: string };
}

export async function createHandoffExport(
  jwt: string,
  packetId: string,
  format: "json_api" | "csv_summary",
  agency_reference?: string,
) {
  const res = await assertOk(
    await fetch(enrollmentUrl(`/packets/${packetId}/handoff`), {
      method: "POST",
      headers: authHeaders(jwt),
      body: JSON.stringify({ format, ...(agency_reference && { agency_reference }) }),
    }),
    `POST /packets/${packetId}/handoff format=${format}`,
  );
  return (await res.json()) as {
    export_id: string;
    exported_at: string;
    format: string;
    checksum_sha256: string;
    storage_path: string | null;
    payload_bytes: number;
  };
}

export async function getHandoffDownload(jwt: string, packetId: string, exportId: string) {
  const res = await assertOk(
    await fetch(enrollmentUrl(`/packets/${packetId}/handoff/${exportId}/download`), {
      headers: authHeaders(jwt),
    }),
    `GET /packets/${packetId}/handoff/${exportId}/download`,
  );
  return (await res.json()) as { url: string; expires_in_seconds: number };
}

export async function listHandoffExports(jwt: string, packetId: string) {
  const res = await assertOk(
    await fetch(enrollmentUrl(`/packets/${packetId}/handoff`), {
      headers: authHeaders(jwt),
    }),
    `GET /packets/${packetId}/handoff`,
  );
  return (await res.json()) as Array<{
    export_id: string;
    format: string;
    checksum_sha256: string;
    storage_path: string | null;
    exported_at: string;
  }>;
}

// ── Apps-API: staff handoff PDF ───────────────────────────────────────────────

export async function createPdfHandoff(jwt: string, packetId: string, agency_reference?: string) {
  const res = await assertOk(
    await fetch(apiUrl(`/api/v1/snap/handoff/${packetId}/pdf`), {
      method: "POST",
      headers: authHeaders(jwt),
      body: JSON.stringify({ ...(agency_reference && { agency_reference }) }),
    }),
    `POST /api/v1/snap/handoff/${packetId}/pdf`,
  );
  return (await res.json()) as {
    export_id: string;
    exported_at: string;
    format: string;
    checksum_sha256: string;
    storage_path: string | null;
    payload_bytes: number;
  };
}

// ── Enrollment-API: packet assignments (service-level) ────────────────────────
// navigator.ts in apps/api has a bug where it writes c.var.staff.sub (auth UID)
// into assigned_by_staff_id, which is a FK to staff_users(staff_id) — not the
// same UUID. We bypass that endpoint and insert the assignment directly via the
// Supabase admin client in the spec setup, which ensures the correct staff_id.
// See: apps/api/src/routes/navigator.ts POST /sessions/:id/assign
