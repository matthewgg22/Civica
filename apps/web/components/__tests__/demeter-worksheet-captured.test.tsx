// @vitest-environment jsdom
//
// The tracker shows what it HEARD, not only what it lacks.
//
// Owner, 2026-08-22: "need to do better job in having tracker reflect what was
// attained or asserted in the conversation." The panel rendered the verdict,
// the money rows and a "still needed" list — but never the facts it was
// working from. A household of one recorded as two, or a weekly wage read as
// monthly, stayed invisible until it surfaced in the estimate, if it ever did.
//
// The line this must not cross: ASK MODE SHOWS NOTHING. Nothing is extracted
// there, so a section headed "from what you've told me" would be a claim about
// gathering in the one mode that promises it does not.
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";

import { DemeterWorksheet } from "../DemeterWorksheet";
import { T } from "../../lib/i18n/demeter-chat-copy";
import type { PartialFacts } from "@civica/demeter-engine";

afterEach(cleanup);

const copy = T.en.worksheet;

function panel(facts: PartialFacts | null, mode: "ask" | "estimate" = "estimate") {
  return render(
    <DemeterWorksheet
      classification={null}
      facts={facts}
      stateSelected
      copy={copy}
      mode={mode}
      onModeChange={() => {}}
    />,
  ).container;
}

const rowsOf = (c: HTMLElement) =>
  [...c.querySelectorAll(".dmw__captured-row")].map((r) => r.textContent ?? "");

describe("the tracker reflects the conversation", () => {
  it("shows household size in words, not a bare number", () => {
    const one = rowsOf(panel({ household: [{ member_id: "applicant" }] }));
    expect(one.join(" ")).toContain(copy.capturedHouseholdOne);

    const three = rowsOf(
      panel({ household: [{ member_id: "a" }, { member_id: "b" }, { member_id: "c" }] }),
    );
    expect(three.join(" ")).toContain("3");
  });

  it("distinguishes 'told me they have none' from 'never asked'", () => {
    // THE CASE FROM THE TRANSCRIPT. An explicit empty income array is the
    // model recording "$0", which is load-bearing — it is why the household
    // lands at the maximum allotment. Silence is a different thing and must
    // not render as zero.
    const stated = rowsOf(panel({ income: [] }));
    expect(stated.join(" ")).toContain(copy.capturedIncomeNone);

    const unasked = rowsOf(panel({ household: [{ member_id: "applicant" }] }));
    expect(unasked.join(" "), "silence must not become a zero").not.toContain(
      copy.capturedIncome,
    );
  });

  it("surfaces having no fixed address", () => {
    const rows = rowsOf(panel({ shelter: { homeless_deduction: true } }));
    expect(rows.join(" ")).toContain(copy.capturedHomelessYes);
  });

  it("renders money for income, rent and assets", () => {
    const rows = rowsOf(
      panel({
        income: [{ member: "applicant", type: "wages", amount: 1200 }],
        shelter: { rent: 800 },
        assets: 50,
      }),
    ).join(" ");
    expect(rows).toContain("1,200");
    expect(rows).toContain("800");
    expect(rows).toContain("50");
  });

  it("invents nothing — an empty fact set renders no section at all", () => {
    expect(panel({}).querySelector(".dmw__captured")).toBeNull();
    expect(panel(null).querySelector(".dmw__captured")).toBeNull();
  });

  it("says how to correct it, because the point is catching a mishearing", () => {
    const c = panel({ household: [{ member_id: "applicant" }] });
    expect(c.querySelector(".dmw__captured-note")?.textContent).toBe(copy.capturedNote);
  });

  it("SHOWS NOTHING IN ASK MODE — that mode gathers nothing", () => {
    const c = panel({ household: [{ member_id: "a" }], income: [] }, "ask");
    expect(c.querySelector(".dmw__captured")).toBeNull();
  });
});

describe("the captured copy exists in every language", () => {
  it("has no missing strings and no leftover {n}", () => {
    for (const lang of ["en", "es", "vi", "zh"] as const) {
      const w = T[lang].worksheet;
      for (const k of [
        "captured", "capturedNote", "capturedHousehold", "capturedHouseholdOne",
        "capturedHouseholdN", "capturedIncome", "capturedIncomeNone", "capturedRent",
        "capturedUtilities", "capturedHomeless", "capturedHomelessYes",
        "capturedAssets", "capturedExpedited",
      ] as const) {
        expect(w[k]?.trim(), `${lang}.${k}`).toBeTruthy();
      }
      expect(w.capturedHouseholdN, `${lang} keeps the slot`).toContain("{n}");
      expect(w.capturedHouseholdOne, `${lang} singular has no slot`).not.toContain("{n}");
    }
  });
});
