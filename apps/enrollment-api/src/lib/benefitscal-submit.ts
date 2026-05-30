/**
 * BenefitsCal Phase 2 — background submission runner (Session M1).
 *
 * Invoked from the POST /benefitscal/submit/:packetId route handler via
 * `ctx.waitUntil`. Runs in the Worker's post-response lifecycle:
 *
 *   1. Mark the submission row 'running' + record started_at.
 *   2. Delegate to the @civica/benefitscal-cbo submitter to drive the portal.
 *   3. On return, persist the terminal status + transcript + confirmation
 *      number into benefitscal_submissions.playwright_log + status columns.
 *
 * Why ctx.waitUntil and not Cloudflare Queues:
 *   At pilot scale (~5 submissions/month) Queues is over-engineering.
 *   ctx.waitUntil gives the same async behavior with no new primitive.
 *   Migrate to Queues later when monthly volume nears ~100 OR when retry /
 *   dropped-message behavior is needed beyond best-effort.
 *
 * Driver injection:
 *   The submitter requires a BrowserDriverFactory because the CF Worker
 *   cannot run Playwright/Chromium in-process. Today this helper takes the
 *   factory as a parameter so tests can inject a fake. A future commit
 *   will wire production to an external Browserless / driver service.
 *   Until then, calling this helper in production will throw cleanly at
 *   the `driverFactory.launch` boundary, and the error path below records
 *   the failure to the submission row.
 */

// Import from the /driver subpath, NOT the root barrel. The root barrel
// re-exports /core, which ships DOM primitives (fill.ts, locate.ts) that
// don't typecheck under enrollment-api's DOM-less Workers lib config.
// /driver is the server-only surface and carries everything this Worker
// needs. See feedback: benefitscal-cbo subpath layering.
import type {
  BrowserDriverFactory,
  SubmitterResult,
} from "@civica/benefitscal-cbo/driver";
import { submitToBenefitsCal } from "@civica/benefitscal-cbo/driver";
import type { SupabaseClient } from "@supabase/supabase-js";
import { makeServiceClient } from "./supabase.js";
import type { Env } from "../types.js";

export interface RunOptions {
  submissionId: string;
  packetId: string;
  /** Snapshot payload shaped as BenefitsCalPayload. Typed as `unknown` here to avoid pulling the schema into the route layer; the submitter validates at runtime. */
  snapshot: unknown;
  env: Env;
  /** Injectable driver factory. Required: the Worker cannot launch a real browser in-process. */
  driverFactory: BrowserDriverFactory;
  /** Optional override; defaults to a service-role client built from env. */
  db?: SupabaseClient;
}

export async function runBenefitsCalSubmission(opts: RunOptions): Promise<void> {
  const db = opts.db ?? makeServiceClient(opts.env);

  // Mark as running.
  await db
    .schema("snap_enrollment")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .from("benefitscal_submissions" as any)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update({ status: "running", started_at: new Date().toISOString() } as any)
    .eq("submission_id", opts.submissionId);

  let result: SubmitterResult;
  try {
    const subOpts: Parameters<typeof submitToBenefitsCal>[0] = {
      username: opts.env.BENEFITSCAL_CBO_USERNAME ?? "",
      password: opts.env.BENEFITSCAL_CBO_PASSWORD ?? "",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      snapshot: opts.snapshot as any,
      driverFactory: opts.driverFactory,
    };
    if (opts.env.BENEFITSCAL_BASE_URL !== undefined) {
      subOpts.baseURL = opts.env.BENEFITSCAL_BASE_URL;
    }
    result = await submitToBenefitsCal(subOpts);
  } catch (err) {
    // submitToBenefitsCal catches internally and returns status:'failed',
    // but guard against unexpected throws from driver factory itself.
    result = {
      status: "failed",
      transcript: [],
      error: {
        message: err instanceof Error ? err.message : String(err),
        step: "driver_launch",
      },
    };
  }

  const isSuccess = result.status === "succeeded";

  await db
    .schema("snap_enrollment")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .from("benefitscal_submissions" as any)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update({
      status: isSuccess ? "succeeded" : "failed",
      submitted_at: isSuccess ? new Date().toISOString() : null,
      benefitscal_confirmation_number: result.confirmation_number ?? null,
      error_message: result.error?.message ?? null,
      playwright_log: {
        transcript: result.transcript,
        error: result.error ?? null,
        benefitscal_application_id: result.benefitscal_application_id ?? null,
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)
    .eq("submission_id", opts.submissionId);
}
