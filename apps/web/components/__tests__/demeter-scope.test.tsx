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

const STATES = [
  {
    code: "CA",
    program: "CalFresh",
    agency: "California Department of Social Services",
    adminModel: "county" as const,
    portal: { name: "BenefitsCal", url: "https://benefitscal.com/" },
    verified: true as const,
    verification: { verified_on: "2026-01-01", method: "m", gates: "g", sources: [] },
  },
  {
    code: "TX",
    program: "SNAP Food Benefits",
    agency: "Texas HHSC",
    adminModel: "state" as const,
    portal: { name: "YourTexasBenefits", url: "https://www.yourtexasbenefits.com/" },
    verified: true as const,
    verification: { verified_on: "2026-01-01", method: "m", gates: "g", sources: [] },
  },
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
    // And the trigger still shows the federal floor, not California.
    expect(screen.getByRole("button", { name: COPY.label }).textContent).toContain(COPY.federal);
  });

  it("names the state it is offering", () => {
    // "Use my location" asks someone to accept a guess they cannot see.
    render(
      <DemeterStatePicker states={STATES} value={null} onChange={vi.fn()} copy={COPY} hint="CA" />,
    );
    open();
    expect(screen.getByText(COPY.useHint.replace("{state}", "CalFresh"))).toBeTruthy();
  });

  it("applies only on a tap", () => {
    const onChange = vi.fn();
    render(
      <DemeterStatePicker states={STATES} value={null} onChange={onChange} copy={COPY} hint="CA" />,
    );
    open();
    fireEvent.click(screen.getByText(COPY.useHint.replace("{state}", "CalFresh")));
    expect(onChange).toHaveBeenCalledWith("CA");
  });

  it("is not offered once a state is chosen", () => {
    // Re-offering a guess over a deliberate choice is how someone ends up
    // scoped to the wrong state.
    render(
      <DemeterStatePicker states={STATES} value="TX" onChange={vi.fn()} copy={COPY} hint="CA" />,
    );
    open();
    expect(screen.queryByText(COPY.useHint.replace("{state}", "CalFresh"))).toBeNull();
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
  it("names the agency AND where to apply", () => {
    // Both already existed in the pack and were rendered only at the bottom of
    // the landing page, hundreds of pixels from the decision.
    render(<DemeterStatePicker states={STATES} value="CA" onChange={vi.fn()} copy={COPY} />);
    expect(screen.getByText(/California Department of Social Services/)).toBeTruthy();
    const portal = screen.getByRole("link", { name: /BenefitsCal/ });
    expect(portal.getAttribute("href")).toBe("https://benefitscal.com/");
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
