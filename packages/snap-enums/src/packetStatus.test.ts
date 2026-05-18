import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { PACKET_STATUSES, PacketStatusSchema, PACKET_STATUS_TRANSITIONS } from "./packetStatus.js";

const CANONICAL_ORDER = [
  "Draft",
  "Submitted for Review",
  "Needs Documents",
  "Needs Applicant Clarification",
  "In Navigator Review",
  "Ready for Handoff",
  "Handed Off",
  "Closed",
] as const;

describe("PACKET_STATUSES", () => {
  it("contains exactly the 8 canonical labels in the correct order", () => {
    expect(Array.from(PACKET_STATUSES)).toStrictEqual(Array.from(CANONICAL_ORDER));
  });

  it("Zod schema accepts all 8 canonical labels", () => {
    for (const status of CANONICAL_ORDER) {
      expect(() => PacketStatusSchema.parse(status)).not.toThrow();
    }
  });

  it("Zod schema rejects outcome vocabulary not in the lifecycle", () => {
    const invalid = ["Approved", "Denied", "Eligible", "Ineligible", "Pending", ""];
    for (const bad of invalid) {
      expect(() => PacketStatusSchema.parse(bad)).toThrow();
    }
  });
});

describe("PACKET_STATUS_TRANSITIONS", () => {
  it("has an entry for every status in PACKET_STATUSES", () => {
    for (const status of PACKET_STATUSES) {
      expect(Object.prototype.hasOwnProperty.call(PACKET_STATUS_TRANSITIONS, status)).toBe(true);
    }
  });

  it("Closed is a terminal state with no outbound transitions", () => {
    expect(PACKET_STATUS_TRANSITIONS["Closed"]).toStrictEqual([]);
  });

  it("Draft only allows forward move to Submitted for Review", () => {
    expect(PACKET_STATUS_TRANSITIONS["Draft"]).toStrictEqual(["Submitted for Review"]);
  });

  it("Ready for Handoff only transitions to Handed Off", () => {
    expect(PACKET_STATUS_TRANSITIONS["Ready for Handoff"]).toStrictEqual(["Handed Off"]);
  });

  it("Handed Off only transitions to Closed", () => {
    expect(PACKET_STATUS_TRANSITIONS["Handed Off"]).toStrictEqual(["Closed"]);
  });

  it("In Navigator Review can branch to three follow-on states", () => {
    const targets = PACKET_STATUS_TRANSITIONS["In Navigator Review"];
    expect(targets).toContain("Ready for Handoff");
    expect(targets).toContain("Needs Documents");
    expect(targets).toContain("Needs Applicant Clarification");
    expect(targets).toHaveLength(3);
  });

  it("all transition targets are themselves valid statuses", () => {
    const valid = new Set<string>(PACKET_STATUSES);
    for (const targets of Object.values(PACKET_STATUS_TRANSITIONS)) {
      for (const t of targets) {
        expect(valid.has(t), `"${t}" is not a valid PacketStatus`).toBe(true);
      }
    }
  });
});

describe("Migration parity", () => {
  it("TypeScript enum values match the Postgres packet_status enum in supabase/migrations", () => {
    const migrationUrl = new URL(
      "../../../supabase/migrations/20260516_snap_enrollment_01_types_and_extensions.sql",
      import.meta.url,
    );
    const sql = readFileSync(migrationUrl, "utf-8");

    const match = sql.match(
      /create type snap_enrollment\.packet_status as enum \(([\s\S]*?)\)/,
    );
    expect(match, "packet_status enum block not found in migration").not.toBeNull();

    const sqlValues = match![1]!
      .split(",")
      .map((v) => v.trim().replace(/^'|'$/g, ""))
      .filter(Boolean);

    expect(sqlValues).toStrictEqual(Array.from(PACKET_STATUSES));
  });
});
