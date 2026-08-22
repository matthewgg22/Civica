// Cron entry point for the retention job (#926).
//
// Invoked by the Vercel cron declared in vercel.json. Vercel sends
// `Authorization: Bearer $CRON_SECRET` when that env var is set; this route
// FAILS CLOSED if it is missing or wrong, because an unauthenticated endpoint
// that blanks columns is a denial-of-evidence button anyone could press.
//
// GET, because that is what Vercel Cron issues. It is not idempotent in the
// pure sense — it writes — but it is safe to repeat: the query skips rows
// already carrying the tombstone.

import { NextResponse } from "next/server";
import { runRetentionPurge } from "../../../../lib/retention-purge";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 503 });
  }
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // ?dryRun=1 counts without writing — for looking at the size of the first
  // sweep before letting it run.
  const dryRun = new URL(req.url).searchParams.get("dryRun") === "1";
  try {
    const result = await runRetentionPurge({ dryRun });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "purge failed" },
      { status: 500 },
    );
  }
}
