// Tests for the keyword-based topic classifier.
//
// Focus: classification accuracy on real-world snippets we expect to
// see in the wild (Federal Register notices, CDSS ACL titles, etc.),
// PLUS deliberate negative cases (text that mentions adjacent topics
// but shouldn't trigger a match).

import { describe, expect, it } from "vitest";

import {
  classifyTopics,
  getAllTopicTags,
  type TopicTag,
} from "./topic-classifier.js";

describe("classifyTopics — empty / no-match cases", () => {
  it("returns empty array on empty input", () => {
    expect(classifyTopics("")).toEqual([]);
    expect(classifyTopics("", "")).toEqual([]);
  });

  it("returns empty array on no-match input", () => {
    expect(
      classifyTopics(
        "This document discusses general welfare administration practices.",
      ),
    ).toEqual([]);
  });

  it("returns empty array when keywords are substrings of unrelated words", () => {
    // "cobra" contains "cola" as substring — but the COLA topic should
    // only match on word-boundary or canonical phrase.
    // (Current impl is substring-based for non-regex; this test will
    // need updating if we tighten boundaries.)
    // Documenting current behavior: substring matches happen.
    expect(classifyTopics("Cobra benefit COBRA premium")).toEqual([]);
  });
});

describe("classifyTopics — case insensitivity", () => {
  it("matches regardless of input case", () => {
    expect(classifyTopics("OBBBA implementation")).toContain("obbba");
    expect(classifyTopics("obbba implementation")).toContain("obbba");
    expect(classifyTopics("Obbba implementation")).toContain("obbba");
  });

  it("matches multi-word phrases regardless of internal casing", () => {
    expect(
      classifyTopics("One Big Beautiful Bill Act guidance"),
    ).toContain("obbba");
    expect(
      classifyTopics("ONE BIG BEAUTIFUL BILL implementation memo"),
    ).toContain("obbba");
  });
});

describe("classifyTopics — single topic matches", () => {
  it("classifies OBBBA references", () => {
    expect(classifyTopics("OBBBA Section 4501 implementation")).toContain(
      "obbba",
    );
    expect(classifyTopics("Public Law 119-21 implementation memo")).toContain(
      "obbba",
    );
    expect(classifyTopics("H.R. 1 SNAP eligibility changes")).toContain(
      "obbba",
    );
    expect(classifyTopics("HR1 work requirements expansion")).toContain(
      "obbba",
    );
  });

  it("classifies ABAWD references", () => {
    expect(classifyTopics("ABAWD time limit handbook v3.0")).toContain(
      "abawd",
    );
    expect(
      classifyTopics("able-bodied adults without dependents waiver"),
    ).toContain("abawd");
  });

  it("classifies BBCE without false-matching adjacent words", () => {
    expect(classifyTopics("BBCE policy guidance")).toContain("bbce");
    expect(
      classifyTopics("Broad-Based Categorical Eligibility update"),
    ).toContain("bbce");
    // Negative: BBCE should match on word-boundary only via regex
    expect(classifyTopics("BBCED is not real")).not.toContain("bbce");
  });

  it("classifies shelter deductions", () => {
    expect(
      classifyTopics(
        "Standard Utility Allowance methodology — SUA updates for 2026",
      ),
    ).toContain("shelter_deduction");
    expect(classifyTopics("homeless shelter deduction reform")).toContain(
      "shelter_deduction",
    );
  });

  it("classifies COLA / thrifty food plan", () => {
    expect(
      classifyTopics(
        "Cost of Living Adjustment for federal fiscal year 2027",
      ),
    ).toContain("cola");
    expect(classifyTopics("Thrifty Food Plan re-evaluation")).toContain(
      "cola",
    );
  });

  it("classifies recertification", () => {
    expect(
      classifyTopics("CalFresh recertification timeline changes"),
    ).toContain("recertification");
    expect(classifyTopics("interim report requirements update")).toContain(
      "recertification",
    );
  });
});

describe("classifyTopics — multi-topic matches", () => {
  it("returns multiple topics when keywords from different topics co-occur", () => {
    const tags = classifyTopics(
      "OBBBA implementation: ABAWD work requirements expansion",
    );
    expect(tags).toContain("obbba");
    expect(tags).toContain("abawd");
    expect(tags).toContain("work_requirement");
  });

  it("real CDSS ACL 26-29 title — ABAWD time limit handbook", () => {
    const tags = classifyTopics(
      "CalFresh Able-Bodied Adults Without Dependents Time Limit Handbook Version 3.0",
    );
    expect(tags).toContain("abawd");
    expect(tags).toContain("work_requirement"); // "time limit" matches
  });

  it("real Federal Register SNAP notice — SUA + Self-Employment", () => {
    const tags = classifyTopics(
      "Agency Information Collection Activities: Supplemental Nutrition Assistance Program: State Agency Options for Standard Utility Allowances and Self-Employment Income",
    );
    expect(tags).toContain("shelter_deduction");
  });

  it("preserves vocabulary order in returned tags (stable for tests)", () => {
    // obbba comes before abawd in vocabulary; expect that order.
    const tags = classifyTopics("ABAWD updates per OBBBA mandate");
    const obbbaIdx = tags.indexOf("obbba");
    const abawdIdx = tags.indexOf("abawd");
    expect(obbbaIdx).toBeGreaterThanOrEqual(0);
    expect(abawdIdx).toBeGreaterThanOrEqual(0);
    expect(obbbaIdx).toBeLessThan(abawdIdx);
  });

  it("does not return duplicate tags even with multiple keyword hits", () => {
    const tags = classifyTopics(
      "ABAWD policy update for able-bodied adults without dependents",
    );
    const abawdMatches = tags.filter((t) => t === "abawd").length;
    expect(abawdMatches).toBe(1);
  });
});

describe("classifyTopics — input combination", () => {
  it("concatenates multiple inputs before classifying", () => {
    expect(
      classifyTopics("Title only", "ABAWD mentioned in body"),
    ).toContain("abawd");
  });

  it("works with empty strings mixed in", () => {
    expect(classifyTopics("", "OBBBA section 4501", "")).toContain("obbba");
  });
});

describe("classifyTopics — false-positive regressions", () => {
  // Regression: prior to the fix, the error_rate topic used a
  // case-insensitive /\bper\b/i regex. Every CDSS ACL payload contains
  // "per" as an ordinary preposition ("per the regulations") which
  // false-positive-tagged every CA snapshot with error_rate.
  //
  // Verified in prod 2026-05-29: all four ca-cdss-acl rows from
  // 2026-05-28 23:36 → 2026-05-29 12:25 carried error_rate despite
  // CDSS not publishing PER data this period.
  //
  // Fix: only match the uppercase canonical acronym "PER" (the SNAP
  // term of art); the lowercase preposition is too common to disambiguate.

  it("does NOT tag error_rate on 'per the regulations' (common preposition)", () => {
    expect(classifyTopics("Per the regulations, applicants must...")).not.toContain(
      "error_rate",
    );
  });

  it("does NOT tag error_rate on 'per applicant' or 'as per CDSS'", () => {
    expect(classifyTopics("Income limits per applicant per month")).not.toContain(
      "error_rate",
    );
    expect(classifyTopics("As per CDSS ACL 26-29")).not.toContain("error_rate");
  });

  it("DOES tag error_rate on the canonical uppercase SNAP acronym 'PER'", () => {
    expect(classifyTopics("The PER for FY2026 is 6.2%")).toContain("error_rate");
    expect(classifyTopics("PER computation methodology")).toContain("error_rate");
  });

  it("DOES tag error_rate on spelled-out phrases (case-insensitive)", () => {
    expect(classifyTopics("Payment Error Rate quarterly report")).toContain(
      "error_rate",
    );
    expect(
      classifyTopics("Case and Procedural Error Rate findings"),
    ).toContain("error_rate");
  });

  it("real ACL title pattern from CDSS does NOT trigger error_rate", () => {
    // CDSS ACL 26-30 — "CalFresh Employment And Training Civil Rights Notice"
    // contains no PER-related content. The /\bper\b/i regression flagged
    // it because the JSON-stringified payload included words like
    // "Information per County" or similar boilerplate elsewhere on the page.
    const tags = classifyTopics(
      "CalFresh Employment And Training Civil Rights Notice as per CDSS",
    );
    expect(tags).not.toContain("error_rate");
  });
});

describe("getAllTopicTags — vocabulary completeness", () => {
  it("returns the full vocabulary in declared order", () => {
    const all = getAllTopicTags();
    // Spot-check: vocabulary should have at least 10 topics per design.
    expect(all.length).toBeGreaterThanOrEqual(10);
    expect(all[0]).toBe("obbba"); // first in declared order
  });

  it("every topic tag is enumerable via getAllTopicTags", () => {
    const known: TopicTag[] = [
      "obbba",
      "abawd",
      "work_requirement",
      "shelter_deduction",
      "bbce",
      "immigrant_eligibility",
      "cola",
      "error_rate",
      "waiver",
      "recertification",
    ];
    const all = getAllTopicTags();
    for (const tag of known) {
      expect(all).toContain(tag);
    }
  });
});
