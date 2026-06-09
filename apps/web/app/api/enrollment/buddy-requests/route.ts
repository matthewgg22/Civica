import { NextResponse } from "next/server";
import { enrollmentClient, EnrollmentAPIError } from "../../../../lib/enrollment-api/client";

// GET /api/enrollment/buddy-requests — pending caseworker self-referrals
// awaiting this applicant's approval. Proxies the gateway with the server-side
// session JWT (mirrors the buddy-invite proxy).
export async function GET() {
  try {
    const data = await enrollmentClient().fetchPendingBuddyRequests();
    return NextResponse.json(data);
  } catch (e) {
    const status = e instanceof EnrollmentAPIError ? e.status : 500;
    return NextResponse.json({ error: "gateway_failed" }, { status });
  }
}
