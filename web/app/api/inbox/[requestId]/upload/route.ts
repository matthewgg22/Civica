import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/auth/supabase-server";

const MAX_SIZE_BYTES = 20 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);

type Params = { requestId: string };

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<Params> }
) {
  const { requestId } = await params;

  const supabase = await createSupabaseServerClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: "File too large (max 20 MB)" }, { status: 413 });
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json({ error: "Unsupported file type" }, { status: 415 });
  }

  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
  const url = `${apiBase}/me/inbox/${encodeURIComponent(requestId)}/upload`;

  const upstream = new FormData();
  upstream.append("file", file);

  const response = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${session.access_token}` },
    body: upstream,
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    return NextResponse.json({ error: body || "Upload failed" }, { status: response.status });
  }

  return NextResponse.json({}, { status: 200 });
}
