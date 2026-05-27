import { describe, it, expect } from "vitest";
import { resolveCounties, isStatewideFallback } from "./county.js";

describe("resolveCounties", () => {
  it("returns both counties when both are present", () => {
    expect(resolveCounties("06037", "06075")).toEqual(["06037", "06075"]);
  });

  it("dedupes when packet and current are the same county", () => {
    expect(resolveCounties("06037", "06037")).toEqual(["06037"]);
  });

  it("returns packet only when current is null", () => {
    expect(resolveCounties("06037", null)).toEqual(["06037"]);
  });

  it("returns current only when packet is null", () => {
    expect(resolveCounties(null, "06037")).toEqual(["06037"]);
  });

  it("falls back to STATEWIDE when both are null", () => {
    expect(resolveCounties(null, null)).toEqual(["STATEWIDE"]);
  });

  it("falls back to STATEWIDE when both are undefined", () => {
    expect(resolveCounties()).toEqual(["STATEWIDE"]);
  });

  it("rejects non-5-digit input (drops to fallback if no valid)", () => {
    expect(resolveCounties("06", "abcde")).toEqual(["STATEWIDE"]);
    expect(resolveCounties("06037x", "075")).toEqual(["STATEWIDE"]);
  });

  it("accepts the valid one when the other is malformed", () => {
    expect(resolveCounties("06037", "abc")).toEqual(["06037"]);
  });
});

describe("isStatewideFallback", () => {
  it("returns true only for the lone STATEWIDE bucket", () => {
    expect(isStatewideFallback(["STATEWIDE"])).toBe(true);
    expect(isStatewideFallback(["06037"])).toBe(false);
    expect(isStatewideFallback(["STATEWIDE", "06037"])).toBe(false);
    expect(isStatewideFallback([])).toBe(false);
  });
});
