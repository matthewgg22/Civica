const BASE =
  process.env.ENROLLMENT_API_URL ??
  process.env.NEXT_PUBLIC_ENROLLMENT_API_URL ??
  "http://localhost:8787";

// apps/api base URL — used for PDF generation (requires Node.js runtime)
const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

async function apiFetch(path: string, jwt: string, init?: RequestInit) {
  const res = await fetch(`${BASE}/v1/enrollment${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${jwt}`,
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API ${res.status}: ${body}`);
  }
  return res.json();
}

async function apiApiFetch(path: string, jwt: string, init?: RequestInit) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${jwt}`,
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API ${res.status}: ${body}`);
  }
  return res.json();
}

export const api = {
  packets: {
    list: (jwt: string) => apiFetch("/packets", jwt),
    get: (jwt: string, id: string) => apiFetch(`/packets/${id}`, jwt),
    create: (jwt: string, body: unknown) =>
      apiFetch("/packets", jwt, { method: "POST", body: JSON.stringify(body) }),
    update: (jwt: string, id: string, body: unknown, transitionReason?: string) =>
      apiFetch(`/packets/${id}`, jwt, {
        method: "PATCH",
        body: JSON.stringify(body),
        headers: transitionReason ? { "X-Transition-Reason": transitionReason } : {},
      }),
    history: (jwt: string, id: string) => apiFetch(`/packets/${id}/history`, jwt),
  },
  answers: {
    list: (jwt: string, packetId: string) => apiFetch(`/packets/${packetId}/answers`, jwt),
    review: (jwt: string, answerId: string, body: unknown) =>
      apiFetch(`/answers/${answerId}/review`, jwt, { method: "PATCH", body: JSON.stringify(body) }),
  },
  documents: {
    list: (jwt: string, packetId: string) => apiFetch(`/packets/${packetId}/documents`, jwt),
    uploadUrl: (jwt: string, packetId: string, filename?: string) =>
      apiFetch(`/packets/${packetId}/upload-url`, jwt, {
        method: "POST",
        body: JSON.stringify({ filename }),
      }),
    create: (
      jwt: string,
      body: {
        packet_id: string;
        applicant_id: string;
        storage_path: string;
        original_filename?: string;
        document_kind?: string;
      },
    ) => apiFetch("/documents", jwt, { method: "POST", body: JSON.stringify(body) }),
  },
  notes: {
    list: (jwt: string, packetId: string) => apiFetch(`/packets/${packetId}/notes`, jwt),
    create: (jwt: string, packetId: string, body: unknown) =>
      apiFetch(`/packets/${packetId}/notes`, jwt, { method: "POST", body: JSON.stringify(body) }),
  },
  fields: {
    list: (jwt: string, packetId: string) => apiFetch(`/packets/${packetId}/fields`, jwt),
    review: (
      jwt: string,
      fieldId: string,
      body: { navigator_confirmed_value: string; review_note?: string },
    ) =>
      apiFetch(`/fields/${fieldId}/review`, jwt, { method: "PATCH", body: JSON.stringify(body) }),
  },
  documentItems: {
    list: (jwt: string, packetId: string) =>
      apiFetch(`/packets/${packetId}/document-items`, jwt),
    resolve: (jwt: string, itemId: string, body: { resolved_document_id?: string }) =>
      apiFetch(`/document-items/${itemId}/resolve`, jwt, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    waive: (jwt: string, itemId: string, body: { waive_reason: string }) =>
      apiFetch(`/document-items/${itemId}/waive`, jwt, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
  },
  consents: {
    list: (jwt: string, applicantId: string) =>
      apiFetch(`/applicants/${applicantId}/consents`, jwt),
    record: (
      jwt: string,
      body: {
        applicant_id: string;
        consent_kind: string;
        policy_version: string;
        consent_method: string;
        ip_address?: string;
      },
    ) => apiFetch("/consents", jwt, { method: "POST", body: JSON.stringify(body) }),
  },
  handoff: {
    preview: (jwt: string, packetId: string) =>
      apiFetch(`/packets/${packetId}/handoff/preview`, jwt),
    list: (jwt: string, packetId: string) => apiFetch(`/packets/${packetId}/handoff`, jwt),
    create: (
      jwt: string,
      packetId: string,
      body: {
        format?: "json_api" | "csv_summary";
        agency_reference?: string;
      },
    ) =>
      apiFetch(`/packets/${packetId}/handoff`, jwt, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    download: (jwt: string, packetId: string, exportId: string) =>
      apiFetch(`/packets/${packetId}/handoff/${exportId}/download`, jwt),
  },
  // PDF generation is handled by apps/api (Fly Node) because @react-pdf/renderer
  // requires a Node.js runtime and cannot run on Cloudflare Workers.
  handoffPdf: {
    create: (
      jwt: string,
      packetId: string,
      body: { agency_reference?: string },
    ) =>
      apiApiFetch(`/api/v1/snap/handoff/${packetId}/pdf`, jwt, {
        method: "POST",
        body: JSON.stringify(body),
      }),
  },
  missingItems: {
    list: (jwt: string, packetId: string) =>
      apiFetch(`/packets/${packetId}/missing-items`, jwt),
    create: (
      jwt: string,
      packetId: string,
      body: {
        required_item_id?: string;
        message_ciphertext?: string;
        bump_packet_status?: boolean;
      },
    ) =>
      apiFetch(`/packets/${packetId}/missing-items`, jwt, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    cancel: (jwt: string, requestId: string) =>
      apiFetch(`/missing-items/${requestId}/cancel`, jwt, { method: "POST" }),
    resolve: (jwt: string, requestId: string) =>
      apiFetch(`/missing-items/${requestId}/resolve`, jwt, { method: "POST" }),
  },
  benefitscal: {
    // POST /v1/enrollment/benefitscal/prepare-export/:packetId
    //
    // Builds a BenefitsCalPayload snapshot from the packet, inserts a
    // benefitscal_submissions row with status='pending_review', and returns
    // the payload for navigator review before Phase 2 submission.
    prepareExport: (
      jwt: string,
      packetId: string,
      body: {
        consent_type?: "in_person" | "telephonic" | "async_portal";
        telephonic_consent_recorded_at?: string;
      } = {},
    ) =>
      apiFetch(`/benefitscal/prepare-export/${packetId}`, jwt, {
        method: "POST",
        body: JSON.stringify(body),
      }),

    // POST /v1/enrollment/benefitscal/submit/:packetId
    //
    // Triggers Phase 2 async submission via ctx.waitUntil. Requires a prior
    // 'pending_review' row from prepare-export. Returns 202 with
    // { submission_id, status: 'queued', idempotent }.
    submit: (jwt: string, packetId: string) =>
      apiFetch(`/benefitscal/submit/${packetId}`, jwt, {
        method: "POST",
        body: JSON.stringify({ confirm: true }),
      }),

    // GET /v1/enrollment/benefitscal/status/:packetId
    //
    // Returns the most recent benefitscal_submissions row for the packet.
    // 404 when no submission exists yet.
    status: (jwt: string, packetId: string) =>
      apiFetch(`/benefitscal/status/${packetId}`, jwt),
  },
  oauth: {
    // OAuth 2.0 Device Authorization Grant (RFC 8628) — Civica Submitter
    // extension. Backend: apps/enrollment-api/src/routes/oauth.ts (authed
    // router, mounted under /v1/enrollment). The org the device is bound to
    // is resolved from the caller's JWT on the server — never sent from here.
    //
    // GET /oauth/device/lookup?user_code=XXXX-XXXX
    //   Read-only. Returns { status, client_label, expires_at } for the
    //   pending device so the approval screen can render "Connect this
    //   device?". 404 when the code is unknown / expired / no longer pending.
    lookup: (jwt: string, userCode: string) =>
      apiFetch(`/oauth/device/lookup?user_code=${encodeURIComponent(userCode)}`, jwt),

    // POST /oauth/device/approve { user_code }
    //   Binds the pending device to the signed-in assister's org + staff id
    //   and marks it approved. Returns { approved: true }. 410 expired,
    //   409 already approved / no longer pending, 404 unknown.
    approve: (jwt: string, userCode: string) =>
      apiFetch("/oauth/device/approve", jwt, {
        method: "POST",
        body: JSON.stringify({ user_code: userCode }),
      }),

    // POST /oauth/device/deny { user_code }
    //   Rejects a pending device. Returns { denied: true }. 404 when the code
    //   is unknown or no longer pending.
    deny: (jwt: string, userCode: string) =>
      apiFetch("/oauth/device/deny", jwt, {
        method: "POST",
        body: JSON.stringify({ user_code: userCode }),
      }),
  },
  shelterAllocation: {
    get: (jwt: string, packetId: string) =>
      apiFetch(`/packets/${packetId}/shelter-allocation`, jwt),
    upsert: (
      jwt: string,
      packetId: string,
      body: {
        total_lease_rent_usd: number;
        allocated_rent_usd: number;
        allocation_method: "bedroom_split" | "equal_split" | "dollar_amount" | "documented_roommate_agreement";
        evidence_document_id?: string | null;
        notes?: string | null;
      },
    ) =>
      apiFetch(`/packets/${packetId}/shelter-allocation`, jwt, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    remove: (jwt: string, packetId: string) =>
      apiFetch(`/packets/${packetId}/shelter-allocation`, jwt, { method: "DELETE" }),
  },
};
