/**
 * BuddyLinkCard unit tests (/plan-design-review D2).
 * Covers active/pending/completed/none + the empty-state warmth and the
 * text+color a11y contract.
 */
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import BuddyLinkCard from "../cbo/BuddyLinkCard";

describe("BuddyLinkCard", () => {
  it("none shows a warm empty state and no status pill", () => {
    render(<BuddyLinkCard buddy={{ helperName: "", relationship: "family", status: "none", lastActive: "" }} />);
    expect(screen.getByText(/no helper linked/i)).toBeInTheDocument();
    // empty state carries the message in body text — no separate role=img pill
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("active renders helper name, relationship, and a labeled status", () => {
    render(<BuddyLinkCard buddy={{ helperName: "Rosa", relationship: "family", status: "active", lastActive: "3h ago" }} />);
    expect(screen.getByText("Rosa")).toBeInTheDocument();
    expect(screen.getByText(/family/)).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /helper status: active/i })).toBeInTheDocument();
  });

  it("pending uses warning; completed uses the pine-surface success-adjacent fill", () => {
    const { rerender } = render(
      <BuddyLinkCard buddy={{ helperName: "James", relationship: "friend", status: "pending", lastActive: "1d ago" }} />,
    );
    expect(screen.getByRole("img", { name: /invite pending/i }).className).toContain("text-warning");
    rerender(
      <BuddyLinkCard buddy={{ helperName: "James", relationship: "friend", status: "completed", lastActive: "2w ago" }} />,
    );
    expect(screen.getByRole("img", { name: /completed/i }).className).toContain("bg-pine-surface");
  });
});
