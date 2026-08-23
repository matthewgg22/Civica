// @vitest-environment jsdom
//
// The panel shows its working, and asks for what it is missing.
//
// Two owner recommendations, agreed 2026-08-22:
//   - "Show the maths, not just the answer." The estimate and the facts that
//     produced it were on the same panel but visually unrelated, so a wrong
//     number had no visible cause.
//   - "'Still needed' should ask, not just list." It was a to-do list in a
//     side panel: read it, work out which item matters, go type it yourself.
//
// The line neither may cross: the panel SUGGESTS, the person still writes.
// A message appearing in someone's own conversation that they did not type is
// a different product.
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, cleanup, fireEvent } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { DemeterWorksheet } from "../DemeterWorksheet";
import { T } from "../../lib/i18n/demeter-chat-copy";

afterEach(cleanup);
const copy = T.en.worksheet;

const CLASSIFICATION = {
  outcome: "likely_eligible",
  summary: "Likely eligible.",
  completeness: { stillNeeded: ["Rent or shelter cost", "Some unmapped field"] },
  verdict: { trace: { benefit_calc: { monthly_benefit: 298 } } },
} as never;

function panel(onAskFor?: (p: string) => void) {
  return render(
    <DemeterWorksheet
      classification={CLASSIFICATION}
      facts={{ household: [{ member_id: "applicant" }], income: [] } as never}
      stateSelected
      copy={copy}
      mode="estimate"
      onModeChange={() => {}}
      onAskFor={onAskFor}
    />,
  ).container;
}

describe("the estimate shows what produced it", () => {
  it("puts the facts on the same card as the figure", () => {
    const basis = panel().querySelector(".dmw__result-basis")?.textContent ?? "";
    expect(basis).toContain(copy.basedOn);
    // The load-bearing ones: who, and what they earn.
    expect(basis.toLowerCase()).toContain(copy.capturedHouseholdOne.toLowerCase());
    expect(basis.toLowerCase()).toContain(copy.capturedIncomeNone.toLowerCase());
  });

  it("shows no basis line when it has heard nothing", () => {
    const c = render(
      <DemeterWorksheet
        classification={CLASSIFICATION}
        facts={{} as never}
        stateSelected
        copy={copy}
        mode="estimate"
        onModeChange={() => {}}
      />,
    ).container;
    expect(c.querySelector(".dmw__result-basis")).toBeNull();
  });
});

describe("still-needed items ask their own question", () => {
  it("prefills the composer rather than sending", () => {
    const onAskFor = vi.fn();
    const btn = panel(onAskFor).querySelector("button.dmw__askbtn") as HTMLButtonElement;
    expect(btn.textContent).toBe("Rent or shelter cost");
    fireEvent.click(btn);
    // The QUESTION, not the field label — that is the whole point.
    expect(onAskFor).toHaveBeenCalledWith(copy.askFor["Rent or shelter cost"]);
  });

  it("leaves an unmapped item as plain text, inventing no question", () => {
    const c = panel(() => {});
    const items = [...c.querySelectorAll(".dmw__needed li")].map((li) => li.textContent);
    expect(items).toContain("Some unmapped field");
    expect(c.querySelectorAll("button.dmw__askbtn")).toHaveLength(1);
  });

  it("stays a plain list when no handler is wired", () => {
    expect(panel().querySelectorAll("button.dmw__askbtn")).toHaveLength(0);
  });
});

describe("the copy exists in every language", () => {
  it("the mapping's keys are the labels completeness.ts actually emits", () => {
    // THE COUPLING THAT WOULD ROT SILENTLY. The map is keyed by English label
    // strings that live in another package. Rename one upstream and the item
    // quietly stops being askable — no error, no failing render, just a list
    // that went back to being a list. So read that file and check.
    const src = readFileSync(
      join(
        __dirname, "..", "..", "..", "..",
        "packages", "demeter-engine", "src", "screening", "completeness.ts",
      ),
      "utf8",
    );
    const emitted = [...src.matchAll(/stillNeeded\.push\("([^"]+)"\)/g)].map((m) => m[1]!);
    expect(emitted.length, "no labels found — the regex or the file moved").toBeGreaterThan(3);
    for (const label of emitted) {
      expect(T.en.worksheet.askFor[label], `unmapped: "${label}"`).toBeTruthy();
    }
  });

  it("has basedOn, askPrefix, and a question for every label completeness.ts emits", () => {
    // Keyed off completeness.ts's own English labels — if one is renamed
    // upstream the mapping silently stops firing, so they are pinned here.
    const LABELS = [
      "Household size",
      "Rent or shelter cost",
      "Countable assets, if any",
      "Whether the household receives SSI or TANF",
      "Citizenship or qualified status",
    ];
    for (const lang of ["en", "es", "vi", "zh"] as const) {
      const w = T[lang].worksheet;
      expect(w.basedOn?.trim(), lang).toBeTruthy();
      expect(w.askPrefix?.trim(), lang).toBeTruthy();
      for (const label of LABELS) {
        expect(w.askFor[label]?.trim(), `${lang}: ${label}`).toBeTruthy();
      }
      // A question, not a restated label.
      expect(w.askFor["Household size"], lang).not.toBe("Household size");
    }
  });
});
