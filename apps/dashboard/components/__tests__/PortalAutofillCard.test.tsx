/**
 * PortalAutofillCard unit tests (/plan-design-review D1/D2).
 * Covers the dual-approval + consent gate, the answer→BenefitsCal mapping, the
 * autofill highlight token (bg-amber-surface + text-ink, NOT yellow text), and
 * the ready-vs-blocked branches.
 */
import { render, screen, within } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import PortalAutofillCard from "../cbo/PortalAutofillCard";
import type { PortalAutofill } from "../../lib/cbo/demo-pipeline";

const ROWS = [
  { answer: "County", value: "Alameda County", benefitsCalField: "County" },
  { answer: "Household size", value: "3 people", benefitsCalField: "Number in home" },
];

const ready: PortalAutofill = {
  applicantApproved: true,
  cboApproved: true,
  consent: "telephonic",
  fieldMap: ROWS,
  docCount: 4,
};

describe("PortalAutofillCard", () => {
  it("ready: all gates satisfied, values autofilled, action enabled", () => {
    render(<PortalAutofillCard portal={ready} />);
    expect(screen.getByRole("img", { name: /applicant approved: done/i })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /cbo approved: done/i })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /consent recorded: done/i })).toBeInTheDocument();
    expect(screen.getByText(/clicks Next \/ Accept/i)).toBeInTheDocument();
    // autofilled value appears in BOTH the left answer and the right highlight chip
    expect(screen.getAllByText("3 people").length).toBe(2);
  });

  it("autofill highlight uses amber-surface fill + ink text (NOT yellow text)", () => {
    render(<PortalAutofillCard portal={ready} />);
    // the right-hand highlight chips carry the on-system amber-surface fill
    const chips = document.querySelectorAll("dd .bg-amber-surface");
    expect(chips.length).toBe(ROWS.length);
    chips.forEach((c) => {
      expect(c.className).toContain("bg-amber-surface");
      expect(c.className).toContain("text-ink");
      expect(c.className).not.toContain("text-wheat"); // wheat-as-text is forbidden (AA)
    });
  });

  it("blocked: CBO not yet approved → values masked, blocker shown", () => {
    render(<PortalAutofillCard portal={{ ...ready, cboApproved: false, consent: null }} />);
    expect(screen.getByRole("img", { name: /cbo approved: pending/i })).toBeInTheDocument();
    expect(screen.getByText(/waiting on cbo approval/i)).toBeInTheDocument();
    // highlight chips render the masked placeholder, not the value
    const chips = document.querySelectorAll("dd .bg-amber-surface");
    chips.forEach((c) => expect(c.textContent).toBe("—"));
  });

  it("surfaces the right blocker per missing gate", () => {
    const { rerender } = render(
      <PortalAutofillCard portal={{ ...ready, applicantApproved: false, cboApproved: false, consent: null }} />,
    );
    expect(screen.getByText(/waiting on applicant approval/i)).toBeInTheDocument();
    rerender(<PortalAutofillCard portal={{ ...ready, consent: null }} />);
    expect(screen.getByText(/waiting on recorded consent/i)).toBeInTheDocument();
  });
});
