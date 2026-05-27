import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { runWeeklyDigest } from "./weekly-digest.js";
import { TEST_ENV, makeQueryBuilder } from "../test/helpers.js";
import * as supabase from "../lib/supabase.js";
import * as apnsSend from "../lib/apns-send.js";

const SAMPLE_OFFER = {
  offer_id: "11111111-1111-1111-1111-111111111111",
  name: "Top Tier",
  partner_name: "WF",
  category: "groceries",
  description: null,
  county_fips_list: ["06037", "06075"],
  expected_revenue_cents: 50,
  expected_savings_cents: 750,
  start_at: null,
  end_at: null,
  tier: "top",
  state_code: "CA",
  category_tags: ["groceries"],
  merchant_id: null,
  merchant_name_normalized: null,
};

beforeEach(() => {
  vi.restoreAllMocks();
  // Pin to Sunday 2026-05-31 17:00 UTC = 10:00 PT (PDT) = 13:00 ET (EDT).
  // Outside both quiet-hours windows (21:00-08:00 local). The cron actually
  // fires at this UTC on Sunday, so this is the real-world clock.
  vi.useFakeTimers();
  vi.setSystemTime(new Date(Date.UTC(2026, 4, 31, 17, 0, 0)));
  // Default: APNs send succeeds. Override per-test with vi.spyOn if the
  // test needs to assert APNs failure paths.
  vi.spyOn(apnsSend, "sendPerkOffer").mockResolvedValue({
    status: "sent",
    attempts: 1,
    successes: 1,
  });
});

afterEach(() => {
  vi.useRealTimers();
});

/**
 * Mock the SupabaseClient. Each table maps to its own query result; the
 * applicants table uses a stateful counter so the first page returns the
 * configured rows and subsequent pages return [] (loop terminator).
 */
function setupDb({
  applicants,
  distress = [],
  pushLogExisting = [],
  prefs = { perks_on: true, quiet_start: "21:00", quiet_end: "08:00" },
}: {
  applicants: Array<{ applicant_id: string; auth_uid: string; state_code: string; county_fips: string | null }>;
  distress?: unknown[];
  pushLogExisting?: unknown[];
  prefs?: { perks_on: boolean; quiet_start: string; quiet_end: string };
}) {
  let applicantsCallCount = 0;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vi.spyOn(supabase, "makeServiceClient").mockReturnValue({
    schema: vi.fn().mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "applicants") {
          // Stateful: page 1 returns applicants, page 2+ returns [].
          const data = applicantsCallCount === 0 ? applicants : [];
          applicantsCallCount += 1;
          return makeQueryBuilder({ data, error: null });
        }
        if (table === "ebt_notification_prefs") {
          return makeQueryBuilder({ data: prefs, error: null });
        }
        if (table === "distress_flags") {
          return makeQueryBuilder({ data: distress, error: null });
        }
        if (table === "user_push_log") {
          // For SELECTs (24h floor check): return pushLogExisting.
          // For INSERTs (tryRecordPerkPush): override the insert method to
          // return a chainable that resolves to a successful single-row insert.
          const qb = makeQueryBuilder({ data: pushLogExisting, error: null });
          const originalInsert = qb.insert;
          qb.insert = vi.fn().mockReturnValue(
            makeQueryBuilder({ data: [{ push_id: `p-${Math.random()}` }], error: null }),
          );
          // suppress unused warning
          void originalInsert;
          return qb;
        }
        if (table === "partner_offers") {
          return makeQueryBuilder({ data: [SAMPLE_OFFER], error: null });
        }
        if (table === "ebt_transactions") {
          return makeQueryBuilder({ data: [], error: null });
        }
        return makeQueryBuilder({ data: [], error: null });
      }),
    }),
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
}

describe("runWeeklyDigest", () => {
  const noopLog = vi.fn();

  it("sends to all eligible applicants in the shard", async () => {
    setupDb({
      applicants: [
        { applicant_id: "a1", auth_uid: "u1", state_code: "CA", county_fips: "06037" },
        { applicant_id: "a2", auth_uid: "u2", state_code: "CA", county_fips: "06075" },
      ],
    });
    const result = await runWeeklyDigest(TEST_ENV, "CA", noopLog);
    expect(result.shard).toBe("CA");
    expect(result.considered).toBe(2);
    expect(result.sent).toBe(2);
    expect(result.suppressed).toBe(0);
  });

  it("suppresses users with active distress flags", async () => {
    setupDb({
      applicants: [{ applicant_id: "a1", auth_uid: "u1", state_code: "CA", county_fips: "06037" }],
      distress: [{ flag_id: "f1" }],
    });
    const result = await runWeeklyDigest(TEST_ENV, "CA", noopLog);
    expect(result.sent).toBe(0);
    expect(result.suppressed).toBe(1);
    expect(result.reason_counts.distress).toBe(1);
  });

  it("suppresses users with perks_on=false", async () => {
    setupDb({
      applicants: [{ applicant_id: "a1", auth_uid: "u1", state_code: "CA", county_fips: "06037" }],
      prefs: { perks_on: false, quiet_start: "21:00", quiet_end: "08:00" },
    });
    const result = await runWeeklyDigest(TEST_ENV, "CA", noopLog);
    expect(result.sent).toBe(0);
    expect(result.reason_counts.perks_off).toBe(1);
  });

  it("suppresses users with recent (within 24h) perk_offer push", async () => {
    setupDb({
      applicants: [{ applicant_id: "a1", auth_uid: "u1", state_code: "CA", county_fips: "06037" }],
      pushLogExisting: [{ push_id: "p-recent" }],
    });
    const result = await runWeeklyDigest(TEST_ENV, "CA", noopLog);
    expect(result.sent).toBe(0);
    expect(result.reason_counts.within_24h).toBe(1);
  });

  it("returns shard='MA' for the MA cron", async () => {
    setupDb({ applicants: [] });
    const result = await runWeeklyDigest(TEST_ENV, "MA", noopLog);
    expect(result.shard).toBe("MA");
    expect(result.considered).toBe(0);
  });
});
