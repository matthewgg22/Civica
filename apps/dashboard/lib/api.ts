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
  },
};
