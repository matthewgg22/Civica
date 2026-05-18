// TEMPORARY — remove before merging. Enabled by SENTRY_CHECK_ENABLED=1 in Vercel env vars.
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function GET() {
  if (!process.env.SENTRY_CHECK_ENABLED) {
    return NextResponse.json({ error: "not_enabled" }, { status: 404 });
  }
  throw new Error("Sentry check: intentional test error from civica-dashboard");
}
