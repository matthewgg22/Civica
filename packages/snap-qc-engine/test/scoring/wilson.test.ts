import { describe, it, expect } from "vitest";
import { wilsonInterval } from "../../src/scoring/wilson";

// Reference values computed from the Wilson score-interval formula at z = 1.96
// (95%). Cross-checked against the standard closed form; see wilson.ts header.
describe("wilsonInterval", () => {
  it("n = 0 returns rate 0 with the maximally uncertain band [0, 1]", () => {
    const r = wilsonInterval(0, 0);
    expect(r).toEqual({ errors: 0, n: 0, rate: 0, lower: 0, upper: 1 });
  });

  it("0 / 10 — point estimate 0% but honest non-zero upper bound (~0.2775)", () => {
    const r = wilsonInterval(0, 10);
    expect(r.rate).toBe(0);
    expect(r.lower).toBe(0); // clamped
    expect(r.upper).toBeCloseTo(0.27754, 4);
  });

  it("5 / 10 — 50% rate, symmetric band (~[0.2366, 0.7634])", () => {
    const r = wilsonInterval(5, 10);
    expect(r.rate).toBe(0.5);
    expect(r.lower).toBeCloseTo(0.23659, 4);
    expect(r.upper).toBeCloseTo(0.76341, 4);
  });

  it("1 / 1 — 100% rate but wide band (~[0.2065, 1.0]); the small-N privacy signal", () => {
    const r = wilsonInterval(1, 1);
    expect(r.rate).toBe(1);
    expect(r.lower).toBeCloseTo(0.20654, 4);
    expect(r.upper).toBe(1); // clamped
  });

  it("10 / 100 — 10% rate with a tight band as n grows (~[0.0552, 0.1744])", () => {
    const r = wilsonInterval(10, 100);
    expect(r.rate).toBe(0.1);
    expect(r.lower).toBeCloseTo(0.05523, 4);
    expect(r.upper).toBeCloseTo(0.17437, 4);
  });

  it("a wider z widens the interval (99% band contains the 95% band)", () => {
    const at95 = wilsonInterval(5, 10, 1.96);
    const at99 = wilsonInterval(5, 10, 2.5758);
    expect(at99.lower).toBeLessThan(at95.lower);
    expect(at99.upper).toBeGreaterThan(at95.upper);
  });

  it("rejects errors > n", () => {
    expect(() => wilsonInterval(3, 2)).toThrow(RangeError);
  });

  it("rejects negative inputs", () => {
    expect(() => wilsonInterval(-1, 10)).toThrow(RangeError);
    expect(() => wilsonInterval(1, -10)).toThrow(RangeError);
  });
});
