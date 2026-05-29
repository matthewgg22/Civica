/**
 * GET /v1/enrollment/extension/packets
 *
 * Returns the CBO org's ready-to-submit packets so the extension popup can
 * render a picker. Authenticated by a per-CBO device-flow access token
 * (issue #317). The result is STRICTLY scoped to the token's org_id — a token
 * for org A can never see org B's packets.
 *
 * Shape per packet: { id, applicant_name, status, qc_badge }.
 *   - applicant_name is the ciphertext marker (Phase-1 PII posture, mirrors
 *     /extension/packets/:id/payload — decryption is deferred to Phase 2).
 *   - qc_badge is best-effort: the latest packet_error_risk tier/score if one
 *     exists, else null. Never blocks the list.
 *
 * Auth NOTE: unlike payload/confirm, the picker is a per-CBO surface only — it
 * makes no sense under the legacy shared token (which has no org to scope to),
 * so this endpoint requires a device token. payload/confirm still accept both.
 */

import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { makeServiceClient } from "../../lib/supabase.js";
import { rateLimit } from "../../lib/rate-limit.js";
import { resolveExtensionAuth } from "./auth.js";
import type { Env } from "../../types.js";

const app = new Hono<{ Bindings: Env }>();

// Statuses an assister can actually submit to BenefitsCal. Navigator review is
// done; documents are gathered. Excludes Draft / in-review / closed states.
const SUBMITTABLE_STATUSES = ["Ready for Handoff", "Handed Off"] as const;

app.get("/packets", rateLimit("standard"), async (c) => {
  const auth = await resolveExtensionAuth(c.env, c.req.header("Authorization"));
  if (auth === "unconfigured") {
    throw new HTTPException(503, {
      message: "Extension auth is not configured for this environment.",
    });
  }
  if (auth === "unauthorized") {
    throw new HTTPException(401, { message: "Unauthorized" });
  }
  // The picker is a per-CBO surface — require a device token (org-scoped).
  if (auth.method !== "device_token") {
    throw new HTTPException(403, {
      message: "The packet picker requires a per-CBO device token.",
    });
  }

  const db = makeServiceClient(c.env);

  // STRICT org scope: .eq('org_id', auth.orgId) is the isolation boundary.
  const { data: packets, error } = await db
    .schema("snap_enrollment")
    .from("snap_packets")
    .select(
      `packet_id, status, county, updated_at,
       applicants(full_name_ciphertext)`,
    )
    .eq("org_id", auth.orgId)
    .in("status", [...SUBMITTABLE_STATUSES])
    .is("deleted_at", null)
    .order("updated_at", { ascending: false });

  if (error) throw new HTTPException(500, { message: error.message });

  const rows = (packets ?? []) as Array<{
    packet_id: string;
    status: string;
    county: string | null;
    updated_at: string | null;
    applicants: { full_name_ciphertext: string | null } | Array<{ full_name_ciphertext: string | null }> | null;
  }>;

  // Best-effort QC badge: latest packet_error_risk per packet. One query for
  // the visible set; map by packet_id. Degrades to null on any error.
  const packetIds = rows.map((r) => r.packet_id);
  const qcByPacket = await loadLatestQcBadges(db, packetIds);

  const items = rows.map((r) => {
    const applicant = Array.isArray(r.applicants) ? (r.applicants[0] ?? null) : r.applicants;
    return {
      id: r.packet_id,
      // Phase-1 ciphertext marker; the extension surfaces "name hidden" until
      // decryption lands (mirrors the payload endpoint).
      applicant_name_ciphertext: applicant?.full_name_ciphertext ?? null,
      status: r.status,
      county: r.county ?? null,
      updated_at: r.updated_at ?? null,
      qc_badge: qcByPacket.get(r.packet_id) ?? null,
    };
  });

  return c.json({ org_id: auth.orgId, packets: items }, 200);
});

/**
 * Returns a map packet_id → { tier, score } using the most recent
 * packet_error_risk row per packet. Best-effort: any error yields an empty map
 * so the picker still renders.
 */
async function loadLatestQcBadges(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  packetIds: string[],
): Promise<Map<string, { tier: string; score: number | null }>> {
  const out = new Map<string, { tier: string; score: number | null }>();
  if (packetIds.length === 0) return out;

  try {
    const { data, error } = await db
      .schema("snap_enrollment")
      .from("packet_error_risk")
      .select("packet_id, tier, score, created_at")
      .in("packet_id", packetIds)
      .order("created_at", { ascending: false });
    if (error || !data) return out;

    // Rows are newest-first; keep the first seen per packet.
    for (const row of data as Array<{ packet_id: string; tier: string; score: number | null }>) {
      if (!out.has(row.packet_id)) {
        out.set(row.packet_id, { tier: row.tier, score: row.score });
      }
    }
  } catch {
    // Best-effort — never block the picker on the badge lookup.
  }
  return out;
}

export default app;
