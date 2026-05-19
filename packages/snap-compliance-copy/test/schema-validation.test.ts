import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  BannedPhrasesFileSchema,
  PendingRevisionsFileSchema,
} from "../src/schemas";

const DATA_DIR = resolve(__dirname, "..", "data");

describe("data JSON files", () => {
  it("_banned-phrases.json parses against the schema", () => {
    const raw = JSON.parse(
      readFileSync(resolve(DATA_DIR, "_banned-phrases.json"), "utf8"),
    );
    const parsed = BannedPhrasesFileSchema.parse(raw);
    expect(parsed.entries.length).toBeGreaterThan(0);
  });

  it("_pending-revisions.json parses against the schema", () => {
    const raw = JSON.parse(
      readFileSync(resolve(DATA_DIR, "_pending-revisions.json"), "utf8"),
    );
    const parsed = PendingRevisionsFileSchema.parse(raw);
    expect(parsed.entries.length).toBeGreaterThan(0);
  });

  it("every JSON file in data/ is one of the known registry files", () => {
    const files = readdirSync(DATA_DIR).filter((f) => f.endsWith(".json"));
    for (const f of files) {
      expect(["_banned-phrases.json", "_pending-revisions.json"]).toContain(f);
    }
  });

  it("ids are unique within each registry", () => {
    const banned = BannedPhrasesFileSchema.parse(
      JSON.parse(readFileSync(resolve(DATA_DIR, "_banned-phrases.json"), "utf8")),
    );
    const revisions = PendingRevisionsFileSchema.parse(
      JSON.parse(
        readFileSync(resolve(DATA_DIR, "_pending-revisions.json"), "utf8"),
      ),
    );
    expect(new Set(banned.entries.map((e) => e.id)).size).toBe(
      banned.entries.length,
    );
    expect(new Set(revisions.entries.map((e) => e.id)).size).toBe(
      revisions.entries.length,
    );
  });
});
