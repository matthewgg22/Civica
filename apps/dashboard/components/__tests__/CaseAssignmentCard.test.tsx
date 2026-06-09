/**
 * CaseAssignmentCard unit tests (/plan-design-review D2).
 * Covers all four statuses + the color-is-never-the-only-signal a11y contract
 * (status carries a text label + role="img" aria-label, not color alone).
 */
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import CaseAssignmentCard from "../cbo/CaseAssignmentCard";

describe("CaseAssignmentCard", () => {
  it("unassigned shows the empty state, not a caseworker name", () => {
    render(
      <CaseAssignmentCard assignment={{ caseworker: "Unassigned", status: "unassigned", assignedAt: null }} />,
    );
    expect(screen.getByText(/not yet assigned/i)).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /assignment status: unassigned/i })).toBeInTheDocument();
  });

  it("assigned/reviewing/approved each render the caseworker + a labeled status", () => {
    for (const [status, label] of [
      ["assigned", "Assigned"],
      ["reviewing", "In review"],
      ["approved", "Approved"],
    ] as const) {
      const { unmount } = render(
        <CaseAssignmentCard assignment={{ caseworker: "J. Ruiz", status, assignedAt: "Oct 12" }} />,
      );
      expect(screen.getByText("J. Ruiz")).toBeInTheDocument();
      expect(screen.getByRole("img", { name: new RegExp(`assignment status: ${label}`, "i") })).toBeInTheDocument();
      unmount();
    }
  });

  it("approved uses amber (positive), reviewing uses warning (process)", () => {
    const { rerender } = render(
      <CaseAssignmentCard assignment={{ caseworker: "J. Ruiz", status: "approved", assignedAt: null }} />,
    );
    expect(screen.getByRole("img", { name: /approved/i }).className).toContain("text-amber");
    rerender(
      <CaseAssignmentCard assignment={{ caseworker: "J. Ruiz", status: "reviewing", assignedAt: null }} />,
    );
    expect(screen.getByRole("img", { name: /in review/i }).className).toContain("text-warning");
  });
});
