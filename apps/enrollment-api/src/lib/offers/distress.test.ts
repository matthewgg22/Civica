import { describe, it, expect } from "vitest";
import { isDistressed } from "./distress.js";
import { makeDbClient } from "../../test/helpers.js";

describe("isDistressed", () => {
  it("returns true when at least one active flag exists", async () => {
    const db = makeDbClient({ data: [{ flag_id: "f1" }], error: null });
    expect(await isDistressed(db, "user-001")).toBe(true);
  });

  it("returns false when no active flags exist", async () => {
    const db = makeDbClient({ data: [], error: null });
    expect(await isDistressed(db, "user-001")).toBe(false);
  });

  it("fails closed (treats as distressed) when the query errors", async () => {
    const db = makeDbClient({ data: null, error: { message: "supabase blip" } });
    expect(await isDistressed(db, "user-001")).toBe(true);
  });

  it("returns false when data is null but no error (shouldn't happen, but defensive)", async () => {
    const db = makeDbClient({ data: null, error: null });
    expect(await isDistressed(db, "user-001")).toBe(false);
  });
});
