import { NextResponse } from "next/server";
import { getPackage } from "@/lib/store";
import { renderPackagePdf } from "@/lib/package-builder/pdf";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const stored = getPackage(params.id);
  if (!stored) return NextResponse.json({ error: "not found" }, { status: 404 });
  const pdf = await renderPackagePdf(stored);
  return new NextResponse(new Uint8Array(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="snap-verification-${stored.id}.pdf"`,
    },
  });
}
