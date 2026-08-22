// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { ScreeningWorksheet } from "../ScreeningWorksheet";
import type { ScreeningClassification } from "@civica/demeter-engine";

// The new-in-Slice-5 logic on this component: when Export PDF becomes a
// real link vs. stays a disabled stub, and when the guest paywall panel
// appears. Everything else (result banner, calc rows, still-needed list)
// was exercised live in Slice 3 and isn't re-covered here.

afterEach(() => cleanup());

const CLASSIFICATION: ScreeningClassification = {
  outcome: "likely_eligible",
  summary: "Net income falls under the limit.",
  completeness: { computable: true, stillNeeded: [], rawErrors: [] },
};

describe("ScreeningWorksheet — export gating", () => {
  it("an org member with an active, classified screening gets a real export link", () => {
    render(
      <ScreeningWorksheet
        screeningId="s1"
        caseLabel="FCFA-4127"
        stateCode="OH"
        classification={CLASSIFICATION}
        guestScreeningsLeft={null}
      />,
    );
    const link = screen.getByRole("link", { name: "Export PDF" });
    expect(link.getAttribute("href")).toBe("/api/screen/s1/export");
  });

  it("a guest — even mid-screening with a classification — never gets a real export link", () => {
    render(
      <ScreeningWorksheet
        screeningId="s1"
        caseLabel={null}
        stateCode="OH"
        classification={CLASSIFICATION}
        guestScreeningsLeft={3}
      />,
    );
    const btn = screen.getByRole("button", { name: "Export PDF" });
    expect(btn).toHaveProperty("disabled", true);
    expect(screen.queryByRole("link", { name: "Export PDF" })).toBeNull();
  });

  it("no screening started yet (screeningId null) never gets a real export link, even for an org member", () => {
    render(
      <ScreeningWorksheet
        screeningId={null}
        caseLabel={null}
        stateCode="OH"
        classification={null}
        guestScreeningsLeft={null}
      />,
    );
    expect(screen.queryByRole("link", { name: "Export PDF" })).toBeNull();
  });

  it("a guest at zero screenings left sees the paywall panel with a sign-in CTA", () => {
    render(
      <ScreeningWorksheet
        screeningId="s1"
        caseLabel={null}
        stateCode="OH"
        classification={CLASSIFICATION}
        guestScreeningsLeft={0}
      />,
    );
    const cta = screen.getByRole("link", { name: "Sign in" });
    expect(cta.getAttribute("href")).toBe("/screen/sign-in");
  });

  it("a guest with screenings still remaining does not see the paywall panel", () => {
    render(
      <ScreeningWorksheet
        screeningId="s1"
        caseLabel={null}
        stateCode="OH"
        classification={CLASSIFICATION}
        guestScreeningsLeft={2}
      />,
    );
    expect(screen.queryByRole("link", { name: "Sign in" })).toBeNull();
  });
});
