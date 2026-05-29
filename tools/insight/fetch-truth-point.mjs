#!/usr/bin/env node
// Fetch the canonical error-rate truth point for the /insight command.
//
// Prints a single JSON object to stdout describing the latest snapshot run:
//   { available: true,  computed_at, engine_version, metrics: [...] }
//   { available: false, reason, ...hint }   // never throws — always exit 0
//
// The /insight skill (tools/insight/SKILL.md) calls this when service
// credentials are present; otherwise it falls back to having the user paste the
// SQL result. This script therefore degrades gracefully on every failure mode
// (no creds, supabase-js not resolvable from here, query error, empty snapshot)
// so the skill can branch on the JSON instead of catching a crash.
//
// Reads OUTPUTS only — the numbers are produced by @civica/snap-qc-engine via
// the daily refresh; this never computes a PER. See
// docs/findings/2026-05-29-error-rate-truth-point.md.

const SQL_FALLBACK =
  "select coalesce(json_agg(row_to_json(t)), '[]'::json) " +
  "from snap_enrollment.v_error_rate_current t;";

function emit(obj) {
  process.stdout.write(JSON.stringify(obj, null, 2) + "\n");
  process.exit(0);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  emit({
    available: false,
    reason: "no_credentials",
    needs: ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"],
    hint: "Run the SQL fallback in the Supabase SQL Editor and paste the result.",
    sql_fallback: SQL_FALLBACK,
  });
}

let createClient;
try {
  ({ createClient } = await import("@supabase/supabase-js"));
} catch {
  emit({
    available: false,
    reason: "module_unavailable",
    hint:
      "@supabase/supabase-js could not be resolved from the repo root (pnpm isolation). " +
      "Re-run via a workspace that has it, e.g. `pnpm --filter dashboard exec node " +
      "../../tools/insight/fetch-truth-point.mjs`, or use the SQL fallback.",
    sql_fallback: SQL_FALLBACK,
  });
}

try {
  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await supabase
    .schema("snap_enrollment")
    .from("v_error_rate_current")
    .select(
      "computed_at, engine_version, metric, per_pct, ci_low, ci_high, n, fiscal_year, source, meta",
    );

  if (error) {
    emit({
      available: false,
      reason: "query_error",
      error: error.message,
      hint:
        "If this says the relation does not exist, apply " +
        "supabase/migrations/20260597_error_rate_snapshot.sql first.",
      sql_fallback: SQL_FALLBACK,
    });
  }

  const rows = data ?? [];
  if (rows.length === 0) {
    emit({
      available: false,
      reason: "empty",
      message:
        "The snapshot has no rows yet — the refresh has not run. Deploy the gateway " +
        "so the 04:00 cron writes a run, trigger it from the Cloudflare dashboard, or " +
        "call the refresh endpoint. Do NOT draft a finding from constants.",
    });
  }

  emit({
    available: true,
    computed_at: rows[0].computed_at,
    engine_version: rows[0].engine_version,
    metrics: rows,
  });
} catch (err) {
  emit({
    available: false,
    reason: "unexpected_error",
    error: String(err),
    sql_fallback: SQL_FALLBACK,
  });
}
