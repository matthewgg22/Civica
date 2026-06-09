// TypeScript mirror of HTTPEnrollmentAPIClient.swift. Every method here
// targets the same path on the Hono gateway that iOS targets.
//
// We do NOT expose a browser-side client because the access token is
// HttpOnly. Browser code hits Next.js Route Handlers under /api/enrollment/*
// which forward to the gateway server-side.

import { requireEnrollmentApiUrl } from "../env";
import { currentAccessToken } from "../supabase-server";
import type {
  EnrollmentPacket,
  EnrollmentDocument,
  EnrollmentInboxItem,
  DocumentKind,
} from "./types";

export class EnrollmentAPIError extends Error {
  constructor(
    public status: number,
    public body: string,
    message?: string,
  ) {
    super(message ?? `Enrollment API error ${status}: ${body}`);
    this.name = "EnrollmentAPIError";
  }
}

function gatewayURL(path: string): string {
  const base = requireEnrollmentApiUrl();
  // Append the versioned prefix once — iOS does the same in
  // HTTPEnrollmentAPIClient.resolveBaseURL.
  const root = base.replace(/\/$/, "");
  return `${root}/v1/enrollment${path}`;
}

function makeClient(getToken: () => Promise<string | null>) {
  async function authHeader(): Promise<Record<string, string>> {
    const token = await getToken();
    if (!token) throw new EnrollmentAPIError(401, "", "Unauthenticated");
    return { Authorization: `Bearer ${token}` };
  }

  async function getJSON<R>(path: string): Promise<R> {
    const res = await fetch(gatewayURL(path), {
      method: "GET",
      headers: { ...(await authHeader()), Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) throw new EnrollmentAPIError(res.status, await res.text());
    return (await res.json()) as R;
  }

  async function postJSON<R>(path: string, body?: unknown): Promise<R> {
    const res = await fetch(gatewayURL(path), {
      method: "POST",
      headers: {
        ...(await authHeader()),
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
    });
    if (!res.ok) throw new EnrollmentAPIError(res.status, await res.text());
    if (res.status === 204) return undefined as unknown as R;
    return (await res.json()) as R;
  }

  async function patchJSON<R>(
    path: string,
    body: unknown,
    extraHeaders: Record<string, string> = {},
  ): Promise<R> {
    const res = await fetch(gatewayURL(path), {
      method: "PATCH",
      headers: {
        ...(await authHeader()),
        Accept: "application/json",
        "Content-Type": "application/json",
        ...extraHeaders,
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    if (!res.ok) throw new EnrollmentAPIError(res.status, await res.text());
    return (await res.json()) as R;
  }

  return {
    // Packets

    async createPacket(stateCode: string): Promise<EnrollmentPacket> {
      return postJSON<EnrollmentPacket>("/me/packets", { state_code: stateCode });
    },

    // Two-step submit matching iOS: record consent first, then advance status.
    async submitPacket(packetId: string): Promise<EnrollmentPacket> {
      const iso = new Date().toISOString();
      await postJSON<unknown>(`/me/packets/${packetId}/consent`, {
        signature: "applicant",
        consented_at: iso,
      });
      return postJSON<EnrollmentPacket>(`/me/packets/${packetId}/submit`);
    },

    async withdrawPacket(packetId: string, reason: string): Promise<EnrollmentPacket> {
      return patchJSON<EnrollmentPacket>(
        `/me/packets/${packetId}`,
        { status: "Closed" },
        { "X-Transition-Reason": reason },
      );
    },

    async fetchMyPackets(): Promise<EnrollmentPacket[]> {
      return getJSON<EnrollmentPacket[]>("/me/packets");
    },

    // Documents (multipart upload)

    async uploadDocument(input: {
      packetId: string;
      file: Blob;
      filename: string;
      documentKind: DocumentKind | null;
      onDeviceQualityPassed: boolean;
    }): Promise<EnrollmentDocument> {
      const form = new FormData();
      form.append("file", input.file, input.filename);
      if (input.documentKind) form.append("document_kind", input.documentKind);
      form.append("on_device_quality_passed", String(input.onDeviceQualityPassed));

      const res = await fetch(gatewayURL(`/me/packets/${input.packetId}/documents`), {
        method: "POST",
        headers: { ...(await authHeader()), Accept: "application/json" },
        body: form,
        cache: "no-store",
      });
      if (!res.ok) throw new EnrollmentAPIError(res.status, await res.text());
      return (await res.json()) as EnrollmentDocument;
    },

    async fetchDocuments(packetId: string): Promise<EnrollmentDocument[]> {
      return getJSON<EnrollmentDocument[]>(`/me/packets/${packetId}/documents`);
    },

    // Inbox

    async fetchInbox(): Promise<EnrollmentInboxItem[]> {
      return getJSON<EnrollmentInboxItem[]>("/me/inbox");
    },

    // Buddy invite

    async createBuddyInvite(): Promise<{ token: string; invite_url: string; expires_at: string }> {
      return postJSON<{ token: string; invite_url: string; expires_at: string }>("/buddy/invite", {});
    },
    // Pending caseworker self-referrals awaiting this applicant's approval.
    async fetchPendingBuddyRequests(): Promise<BuddyRequest[]> {
      return getJSON<BuddyRequest[]>("/me/buddies?status=pending");
    },
    async approveBuddyRequest(id: string): Promise<{ id: string; status: string }> {
      return postJSON<{ id: string; status: string }>(`/me/buddies/${id}/approve`);
    },
    async declineBuddyRequest(id: string): Promise<{ declined: boolean }> {
      return postJSON<{ declined: boolean }>(`/me/buddies/${id}/decline`);
    },
  };
}

export type BuddyRequest = {
  id: string;
  buddy_user_id: string;
  status: string;
  org_id: string | null;
  notifications_enabled: boolean;
  created_at: string;
  updated_at: string;
};

export function enrollmentClient() {
  return makeClient(currentAccessToken);
}
