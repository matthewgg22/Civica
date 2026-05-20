import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  DocumentStatusSchema,
  PRE_REVIEW_STATUSES,
  REVIEW_READY_STATUSES,
  TERMINAL_STATUSES,
  type DocumentStatus,
} from "./documentEnums";

// Canonical order matches supabase/migrations/20260518_snap_enrollment_03_tables_documents.sql
const CANONICAL_ORDER: readonly DocumentStatus[] = [
  "uploaded",
  "classifying",
  "extracting",
  "awaiting_confirmation",
  "confirmed",
  "rejected",
] as const;

describe("DocumentStatusSchema", () => {
  it("matches canonical 6-value DB ordering", () => {
    expect(DocumentStatusSchema.options).toEqual(CANONICAL_ORDER);
  });

  it("matches the DB CHECK constraint values in supabase/migrations", () => {
    // Read the migration that owns the processing_status check, parse the
    // enum literal list out of it, and compare to the Zod schema. This is the
    // tripwire that catches DB↔code drift (e.g. PR #217 / this PR).
    const migrationPath = resolve(
      __dirname,
      "../../../supabase/migrations/20260518_snap_enrollment_03_tables_documents.sql",
    );
    const sql = readFileSync(migrationPath, "utf8");
    const match = sql.match(
      /processing_status\s+in\s*\(\s*([\s\S]+?)\s*\)/i,
    );
    expect(match, "expected to find processing_status CHECK constraint").toBeTruthy();
    const dbValues = match![1]
      .split(",")
      .map((s) => s.trim().replace(/^'|'$/g, ""))
      .filter(Boolean);
    expect(new Set(dbValues)).toEqual(new Set(CANONICAL_ORDER));
  });

  it("partitions every status into exactly one of pre-review / review-ready / terminal", () => {
    for (const status of DocumentStatusSchema.options) {
      const buckets = [
        PRE_REVIEW_STATUSES.has(status),
        REVIEW_READY_STATUSES.has(status),
        TERMINAL_STATUSES.has(status),
      ].filter(Boolean).length;
      expect(buckets, `status ${status} should be in exactly one bucket`).toBe(1);
    }
  });

  it("rejects legacy stale values", () => {
    for (const stale of ["pending", "uploading", "processing", "extracted", "failed", "complete"]) {
      expect(DocumentStatusSchema.safeParse(stale).success).toBe(false);
    }
  });
});
