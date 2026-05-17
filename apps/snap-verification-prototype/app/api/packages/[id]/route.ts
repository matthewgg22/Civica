import { NextResponse } from "next/server";
import { getPackage } from "@/lib/store";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const stored = getPackage(params.id);
  if (!stored) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ stored });
}
