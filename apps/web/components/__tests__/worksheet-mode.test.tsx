// @vitest-environment jsdom
//
// The estimate rail used to read household facts out of the conversation — who
// lives with you, what you earn, what you pay in rent — from the moment a state
// was picked, whether or not anyone had asked for an estimate. That is a
// reasonable thing to OFFER and an unreasonable thing to do quietly to someone
// who came to find out how the system works before telling it anything about
// themselves.
//
// So the default matters more than the switch does, and it is what these tests
// are really guarding.
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { DemeterWorksheet } from "../DemeterWorksheet";
import { T } from "../../lib/i18n/demeter-chat-copy";
import { ANSWER_LANGS } from "@civica/demeter-engine/packs";

afterEach(cleanup);

const copy = T.en.worksheet;

describe("the estimate is something you turn on", () => {
  it("says nothing is being gathered while it is off", () => {
    render(
      <DemeterWorksheet
        classification={null}
        stateSelected
        copy={copy}
        mode="ask"
        onModeChange={() => {}}
      />,
    );
    expect(screen.getByText(copy.modeAskNote)).toBeTruthy();
    // Not merely hidden — the estimate's own scaffolding must be absent, or the
    // panel reads as one that is waiting rather than one that is off.
    expect(screen.queryByText(copy.pickState)).toBeNull();
    expect(screen.queryByText(copy.empty)).toBeNull();
    // Two standing sentences that would contradict the mode they sit in — the
    // same defect as the old retention line, which claimed nothing was kept.
    expect(screen.queryByText(copy.subtitle), "\"Builds as you talk\"").toBeNull();
    expect(screen.queryByText(copy.disclaimer), "estimate disclaimer").toBeNull();
    // But the retention line stays: questions are logged in BOTH modes.
    expect(screen.getByText(copy.privacy)).toBeTruthy();
  });

  it("is an exclusive choice a screen reader can hear as one", () => {
    render(
      <DemeterWorksheet
        classification={null}
        stateSelected
        copy={copy}
        mode="ask"
        onModeChange={() => {}}
      />,
    );
    const group = screen.getByRole("radiogroup", { name: copy.modeLabel });
    expect(group).toBeTruthy();
    const options = screen.getAllByRole("radio");
    expect(options).toHaveLength(2);
    // Exactly one selected — two aria-pressed toggles would let both read as on.
    expect(options.filter((o) => o.getAttribute("aria-checked") === "true")).toHaveLength(1);
    expect(screen.getByRole("radio", { name: copy.modeAsk }).getAttribute("aria-checked")).toBe(
      "true",
    );
  });

  it("reports the choice the person made", () => {
    const onModeChange = vi.fn();
    render(
      <DemeterWorksheet
        classification={null}
        stateSelected
        copy={copy}
        mode="ask"
        onModeChange={onModeChange}
      />,
    );
    fireEvent.click(screen.getByRole("radio", { name: copy.modeEstimate }));
    expect(onModeChange).toHaveBeenCalledWith("estimate");
  });

  it("shows the estimate scaffolding once it is on", () => {
    render(
      <DemeterWorksheet
        classification={null}
        stateSelected={false}
        copy={copy}
        mode="estimate"
        onModeChange={() => {}}
      />,
    );
    expect(screen.getByText(copy.pickState)).toBeTruthy();
    expect(screen.queryByText(copy.modeAskNote)).toBeNull();
  });

  it("has both labels and the off-state sentence in every language", () => {
    // A privacy control that is only legible in English is a privacy control
    // for English speakers.
    for (const lang of ANSWER_LANGS) {
      const c = T[lang].worksheet;
      for (const key of ["modeLabel", "modeAsk", "modeEstimate", "modeAskNote", "switchedToAsk"] as const) {
        expect(c[key]?.trim(), `${lang}.${key}`).toBeTruthy();
      }
    }
  });

  it("keeps the ask-mode note sidebar-sized, without losing the retention disclosure", () => {
    // It ran three sentences plus a parenthetical — longer than the estimate
    // panel it explains. Two sentences now, and this pins the budget the same
    // way the em-dash test pins the page copy. The one clause that must
    // SURVIVE any shortening is the honest one: we keep the text to check our
    // accuracy, in both modes — cutting that to save room would turn a
    // disclosure into a secret.
    for (const lang of ANSWER_LANGS) {
      const note = T[lang].worksheet.modeAskNote;
      expect(note.length, `${lang} length`).toBeLessThanOrEqual(lang === "zh" ? 80 : 175);
      expect(note, `${lang} keeps the accuracy disclosure`).toMatch(
        /accuracy|exactitud|chính xác|准确/,
      );
    }
  });
});
