// Unit tests for the notifications event spine (#514).
//
// buildNotifications is pure, so we assert shape/severity/dedupe directly.
// dispatchNotifications gets a tiny mock db: we verify the table-missing
// (42P01) swallow, real-error pass-through, and the empty-drafts short-circuit.
// The DV-safety invariant gets its own dedicated block.

import { describe, it, expect, vi } from "vitest";
import {
  buildNotifications,
  dispatchNotifications,
  emitNotification,
  sanitizePayload,
  SAFETY_KEYS,
  type NotificationDraft,
  type NotificationsDb,
  type CliffEvent,
  type PacketStatusChangeEvent,
  type RecertDueEvent,
  type RecommendationGeneratedEvent,
} from "./notifications.js";

/** First draft, asserted present — keeps the strict index checker happy. */
function one(event: Parameters<typeof buildNotifications>[0]): NotificationDraft {
  const drafts = buildNotifications(event);
  expect(drafts.length).toBeGreaterThan(0);
  return drafts[0]!;
}

function makeDb(error: { code?: string; message?: string } | null) {
  const upsert = vi.fn().mockResolvedValue({ error });
  const from = vi.fn(() => ({ upsert }));
  const schema = vi.fn(() => ({ from }));
  return { db: { schema } as unknown as NotificationsDb, upsert, from, schema };
}

const ORG = "00000000-0000-0000-0000-0000000000aa";
const PKT = "00000000-0000-0000-0000-0000000000bb";

describe("buildNotifications — cliff_event", () => {
  const ev: CliffEvent = {
    type: "cliff_event",
    orgId: ORG,
    packetId: PKT,
    applicantId: "appl-1",
    source: "system:argyle-webhook",
    monthlyIncomeUsd: 2200,
    payDate: "2026-06-01",
  };

  it("produces one urgent inbox draft", () => {
    const d = one(ev);
    expect(d.event_type).toBe("cliff_event");
    expect(d.channel).toBe("inbox");
    expect(d.severity).toBe("urgent");
    expect(d.org_id).toBe(ORG);
    expect(d.packet_id).toBe(PKT);
  });

  it("formats the income into the body and a stable dedupe_key", () => {
    const d = one(ev);
    expect(d.body).toContain("$2,200");
    expect(d.dedupe_key).toBe(`cliff:${PKT}:2026-06-01`);
    // Re-emit is deterministic -> same key collapses on the unique index.
    expect(one(ev).dedupe_key).toBe(d.dedupe_key);
  });

  it("null packet -> null dedupe_key (cannot dedupe org-level events)", () => {
    const d = one({ ...ev, packetId: null });
    expect(d.dedupe_key).toBeNull();
  });
});

describe("buildNotifications — packet_status_change", () => {
  const base: PacketStatusChangeEvent = {
    type: "packet_status_change",
    orgId: ORG,
    packetId: PKT,
    source: "api:navigator",
    fromStatus: "In Navigator Review",
    toStatus: "Ready for Handoff",
    occurredAt: "2026-06-05T00:00:00Z",
  };

  it("non-action status -> info severity", () => {
    expect(one(base).severity).toBe("info");
  });

  it('"Needs Documents" -> action severity', () => {
    const d = one({ ...base, toStatus: "Needs Documents" });
    expect(d.severity).toBe("action");
  });

  it("encodes from/to + occurredAt in dedupe_key and payload", () => {
    const d = one(base);
    expect(d.dedupe_key).toBe(`status:${PKT}:Ready for Handoff:2026-06-05T00:00:00Z`);
    expect(d.payload).toMatchObject({
      from_status: "In Navigator Review",
      to_status: "Ready for Handoff",
    });
  });

  it("null fromStatus -> 'is now' phrasing", () => {
    const d = one({ ...base, fromStatus: null });
    expect(d.body).toContain("is now");
  });
});

describe("buildNotifications — recert_due", () => {
  const base: RecertDueEvent = {
    type: "recert_due",
    orgId: ORG,
    packetId: PKT,
    source: "cron:recert-sweep",
    certPeriodEnd: "2026-07-01",
    daysUntilDue: 20,
  };

  it("far out -> info", () => {
    expect(one(base).severity).toBe("info");
  });
  it("within a week -> action", () => {
    expect(one({ ...base, daysUntilDue: 5 }).severity).toBe("action");
  });
  it("lapsed -> urgent + overdue title", () => {
    const d = one({ ...base, daysUntilDue: -3 });
    expect(d.severity).toBe("urgent");
    expect(d.title).toBe("Recertification overdue");
    expect(d.body).toContain("3d ago");
  });
});

describe("buildNotifications — recommendation_generated", () => {
  const base: RecommendationGeneratedEvent = {
    type: "recommendation_generated",
    orgId: ORG,
    packetId: PKT,
    source: "engine:recommendation",
    recommendationId: "rec-7",
    urgencyTier: "opportunity",
    summary: "Ask about utility costs to unlock the SUA deduction.",
  };

  it("maps urgency tiers to severities", () => {
    expect(one(base).severity).toBe("info");
    expect(
      one({ ...base, urgencyTier: "accuracy_risk" }).severity,
    ).toBe("action");
    expect(
      one({ ...base, urgencyTier: "verdict_threatening" }).severity,
    ).toBe("urgent");
  });

  it("carries recommendation context into the payload", () => {
    const d = one({ ...base, context: { axis: "utility_costs" } });
    expect(d.payload).toMatchObject({
      recommendation_id: "rec-7",
      urgency_tier: "opportunity",
      axis: "utility_costs",
    });
  });
});

describe("DV-safety invariant — safety axes never ride a notification", () => {
  it("sanitizePayload drops every SAFETY_KEY (case-insensitive)", () => {
    const dirty = {
      monthly_income_usd: 2000,
      contact_safety_concern: true,
      DV_Flag: "yes",
      domestic_violence: "present",
      keep_me: 1,
    };
    const clean = sanitizePayload(dirty);
    expect(clean).toEqual({ monthly_income_usd: 2000, keep_me: 1 });
    for (const k of SAFETY_KEYS) {
      expect(Object.keys(clean).map((x) => x.toLowerCase())).not.toContain(k);
    }
  });

  it("a recommendation context with a safety flag never reaches the row", () => {
    const d = one({
      type: "recommendation_generated",
      orgId: ORG,
      packetId: PKT,
      source: "engine:recommendation",
      recommendationId: "rec-9",
      urgencyTier: "accuracy_risk",
      summary: "Confirm shelter costs.",
      context: { contact_safety_concern: true, shelter_usd: 1400 },
    });
    const serialized = JSON.stringify(d).toLowerCase();
    expect(serialized).not.toContain("contact_safety_concern");
    expect(serialized).not.toContain("safety");
    expect(d.payload).toMatchObject({ shelter_usd: 1400 });
  });
});

describe("dispatchNotifications — resilient writer", () => {
  const drafts: NotificationDraft[] = buildNotifications({
    type: "cliff_event",
    orgId: ORG,
    packetId: PKT,
    source: "system:argyle-webhook",
    monthlyIncomeUsd: 2200,
    payDate: "2026-06-01",
  });

  it("empty drafts short-circuits without touching the db", async () => {
    const { db, schema } = makeDb(null);
    const res = await dispatchNotifications(db, []);
    expect(res).toEqual({ attempted: 0, tableMissing: false, error: null });
    expect(schema).not.toHaveBeenCalled();
  });

  it("happy path inserts with ON CONFLICT DO NOTHING on dedupe_key", async () => {
    const { db, upsert } = makeDb(null);
    const res = await dispatchNotifications(db, drafts);
    expect(res.error).toBeNull();
    expect(res.tableMissing).toBe(false);
    expect(upsert).toHaveBeenCalledWith(drafts, {
      onConflict: "dedupe_key",
      ignoreDuplicates: true,
    });
  });

  it("swallows 42P01 (table not migrated yet) -> tableMissing, no error", async () => {
    const { db } = makeDb({ code: "42P01", message: 'relation "notifications" does not exist' });
    const res = await dispatchNotifications(db, drafts);
    expect(res.tableMissing).toBe(true);
    expect(res.error).toBeNull();
  });

  it("passes through a real db error", async () => {
    const { db } = makeDb({ code: "23503", message: "fk violation" });
    const res = await dispatchNotifications(db, drafts);
    expect(res.tableMissing).toBe(false);
    expect(res.error).toBe("fk violation");
  });

  it("emitNotification never throws even if the client blows up", async () => {
    const db = {
      schema: () => {
        throw new Error("boom");
      },
    } as unknown as NotificationsDb;
    const res = await emitNotification(db, {
      type: "cliff_event",
      orgId: ORG,
      packetId: PKT,
      source: "system:argyle-webhook",
      monthlyIncomeUsd: 2200,
    });
    expect(res.error).toBe("boom");
    expect(res.attempted).toBe(0);
  });
});
