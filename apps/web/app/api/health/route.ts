// GET /api/health — Demeter operational heartbeat (eng review F6/F7).
//
// Reports the two things that can silently degrade the product:
//   semantic  — is the vendored embedding model loaded? ("lexical" here while
//               the published accuracy numbers assume "semantic+lexical" is
//               exactly the drift F6 exists to catch — the deploy smoke test
//               asserts this field.)
//   counters  — is the durable usage store reachable? (fail-open means the
//               chat still answers when it isn't; this is how you notice.)

import { NextResponse } from "next/server";
import { semanticLayerStatus, warmupEmbeddings } from "@civica/demeter-engine";
import { supabaseAdmin } from "../../../lib/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  // Kick the model load so a health probe on a cold instance reports the
  // post-warmup truth on its next poll (and warms the instance for users).
  warmupEmbeddings();

  let countersOk = false;
  try {
    const db = supabaseAdmin();
    const { error } = await db
      .schema("snap_enrollment")
      .rpc("demeter_increment_and_check", { p_bucket: "health:probe", p_amount: 0 });
    countersOk = !error;
  } catch {
    countersOk = false;
  }

  const semantic = semanticLayerStatus();
  const healthy = countersOk && semantic.status !== "unavailable";
  return NextResponse.json(
    {
      ok: healthy,
      semantic,
      counters: countersOk ? "ok" : "unreachable",
      configured: Boolean(process.env.ANTHROPIC_API_KEY),
    },
    { status: healthy ? 200 : 503 },
  );
}
