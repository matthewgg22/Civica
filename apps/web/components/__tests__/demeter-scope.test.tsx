// @vitest-environment jsdom
//
// P2-2 and P2-3: the state hint, and what you are told after choosing.
//
// The failure mode for both is silence. A hint that auto-applies looks like a
// working feature until someone in Texas helping their mother in Ohio gets
// Texas figures; a confirmation card that skips NAP territories looks fine
// until the one jurisdiction whose difference most needs stating is the one
// that does not state it.
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { DemeterStatePicker } from "../DemeterStatePicker";
import { T } from "../../lib/i18n/demeter-chat-copy";
import { makePack, makePortal } from "../../__tests__/fixtures/pack";

const STATES = [
  makePack({
    code: "CA",
    program: "CalFresh",
    agency: "California Department of Social Services",
    adminModel: "county",
    portal: makePortal({ name: "BenefitsCal", url: "https://benefitscal.com/" }),
  }),
  makePack({
    code: "TX",
    program: "SNAP Food Benefits",
    agency: "Texas HHSC",
    portal: makePortal({ name: "YourTexasBenefits", url: "https://www.yourtexasbenefits.com/" }),
  }),
];

const COPY = T.en.picker;

afterEach(cleanup);

function open() {
  fireEvent.click(screen.getByRole("button", { name: COPY.label }));
}

describe("the location hint is an offer, never a selection", () => {
  it("does not apply itself", () => {
    // The whole point. People help family in other states, and a confidently
    // wrong state is worse than no state — it silently rescopes every figure
    // in every answer.
    const onChange = vi.fn();
    render(
      <DemeterStatePicker states={STATES} value={null} onChange={onChange} copy={COPY} hint="CA" />,
    );
    expect(onChange).not.toHaveBeenCalled();
    // And the trigger still shows nothing selected, not California. The
    // one-line trigger (2026-08-22) shows the label as its placeholder, so the
    // assertion that carries the meaning is the NEGATIVE one: a geo hint must
    // never leave the control looking like the reader picked that state.
    const trigger = screen.getByRole("button", { name: COPY.label });
    expect(trigger.textContent).toContain(COPY.label);
    expect(trigger.textContent, "the hint must not read as a selection").not.toContain(
      "California",
    );
  });

  it("names the state it is offering", () => {
    // "Use my location" asks someone to accept a guess they cannot see.
    //
    // This asserted "Use CalFresh" — the PROGRAM name — and so locked in the
    // bug it was meant to guard. PackMeta has no state name, the component
    // reached for the nearest string that looked like one, and the test
    // agreed with it. On MA that rendered "Use Supplemental Nutrition
    // Assistance Program (SNAP) — Massachusetts uses the federal name; …".
    render(
      <DemeterStatePicker states={STATES} value={null} onChange={vi.fn()} copy={COPY} hint="CA" />,
    );
    open();
    expect(screen.getByText(COPY.useHint.replace("{state}", "California"))).toBeTruthy();
  });

  it("applies only on a tap", () => {
    const onChange = vi.fn();
    render(
      <DemeterStatePicker states={STATES} value={null} onChange={onChange} copy={COPY} hint="CA" />,
    );
    open();
    fireEvent.click(screen.getByText(COPY.useHint.replace("{state}", "California")));
    expect(onChange).toHaveBeenCalledWith("CA");
  });

  it("is not offered once a state is chosen", () => {
    // Re-offering a guess over a deliberate choice is how someone ends up
    // scoped to the wrong state.
    render(
      <DemeterStatePicker states={STATES} value="TX" onChange={vi.fn()} copy={COPY} hint="CA" />,
    );
    open();
    expect(screen.queryByText(COPY.useHint.replace("{state}", "California"))).toBeNull();
  });

  it("ignores a hint for a state with no verified pack", () => {
    // Offering one would promise more than the federal floor it would get.
    render(
      <DemeterStatePicker states={STATES} value={null} onChange={vi.fn()} copy={COPY} hint="OH" />,
    );
    open();
    expect(screen.queryByText(/^Use /)).toBeNull();
  });
});

describe("what you are told after choosing", () => {
  it("names the agency", () => {
    // Already existed in the pack and was rendered only at the bottom of the
    // landing page, hundreds of pixels from the decision.
    render(<DemeterStatePicker states={STATES} value="CA" onChange={vi.fn()} copy={COPY} />);
    expect(screen.getByText(/California Department of Social Services/)).toBeTruthy();
  });

  // "Apply at {portal}" used to render here too, stacked under the agency
  // line — moved to DemeterChat's side rail, next to "How we verify" (real
  // feedback, 2026-08-15: the two lines here crowded the confirmation card).
  // This component's job is now just the agency confirmation.
  it("no longer renders the portal link itself", () => {
    render(<DemeterStatePicker states={STATES} value="CA" onChange={vi.fn()} copy={COPY} />);
    expect(screen.queryByRole("link", { name: /BenefitsCal/ })).toBeNull();
  });

  it("states the difference for a NAP territory", () => {
    // A NAP territory is not in `states`, so a naive `selected` lookup returns
    // null and the card silently never renders for exactly the jurisdictions
    // whose difference most needs stating.
    render(<DemeterStatePicker states={STATES} value="PR" onChange={vi.fn()} copy={COPY} />);
    expect(screen.getByText(/Asistencia Nutricional/)).toBeTruthy();
    expect(screen.getByText(/Departamento de la Familia/)).toBeTruthy();
  });

  it("says nothing when nothing is chosen", () => {
    render(<DemeterStatePicker states={STATES} value={null} onChange={vi.fn()} copy={COPY} />);
    expect(screen.queryByText(/Answers from/)).toBeNull();
  });

  it("labels NAP territories as a different program in the list", () => {
    render(<DemeterStatePicker states={STATES} value={null} onChange={vi.fn()} copy={COPY} />);
    open();
    expect(screen.getByText(COPY.napGroup)).toBeTruthy();
    expect(COPY.napGroup).toMatch(/not SNAP/i);
  });
});
