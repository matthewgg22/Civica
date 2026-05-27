// /pilot/export.json — cohort report as JSON (TODO-12).
//
// Same data as the /pilot page, machine-readable. Operator pipes this into
// a sheet to assemble the "pilot success" criteria writeup (the human half
// of TODO-12). Behind the standard staff auth gate.
import { NextResponse } from "next/server";
import { fetchPilotCohort, resolveCohortWindow } from "../../../lib/pilot-fetcher";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const { since, until } = resolveCohortWindow({
    since: url.searchParams.get("since") ?? undefined,
    until: url.searchParams.get("until") ?? undefined,
  });
  const report = await fetchPilotCohort(since, until);
  return NextResponse.json(report, {
    headers: {
      "Cache-Control": "no-store",
      "Content-Disposition": `inline; filename="pilot-cohort-${since.slice(0, 10)}_${until.slice(0, 10)}.json"`,
    },
  });
}
