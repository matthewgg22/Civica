import { NextResponse } from "next/server";
import { validateAddress } from "@/lib/usps";

export async function POST(req: Request) {
  const { address } = await req.json();
  return NextResponse.json(await validateAddress(address ?? ""));
}
