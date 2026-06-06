import { NextResponse } from "next/server";
import { enrollmentClient, EnrollmentAPIError } from "../../../../lib/enrollment-api/client";

export async function POST() {
  try {
    const client = enrollmentClient();
    const data = await client.createBuddyInvite();
    return NextResponse.json(data, { status: 201 });
  } catch (e) {
    const status = e instanceof EnrollmentAPIError ? e.status : 500;
    return NextResponse.json({ error: "gateway_failed" }, { status });
  }
}
