import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/auth/supabase-server";

const MAX_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);

type Params = { packetId: string; documentId: string };

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<Params> }
) {
  const { packetId, documentId } = await params;

  // Auth
  const supabase = await createSupabaseServerClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Parse multipart
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("multipart/form-data")) {
    return NextResponse.json({ error: "Expected multipart/form-data" }, { status: 400 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file field" }, { status: 400 });
  }

  // Validate size
  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: "File too large (max 20 MB)" }, { status: 413 });
  }

  // Validate MIME type
  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json({ error: "Unsupported file type" }, { status: 415 });
  }

  // Forward to backend
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
  const url = `${apiBase}/me/packets/${encodeURIComponent(packetId)}/documents/${encodeURIComponent(documentId)}/upload`;

  const upstream = new FormData();
  upstream.append("file", file);

  const response = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${session.access_token}` },
    body: upstream,
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    return NextResponse.json(
      { error: body || "Upload failed" },
      { status: response.status }
    );
  }

  const result = await response.json().catch(() => ({}));
  return NextResponse.json(result, { status: 200 });
}
