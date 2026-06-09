/**
 * EditableApplicationResponses (cbo-phase2) — the full-application page's batch
 * edit mode. Covers: read-only render with the flag cue, the Edit→select/input
 * swap, and Save committing the change with the "· edited" marker (ephemeral).
 */
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import EditableApplicationResponses from "../EditableApplicationResponses";
import type { SurveyAnswer } from "../../../../../lib/cbo/demo-pipeline";

const ANSWERS: SurveyAnswer[] = [
  { section: "Residence", question: "Housing situation", answer: "Renting" },
  {
    section: "Documents",
    question: "Social Security Number",
    answer: "Provided — does not match SSA records",
    flagged: true,
  },
];

describe("EditableApplicationResponses", () => {
  it("renders read-only with a flag cue and no edit controls", () => {
    render(<EditableApplicationResponses answers={ANSWERS} />);
    expect(screen.getByText("Renting")).toBeTruthy();
    // Flagged answer carries the "⚑ verify" cue.
    expect(screen.getByText(/verify/)).toBeTruthy();
    // Not editing yet — no form controls.
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.getByRole("button", { name: /Edit responses/ })).toBeTruthy();
  });

  it("edits a fixed-option field and commits it with the edited marker", () => {
    render(<EditableApplicationResponses answers={ANSWERS} />);
    fireEvent.click(screen.getByRole("button", { name: /Edit responses/ }));

    // Fixed-option field becomes a <select> seeded with the current value.
    const housing = screen.getByRole("combobox", { name: "Housing situation" }) as HTMLSelectElement;
    expect(housing.value).toBe("Renting");
    fireEvent.change(housing, { target: { value: "Shelter" } });

    fireEvent.click(screen.getByRole("button", { name: /Save changes/ }));

    // Back in read-only view with the new value + the "· edited" marker.
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.getByText("Shelter")).toBeTruthy();
    expect(screen.getByText(/· edited/)).toBeTruthy();
  });
});
