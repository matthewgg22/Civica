// GET  /api/enrollment/documents/[packetId] — list documents for a packet
// POST /api/enrollment/documents/[packetId] — multipart upload, forwards to gateway

import { NextResponse } from "next/server";
import { enrollmentClient, EnrollmentAPIError } from "../../../../../lib/enrollment-api/client";
import { requireEnrollmentApiUrl } from "../../../../../lib/env";
import { currentAccessToken } from "../../../../../lib/supabase-server";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ packetId: string }> },
) {
  const { packetId } = await params;
  try {
    const client = enrollmentClient();
    const docs = await client.fetchDocuments(packetId);
    return NextResponse.json(docs);
  } catch (e) {
    const status = e instanceof EnrollmentAPIError ? e.status : 500;
    return NextResponse.json({ error: "gateway_failed" }, { status });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ packetId: string }> },
) {
  const { packetId } = await params;
  const token = await currentAccessToken();
  if (!token) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const form = await request.formData();
  // Re-forward the multipart payload to the gateway directly. We don't
  // re-pack the FormData because that would re-encode the binary; instead
  // we build a fresh request with the same Blob.
  const file = form.get("file");
  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: "missing_file" }, { status: 400 });
  }
  const documentKind = form.get("document_kind");
  const onDeviceQuality = form.get("on_device_quality_passed");

  const filename = (file as File).name ?? "document";
  const outbound = new FormData();
  outbound.append("file", file, filename);
  if (typeof documentKind === "string") outbound.append("document_kind", documentKind);
  outbound.append("on_device_quality_passed", typeof onDeviceQuality === "string" ? onDeviceQuality : "false");

  const base = requireEnrollmentApiUrl().replace(/\/$/, "");
  const res = await fetch(`${base}/v1/enrollment/me/packets/${packetId}/documents`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: outbound,
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json({ error: "gateway_failed", detail: text.slice(0, 500) }, { status: res.status });
  }
  const doc = await res.json();
  return NextResponse.json(doc);
}
