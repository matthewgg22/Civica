import { describe, it, expect } from "vitest";
import { resolvePath } from "../src/payload-path";

describe("resolvePath", () => {
  it("returns null for a null/undefined root", () => {
    expect(resolvePath(null, "foo")).toBeNull();
    expect(resolvePath(undefined, "foo")).toBeNull();
  });

  it("resolves a flat key", () => {
    expect(resolvePath({ first_name: "Maria" }, "first_name")).toBe("Maria");
  });

  it("resolves a nested key", () => {
    expect(resolvePath({ address: { zip: "94601" } }, "address.zip")).toBe("94601");
  });

  it("resolves an array index", () => {
    expect(
      resolvePath(
        { household_members: [{ first_name: "Carlos" }] },
        "household_members[0].first_name",
      ),
    ).toBe("Carlos");
  });

  it("returns null for missing segments", () => {
    expect(resolvePath({ a: { b: 1 } }, "a.c")).toBeNull();
    expect(resolvePath({ a: [{ b: 1 }] }, "a[5].b")).toBeNull();
  });

  it("returns null when a segment has a malformed syntax", () => {
    expect(resolvePath({ a: 1 }, "a..b")).toBeNull();
    expect(resolvePath({ a: 1 }, "")).toBeNull();
  });

  it("returns null when bracket index is used on a non-array", () => {
    expect(resolvePath({ a: "string" }, "a[0]")).toBeNull();
  });

  it("works with the BenefitsCalPayload-ish shape", () => {
    const payload = {
      packet_id: "p1",
      first_name: "Ana",
      address: { street: "1 Main", city: "Oakland", state: "CA", zip: "94601" },
      household_members: [
        { first_name: "Luis", last_name: "Ortiz" },
        { first_name: "Sofia", last_name: "Ortiz" },
      ],
    };
    expect(resolvePath(payload, "first_name")).toBe("Ana");
    expect(resolvePath(payload, "address.state")).toBe("CA");
    expect(resolvePath(payload, "household_members[1].first_name")).toBe("Sofia");
    expect(resolvePath(payload, "household_members[2].first_name")).toBeNull();
  });
});
