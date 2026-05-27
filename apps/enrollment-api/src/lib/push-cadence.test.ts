import { describe, it, expect, vi } from "vitest";
import {
  parseTimeMinutes,
  isInQuietHours,
  userLocalMinutes,
  shouldSendPerkOfferPush,
  DEFAULT_PREFS,
} from "./push-cadence.js";
import { makeMultiTableDbClient } from "../test/helpers.js";

describe("parseTimeMinutes", () => {
  it("parses HH:MM", () => {
    expect(parseTimeMinutes("21:00")).toBe(21 * 60);
    expect(parseTimeMinutes("08:00")).toBe(8 * 60);
  });
  it("parses HH:MM:SS", () => {
    expect(parseTimeMinutes("21:00:00")).toBe(21 * 60);
    expect(parseTimeMinutes("08:30:45")).toBe(8 * 60 + 30);
  });
  it("rejects malformed", () => {
    expect(parseTimeMinutes("25:00")).toBeNull();
    expect(parseTimeMinutes("12:75")).toBeNull();
    expect(parseTimeMinutes("abc")).toBeNull();
  });
});

describe("isInQuietHours", () => {
  it("returns true inside a same-day window", () => {
    expect(isInQuietHours(3 * 60, "02:00", "06:00")).toBe(true);
  });
  it("returns false outside a same-day window", () => {
    expect(isInQuietHours(7 * 60, "02:00", "06:00")).toBe(false);
  });
  it("handles wrap-around window 21:00-08:00 (Civica default)", () => {
    // 22:00 inside
    expect(isInQuietHours(22 * 60, "21:00", "08:00")).toBe(true);
    // 03:00 inside (next day)
    expect(isInQuietHours(3 * 60, "21:00", "08:00")).toBe(true);
    // 09:00 outside
    expect(isInQuietHours(9 * 60, "21:00", "08:00")).toBe(false);
    // 20:59 outside (one minute before start)
    expect(isInQuietHours(20 * 60 + 59, "21:00", "08:00")).toBe(false);
  });
  it("treats start === end as zero-length (never quiet)", () => {
    expect(isInQuietHours(10 * 60, "12:00", "12:00")).toBe(false);
  });
  it("includes the start boundary, excludes the end boundary", () => {
    expect(isInQuietHours(2 * 60, "02:00", "06:00")).toBe(true);
    expect(isInQuietHours(6 * 60, "02:00", "06:00")).toBe(false);
  });
});

describe("userLocalMinutes", () => {
  it("converts UTC ms to local-clock minutes-of-day", () => {
    // 2026-05-27 17:00 UTC = 09:00 PT (UTC-8 PST, but in May 2026 we're in PDT UTC-7)
    // Use a fixed UTC time + an offset and compute expected.
    const utcMs = Date.UTC(2026, 4, 27, 17, 0, 0); // May 27, 2026 17:00 UTC
    // For PT (UTC-7 during PDT): local = 10:00 → 600
    expect(userLocalMinutes(utcMs, -7)).toBe(10 * 60);
    // For ET (UTC-4 during EDT): local = 13:00 → 780
    expect(userLocalMinutes(utcMs, -4)).toBe(13 * 60);
    // For UTC: 17:00 → 1020
    expect(userLocalMinutes(utcMs, 0)).toBe(17 * 60);
  });

  it("handles midnight crossing (TZ pushes time across day boundary)", () => {
    // 02:00 UTC + UTC-7 = previous day 19:00 → 1140
    const utcMs = Date.UTC(2026, 4, 27, 2, 0, 0);
    expect(userLocalMinutes(utcMs, -7)).toBe(19 * 60);
  });
});

describe("shouldSendPerkOfferPush (cadence gate)", () => {
  const baseArgs = {
    userId: "user-001",
    prefs: DEFAULT_PREFS,
    nowUtcMs: Date.UTC(2026, 4, 27, 17, 0, 0), // 17:00 UTC
    tzOffsetHours: -7, // PT = 10:00 local
  };

  it("blocks when perks_on=false", async () => {
    const db = makeMultiTableDbClient({});
    const decision = await shouldSendPerkOfferPush(db, {
      ...baseArgs,
      prefs: { ...DEFAULT_PREFS, perks_on: false },
    });
    expect(decision).toEqual({ send: false, reason: "perks_off" });
  });

  it("blocks when within quiet hours (21:00-08:00 default; 03:00 local)", async () => {
    const db = makeMultiTableDbClient({});
    // Pick a UTC time that maps to 03:00 PT = 10:00 UTC
    const decision = await shouldSendPerkOfferPush(db, {
      ...baseArgs,
      nowUtcMs: Date.UTC(2026, 4, 27, 10, 0, 0), // 10:00 UTC → 03:00 PT
    });
    expect(decision.send).toBe(false);
    expect(decision.reason).toBe("quiet_hours");
  });

  it("blocks when distressed (silent-honor override)", async () => {
    const db = makeMultiTableDbClient({
      distress_flags: { data: [{ flag_id: "f1" }], error: null },
    });
    const decision = await shouldSendPerkOfferPush(db, baseArgs);
    expect(decision).toEqual({ send: false, reason: "distress" });
  });

  it("blocks when a perk_offer push has fired in the last 24h (T-coverage-3)", async () => {
    const db = makeMultiTableDbClient({
      distress_flags: { data: [], error: null },
      user_push_log: { data: [{ push_id: "p-recent" }], error: null },
    });
    const decision = await shouldSendPerkOfferPush(db, baseArgs);
    expect(decision).toEqual({ send: false, reason: "within_24h" });
  });

  it("allows send when all gates pass (perks_on + not quiet + not distress + no recent push)", async () => {
    const db = makeMultiTableDbClient({
      distress_flags: { data: [], error: null },
      user_push_log: { data: [], error: null },
    });
    const decision = await shouldSendPerkOfferPush(db, baseArgs);
    expect(decision).toEqual({ send: true, reason: "ok" });
  });

  it("blocks (fail closed) when push-log query errors", async () => {
    const db = makeMultiTableDbClient({
      distress_flags: { data: [], error: null },
      user_push_log: { data: null, error: { message: "supabase blip" } },
    });
    const decision = await shouldSendPerkOfferPush(db, baseArgs);
    expect(decision.send).toBe(false);
    expect(decision.reason).toBe("prefs_unavailable");
  });
});

describe("TZ + 24h floor boundary (T-coverage-3 explicit case)", () => {
  /**
   * The plan's T-coverage-3 specifies "24h floor crosses midnight in user TZ".
   * The DB constraint is `date_trunc('day', sent_at)` in UTC, NOT local TZ —
   * which is a deliberate simplification (one row per user per UTC day).
   * This test documents the contract: a push at UTC 23:30 followed by
   * another at UTC 00:30 the next day are in DIFFERENT UTC days, so the
   * partial index does NOT block the second one.
   *
   * The cadence pre-check (last 24h window) DOES block it. So the user
   * is protected even when the index would allow it.
   */
  it("documents: pre-check 24h window catches what the UTC-day index alone would miss", async () => {
    // Imagine the user has a push at UTC 23:30 the prior day. The "since"
    // calculation is now-24h, which would span back into yesterday and find
    // that row even though it's on a different UTC date.
    const nowUtcMs = Date.UTC(2026, 4, 27, 0, 30, 0); // 00:30 UTC May 27
    const db = makeMultiTableDbClient({
      distress_flags: { data: [], error: null },
      // The mock returns the same data regardless of the gte filter — the
      // real Supabase would filter by sent_at >= now-24h, which would
      // include a push from yesterday at 23:30 UTC.
      user_push_log: { data: [{ push_id: "p-from-yesterday" }], error: null },
    });
    const decision = await shouldSendPerkOfferPush(db, {
      userId: "user-001",
      prefs: DEFAULT_PREFS,
      nowUtcMs,
      tzOffsetHours: -7, // local time is 17:30 prior day = not quiet
    });
    expect(decision.send).toBe(false);
    expect(decision.reason).toBe("within_24h");
  });
});
