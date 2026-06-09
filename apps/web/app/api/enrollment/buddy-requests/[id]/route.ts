import { NextResponse } from "next/server";
import { enrollmentClient, EnrollmentAPIError } from "../../../../../lib/enrollment-api/client";

// POST /api/enrollment/buddy-requests/:id — approve or decline a pending
// caseworker request. Body: { action: "approve" | "decline" }.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let body: { action?: string };
  try {
    body = (await req.json()) as { action?: string };
  } catch {
    body = {};
  }

  try {
    const client = enrollmentClient();
    if (body.action === "approve") {
      return NextResponse.json(await client.approveBuddyRequest(id));
    }
    if (body.action === "decline") {
      return NextResponse.json(await client.declineBuddyRequest(id));
    }
    return NextResponse.json({ error: "invalid_action" }, { status: 400 });
  } catch (e) {
    const status = e instanceof EnrollmentAPIError ? e.status : 500;
    return NextResponse.json({ error: "gateway_failed" }, { status });
  }
}
