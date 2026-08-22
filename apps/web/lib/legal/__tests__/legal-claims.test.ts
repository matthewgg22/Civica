// The claims test — what keeps these documents honest.
//
// A privacy policy is a set of factual assertions about a running system. Prose
// does not typecheck, so the assertions that CAN be mechanically checked are
// checked here: that a stated retention window matches the constant a purge job
// would enforce, that no document promises something the code does not do, and
// above all that nothing reaches "published" while a promise in it is untrue.
//
// This is the same idea as the existing retention-copy test (#703), which pins
// the in-chat privacy line so nobody can quietly restore "nothing is saved."
// Same failure mode, one level up: there, a UI string; here, the policy itself.

import { describe, expect, it } from "vitest";
import {
  DOCUMENTS,
  DOC_NAV,
  ENTITY,
  PRIVACY_POLICY,
  RETENTION_DAYS,
  RETENTION_JOB_LIVE,
  SAFETY_NOTICE,
  TERMS_OF_SERVICE,
  type Block,
  type LegalDocument,
} from "../index";

/** All prose in a document, flattened — every string a reader can see. */
function allText(doc: LegalDocument): string {
  const fromBlock = (b: Block): string => {
    switch (b.kind) {
      case "p":
      case "callout":
        return b.text;
      case "ul":
        return b.items.join(" ");
      case "table":
        return [...b.columns, ...b.rows.flat()].join(" ");
    }
  };
  return doc.sections
    .flatMap((s) => [s.heading, ...s.blocks.map(fromBlock)])
    .join("\n");
}

describe("publish gate", () => {
  // THE IMPORTANT ONE. The Privacy Policy states that question text is deleted
  // after N days. No job does that today — nothing has ever been deleted from
  // mae_query_log. Until one exists, that sentence is intent, not fact, and a
  // false privacy claim is the one error this product cannot afford to ship.
  it("no document is published while the retention job does not exist", () => {
    if (RETENTION_JOB_LIVE) return;
    for (const doc of DOCUMENTS) {
      expect(
        doc.status,
        `${doc.slug} claims a retention window but no purge job enforces it — ` +
          `build the job, point it at RETENTION_DAYS, set RETENTION_JOB_LIVE = true`,
      ).toBe("draft");
    }
  });

  it("published documents contain no unfilled placeholders", () => {
    for (const doc of DOCUMENTS.filter((d) => d.status === "published")) {
      const placeholders = allText(doc).match(/\[[A-Z][A-Z ]{3,}\]/g) ?? [];
      expect(placeholders, `${doc.slug} still has placeholders`).toEqual([]);
    }
  });
});

describe("retention claims match the constants", () => {
  it("the privacy policy states exactly the pinned windows", () => {
    const retention = PRIVACY_POLICY.sections.find((s) => s.id === "retention");
    expect(retention).toBeDefined();
    const text = retention!.blocks.map((b) => (b.kind === "ul" ? b.items.join(" ") : b.kind === "p" ? b.text : "")).join(" ");
    expect(text).toContain(`${RETENTION_DAYS.questionText} days`);
    expect(text).toContain(`${RETENTION_DAYS.flaggedRow} days`);
  });

  it("the collection table quotes the same windows", () => {
    const collect = PRIVACY_POLICY.sections.find((s) => s.id === "collect");
    const table = collect?.blocks.find((b) => b.kind === "table");
    expect(table, "the collection table is the summary people actually read").toBeDefined();
    const cells = (table as Extract<Block, { kind: "table" }>).rows.flat().join(" ");
    expect(cells).toContain(`${RETENTION_DAYS.questionText} days`);
    expect(cells).toContain(`${RETENTION_DAYS.flaggedRow} days`);
  });
});

describe("no document overclaims", () => {
  // The retention lie, in its several tempting forms. We DO keep the question
  // and the answer; any sentence implying otherwise is false, and it is exactly
  // the reassurance a well-meaning editor reaches for.
  const FORBIDDEN = [
    /nothing (here )?is saved/i,
    /we (do not|don't) (keep|store|record) (your )?(questions|conversations|anything)/i,
    /(deleted|erased) immediately/i,
    /100% (private|secure|anonymous)/i,
    /completely anonymous/i,
    /we (can'?t|cannot) see/i,
  ];

  for (const doc of DOCUMENTS) {
    it(`${doc.slug} makes no claim the code contradicts`, () => {
      const text = allText(doc);
      for (const pattern of FORBIDDEN) {
        expect(pattern.test(text), `${doc.slug} matches ${pattern}`).toBe(false);
      }
    });
  }

  it("the privacy policy says plainly that the question and answer are kept", () => {
    const text = allText(PRIVACY_POLICY).toLowerCase();
    expect(text).toContain("we keep the filtered question and the answer");
  });
});

describe("entity identity", () => {
  it("every document names the same operating entity", () => {
    for (const doc of DOCUMENTS) {
      expect(allText(doc), `${doc.slug} never names the entity`).toContain(ENTITY);
    }
  });

  // The nonprofit reincorporated; the former name must not survive anywhere in
  // a legal document, where it would be a misstatement of who the counterparty
  // is rather than merely stale branding.
  it("no document names a superseded entity", () => {
    for (const doc of DOCUMENTS) {
      expect(/VoteNow/i.test(allText(doc)), `${doc.slug} names VoteNow`).toBe(false);
    }
  });
});

describe("structure", () => {
  it("slugs are unique and match the nav", () => {
    const slugs = DOCUMENTS.map((d) => d.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(new Set(DOC_NAV.map((d) => d.slug))).toEqual(new Set(slugs));
  });

  it("section ids are unique within a document and every section has content", () => {
    for (const doc of DOCUMENTS) {
      const ids = doc.sections.map((s) => s.id);
      expect(new Set(ids).size, `${doc.slug} has duplicate section ids`).toBe(ids.length);
      for (const section of doc.sections) {
        expect(section.blocks.length, `${doc.slug}#${section.id} is empty`).toBeGreaterThan(0);
      }
    }
  });

  // CCPA §1798.135 requires the do-not-sell disclosure to be linkable. The
  // anchor is an external API: renaming it breaks inbound links.
  it("the CCPA do-not-sell anchor is stable", () => {
    expect(PRIVACY_POLICY.sections.map((s) => s.id)).toContain("do-not-sell");
  });
});

describe("terms fairness invariants", () => {
  // A class waiver whose opt-out is unreachable is both the thing courts strike
  // and the thing that would embarrass us with a referral partner. If the
  // waiver is in, the opt-out has to be in, and it has to be an email away.
  it("an arbitration waiver always ships with a workable opt-out", () => {
    const text = allText(TERMS_OF_SERVICE);
    const hasWaiver = /class action|jury/i.test(text);
    if (!hasWaiver) return;
    expect(/opt out/i.test(text), "waiver present with no opt-out").toBe(true);
    expect(text).toMatch(/30 days/);
    expect(text).toMatch(/legal@/);
  });

  it("the terms state that Demeter is not an eligibility determination", () => {
    const text = allText(TERMS_OF_SERVICE);
    expect(text).toMatch(/NOT AN ELIGIBILITY DETERMINATION/);
    expect(text).toMatch(/state SNAP agency/i);
  });

  it("the content license forecloses model training and sale", () => {
    const text = allText(TERMS_OF_SERVICE).toLowerCase();
    expect(text).toContain("does not permit us to train ai models");
  });
});

describe("safety notice", () => {
  // Given unconditionally, because the distress gate detects food and housing
  // crisis phrasing and NOT self-harm. Resources that depend on detection we do
  // not have would fail exactly when they are needed.
  it("gives crisis resources without conditioning them on detection", () => {
    const text = allText(SAFETY_NOTICE);
    expect(text).toContain("988");
    expect(text).toContain("1-800-799-7233");
    expect(text).toContain("211");
  });

  it("does not claim to detect self-harm", () => {
    const text = allText(SAFETY_NOTICE);
    // Affirmative claims only — the lookbehind is what lets the document keep
    // saying "it does NOT detect self-harm", which is the true sentence and the
    // one worth protecting. A blunter pattern flagged that sentence and would
    // have pressured a future editor into deleting the disclosure to get green.
    const claimsDetection = /(?<!\b(?:not|never|cannot|doesn't|don't)\s)(?:detects?|detecting|identifies)\s+(?:self-harm|suicid)/i;
    expect(claimsDetection.test(text), "safety notice claims self-harm detection").toBe(false);
    expect(text).toMatch(/not a crisis service/i);
    expect(text).toMatch(/does not detect self-harm/i);
  });

  it("tells the reader Demeter is AI and can be wrong", () => {
    const text = allText(SAFETY_NOTICE).toLowerCase();
    expect(text).toContain("can be wrong");
  });
});
