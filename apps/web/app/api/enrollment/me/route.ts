// GET /api/enrollment/me — returns the signed-in applicant's packets +
// inbox so the /status page can render in one client-side call.

import { NextResponse } from "next/server";
import { enrollmentClient, EnrollmentAPIError } from "../../../../lib/enrollment-api/client";

export async function GET() {
  try {
    const client = enrollmentClient();
    const [packets, inbox] = await Promise.all([
      client.fetchMyPackets(),
      client.fetchInbox(),
    ]);
    return NextResponse.json({ packets, inbox });
  } catch (e) {
    const status = e instanceof EnrollmentAPIError ? e.status : 500;
    return NextResponse.json({ error: "gateway_failed" }, { status });
  }
}
