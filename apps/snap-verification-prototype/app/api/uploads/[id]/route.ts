import { NextResponse } from "next/server";
import { readFile, readdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? path.join(process.cwd(), ".data", "uploads");

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  if (!existsSync(UPLOAD_DIR)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const entries = await readdir(UPLOAD_DIR);
  const filename = entries.find((e) => e.startsWith(params.id));
  if (!filename) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const buf = await readFile(path.join(UPLOAD_DIR, filename));
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  const mime =
    ext === "pdf" ? "application/pdf" :
    ext === "png" ? "image/png" :
    ext === "jpg" || ext === "jpeg" ? "image/jpeg" :
    ext === "gif" ? "image/gif" :
    ext === "webp" ? "image/webp" :
    "application/octet-stream";

  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "content-type": mime,
      "content-disposition": `inline; filename="${filename}"`,
    },
  });
}
