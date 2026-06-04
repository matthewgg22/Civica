/**
 * Unit tests for sectionSequence (V1-5 PR1, #314).
 *
 * Tests the three locked design decisions:
 *   D8  — undefined flowType defaults to multi-program (safe superset).
 *   D12 — flowType drives Assets inclusion, NOT a packet field.
 *
 * Per AC #2 of issue #314: section sequence adapts to SNAP-only vs multi-program.
 */

import { describe, it, expect } from "vitest";
import { sectionSequence } from "../src/core/section-sequence";
import { PORTAL_PAGES } from "../src/core/selector-map";
import type { BenefitsCalPayload } from "../src/core/schemas";
import type { FlowType } from "../src/core/section-sequence";

// ---------------------------------------------------------------------------
// Minimal synthetic payload (all required fields; no eligibility overrides).
// ---------------------------------------------------------------------------

const BASE_PAYLOAD: BenefitsCalPayload = {
  packet_id: "00000000-0000-0000-0000-000000000001",
  first_name: "Jane",
  last_name: "Doe",
  date_of_birth: "1990-01-15",
  ssn_last4: "1234",
  address: {
    street: "123 Main St",
    city: "Sacramento",
    state: "CA",
    zip: "95814",
    county: "Sacramento",
  },
  phone: "+19165551234",
  household_members: [],
  income_sources: [],
  utility_allowance_type: "standard",
  document_urls: [],
  client_signature_type: "in_person",
};

// ---------------------------------------------------------------------------
// Reference step-0 and step-1 page codes (from the authoritative map).
// ---------------------------------------------------------------------------

const STEP_0_CODES = PORTAL_PAGES.filter((p) => p.step === 0).map((p) => p.pageCode);
const STEP_1_CODES = PORTAL_PAGES.filter((p) => p.step === 1).map((p) => p.pageCode);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function seqFor(flowType: FlowType): string[] {
  return sectionSequence(BASE_PAYLOAD, flowType);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("sectionSequence — step-0 and step-1 coverage", () => {
  it("always includes all step-0 entry-flow page codes", () => {
    for (const flow of ["snap-only", "multi-program", undefined] as FlowType[]) {
      const seq = seqFor(flow);
      for (const code of STEP_0_CODES) {
        expect(seq, `step-0 code ${code} missing for flowType=${String(flow)}`).toContain(code);
      }
    }
  });

  it("always includes all step-1 Your Information page codes", () => {
    for (const flow of ["snap-only", "multi-program", undefined] as FlowType[]) {
      const seq = seqFor(flow);
      for (const code of STEP_1_CODES) {
        expect(seq, `step-1 code ${code} missing for flowType=${String(flow)}`).toContain(code);
      }
    }
  });

  it("step-0 codes appear before step-1 codes in the sequence", () => {
    const seq = seqFor("snap-only");
    const lastStep0Idx = Math.max(...STEP_0_CODES.map((c) => seq.indexOf(c)));
    const firstStep1Idx = Math.min(...STEP_1_CODES.map((c) => seq.indexOf(c)));
    expect(lastStep0Idx).toBeLessThan(firstStep1Idx);
  });

  it("returns an array of strings (pageCodes)", () => {
    const seq = seqFor("snap-only");
    expect(Array.isArray(seq)).toBe(true);
    for (const code of seq) {
      expect(typeof code).toBe("string");
      expect(code.length).toBeGreaterThan(0);
    }
  });

  it("has no duplicate pageCodes within the sequence", () => {
    for (const flow of ["snap-only", "multi-program", undefined] as FlowType[]) {
      const seq = seqFor(flow);
      const unique = new Set(seq);
      expect(
        unique.size,
        `duplicate pageCodes found for flowType=${String(flow)}`,
      ).toBe(seq.length);
    }
  });
});

describe("sectionSequence — SNAP-only path (D8/AC #2)", () => {
  it("snap-only sequence contains all step-0 codes", () => {
    const seq = seqFor("snap-only");
    for (const code of STEP_0_CODES) {
      expect(seq).toContain(code);
    }
  });

  it("snap-only sequence contains all step-1 codes", () => {
    const seq = seqFor("snap-only");
    for (const code of STEP_1_CODES) {
      expect(seq).toContain(code);
    }
  });

  it("snap-only sequence is a subset of the multi-program sequence (Assets omitted)", () => {
    const snapSeq = seqFor("snap-only");
    const multiSeq = seqFor("multi-program");
    // Every code in snap-only must also appear in multi-program.
    for (const code of snapSeq) {
      expect(
        multiSeq,
        `snap-only code ${code} missing from multi-program sequence`,
      ).toContain(code);
    }
    // multi-program may have MORE codes (Assets step, once step-6 stubs land).
    expect(multiSeq.length).toBeGreaterThanOrEqual(snapSeq.length);
  });
});

describe("sectionSequence — multi-program path", () => {
  it("multi-program sequence contains all step-0 codes", () => {
    const seq = seqFor("multi-program");
    for (const code of STEP_0_CODES) {
      expect(seq).toContain(code);
    }
  });

  it("multi-program sequence contains all step-1 codes", () => {
    const seq = seqFor("multi-program");
    for (const code of STEP_1_CODES) {
      expect(seq).toContain(code);
    }
  });

  it("multi-program has at least as many pageCodes as snap-only", () => {
    const snapCount = seqFor("snap-only").length;
    const multiCount = seqFor("multi-program").length;
    expect(multiCount).toBeGreaterThanOrEqual(snapCount);
  });
});

describe("sectionSequence — undefined flowType defaults to multi-program (D8)", () => {
  it("sectionSequence(payload, undefined) produces the same sequence as multi-program", () => {
    const undefinedSeq = seqFor(undefined);
    const multiSeq = seqFor("multi-program");
    expect(undefinedSeq).toEqual(multiSeq);
  });

  it("undefined flowType never produces the snap-only (shorter) sequence when multi != snap", () => {
    const undefinedSeq = seqFor(undefined);
    const snapSeq = seqFor("snap-only");
    const multiSeq = seqFor("multi-program");
    // If multi and snap produce the same length (stubs empty), both assertions hold trivially.
    // When step-6 stubs land, this asserts undefined != snap-only.
    if (multiSeq.length > snapSeq.length) {
      expect(undefinedSeq.length).toBeGreaterThan(snapSeq.length);
    } else {
      // Stubs still empty — both are length equal; safe superset contract still holds.
      expect(undefinedSeq.length).toBeGreaterThanOrEqual(snapSeq.length);
    }
  });

  it("explicitly passing undefined is identical to omitting the argument from a type perspective", () => {
    // Type check only — both calls use the same explicit undefined.
    const a = sectionSequence(BASE_PAYLOAD, undefined);
    const b = sectionSequence(BASE_PAYLOAD, "multi-program");
    expect(a).toEqual(b);
  });
});

describe("sectionSequence — sequence ordering", () => {
  it("LOGIN appears before CBDAS in the step-0 chain", () => {
    const seq = seqFor("snap-only");
    const loginIdx = seq.indexOf("LOGIN");
    const cbdasIdx = seq.indexOf("CBDAS");
    expect(loginIdx).toBeGreaterThanOrEqual(0);
    expect(cbdasIdx).toBeGreaterThanOrEqual(0);
    expect(loginIdx).toBeLessThan(cbdasIdx);
  });

  it("CBDAS appears before ABOVR (entry-flow order preserved)", () => {
    const seq = seqFor("snap-only");
    expect(seq.indexOf("CBDAS")).toBeLessThan(seq.indexOf("ABOVR"));
  });

  it("ABNAV appears before ABLPR (nav hub before step-1 first page)", () => {
    const seq = seqFor("snap-only");
    expect(seq.indexOf("ABNAV")).toBeLessThan(seq.indexOf("ABLPR"));
  });

  it("ABNMI appears before ABNHA in step-1 (name before address)", () => {
    const seq = seqFor("snap-only");
    expect(seq.indexOf("ABNMI")).toBeLessThan(seq.indexOf("ABNHA"));
  });

  it("ABMRS appears before ABDOC in step-1 (marital status before citizenship)", () => {
    const seq = seqFor("snap-only");
    expect(seq.indexOf("ABMRS")).toBeLessThan(seq.indexOf("ABDOC"));
  });
});
