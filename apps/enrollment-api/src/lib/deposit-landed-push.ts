/**
 * Deposit-landed nearest-partner push picker.
 *
 * Source plan: ceo-plans/2026-05-26-ebt-offer-moment-platform.md (B-T8 + D11).
 *
 * Wired from the existing EBT webhook handler: when a deposit_landed webhook
 * fires (the Fly scraper detects a new EBT deposit), this helper resolves
 * the user's nearest top-tier partner offer in the user's packet_county and
 * (if cadence gates pass) records + dispatches a perk_offer push.
 *
 * NO client geofence (per D11 outside-voice decision). Server-side picks
 * the offer purely from `partner_offers` filtered to `tier='top'` +
 * packet_county. v1.1 layers in real-time client geofence for users who
 * grant authorizedAlways.
 *
 * Returns a decision + record for ops observability. The caller (webhook
 * handler) logs the result; APNs send is stubbed in v1 (same as digest).
 */

import { makeServiceClient } from "../lib/supabase.js";
import {
  shouldSendPerkOfferPush,
  tryRecordPerkPush,
  readNotificationPrefs,
  DEFAULT_PREFS,
} from "./push-cadence.js";
import { resolveOffers } from "./offers/resolver.js";
import type { Env } from "../types.js";

export interface DepositLandedPushResult {
  status:
    | "sent"
    | "no_top_tier_offer"
    | "cadence_suppressed"
    | "race_lost"
    | "user_not_found";
  user_id?: string;
  offer_id?: string;
  reason?: string;
}

export async function dispatchDepositLandedPush(
  env: Env,
  args: {
    userId: string;
    packetCountyFips: string | null;
    stateCode: "CA" | "MA";
    tzOffsetHours: number;
  },
): Promise<DepositLandedPushResult> {
  const db = makeServiceClient(env);
  const prefs = (await readNotificationPrefs(db, args.userId)) ?? DEFAULT_PREFS;
  const nowUtcMs = Date.now();

  const decision = await shouldSendPerkOfferPush(db, {
    userId: args.userId,
    prefs,
    nowUtcMs,
    tzOffsetHours: args.tzOffsetHours,
  });
  if (!decision.send) {
    return { status: "cadence_suppressed", user_id: args.userId, reason: decision.reason };
  }

  // Resolve offers, then narrow to tier='top'. The resolver already enforces
  // distress + state + county; we just filter the result.
  const resolved = await resolveOffers(db, {
    userId: args.userId,
    stateCode: args.stateCode,
    packetCountyFips: args.packetCountyFips,
    currentCountyFips: null,
    limit: 12,
  });
  const topTier = resolved.offers.find((o) => o.tier === "top");
  if (!topTier) {
    return { status: "no_top_tier_offer", user_id: args.userId };
  }

  const recorded = await tryRecordPerkPush(db, {
    userId: args.userId,
    offerId: topTier.offer_id,
  });
  if (!recorded) {
    // Race: digest cron or a prior deposit_landed already wrote today's row.
    return { status: "race_lost", user_id: args.userId, offer_id: topTier.offer_id };
  }

  // v1: stub APNs send. The push_log row is the durable record; once the
  // partner catalog has live entries (X-T8) we'll wire the existing apns-send
  // helper (sendPerkOffer category) here in a v1.0.1 commit.
  return { status: "sent", user_id: args.userId, offer_id: topTier.offer_id };
}
