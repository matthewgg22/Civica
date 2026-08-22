// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { DemeterFeedback } from "../DemeterFeedback";
import { readCertainty } from "../DemeterChat";

const COPY = {
  prompt: "Was this helpful?",
  helpful: "Yes",
  notHelpful: "No",
  thanks: "Thank you",
  reasonPrompt: "What was wrong with it?",
  reasons: [
    { value: "incorrect", label: "The answer was wrong" },
    { value: "citation_wrong", label: "The source doesn't say that" },
  ],
  notePlaceholder: "Anything else?",
  send: "Send",
  skip: "Skip",
} as const;

const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset().mockResolvedValue(new Response(null, { status: 201 }));
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function renderFb(certainty: "certain" | "uncertain" | null = "certain") {
  render(
    <DemeterFeedback
      question="Do I qualify?"
      answer="Yes, under 7 CFR 273.9."
      state="CA"
      lang="en"
      certainty={certainty}
      copy={COPY}
    />,
  );
}
const bodyOf = (i = 0) =>
  JSON.parse((fetchMock.mock.calls[i]![1] as RequestInit).body as string);

describe("readCertainty", () => {
  it("reads the verdict off the ✓ / ⚠ MARK, not the localized label", () => {
    // The label is translated per language; the mark is not. Keying off the
    // mark is what keeps this correct as languages are added.
    expect(readCertainty("answer\n\n---\n✓ **CERTAIN** — every rule cited…")).toBe("certain");
    expect(readCertainty("respuesta\n\n---\n✓ **SEGURO** — cada regla citada…")).toBe("certain");
    expect(readCertainty("答案\n\n---\n⚠ **不确定** — …")).toBe("uncertain");
  });

  it("returns null while the answer is still streaming", () => {
    // No trailer yet → no verdict. Feedback must not render on a half-read
    // answer, and this is the signal it keys off.
    expect(readCertainty("Yes, under 7 CFR 273.9 you likely")).toBeNull();
  });
});

describe("DemeterFeedback", () => {
  it("records a thumbs-up with its triage context and thanks the reader", () => {
    renderFb();
    fireEvent.click(screen.getByRole("button", { name: "Yes" }));
    expect(bodyOf()).toMatchObject({
      rating: "up",
      state: "CA",
      lang: "en",
      certainty: "certain",
      question: "Do I qualify?",
    });
    expect(screen.getByText("Thank you")).toBeTruthy();
  });

  it("records the thumbs-down IMMEDIATELY, before asking why", () => {
    // Most people will not stay for the reason picker. Losing the negative
    // signal because they closed the tab at the follow-up would defeat the
    // point of having a feedback loop at all.
    renderFb();
    fireEvent.click(screen.getByRole("button", { name: "No" }));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(bodyOf().rating).toBe("down");
    expect(screen.getByText("What was wrong with it?")).toBeTruthy();
  });

  it("enriches the SAME report rather than filing a second one", () => {
    // REGRESSION (caught in second-pass review): the two submits used to be
    // two independent rows, so demeter_feedback_stats counted one person's
    // single complaint twice AND split it across two `reason` buckets —
    // corrupting the exact number this loop exists to produce. Both calls now
    // carry the same reportId and the route upserts on it.
    renderFb();
    fireEvent.click(screen.getByRole("button", { name: "No" }));
    fireEvent.click(screen.getByRole("button", { name: "The source doesn't say that" }));
    fireEvent.change(screen.getByPlaceholderText("Anything else?"), {
      target: { value: "273.9 is about income, not students" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    expect(bodyOf(1)).toMatchObject({
      rating: "down",
      reason: "citation_wrong",
      note: "273.9 is about income, not students",
    });
    const first = bodyOf(0).reportId;
    expect(first, "a report id must be sent").toBeTruthy();
    expect(bodyOf(1).reportId, "both submits must share one id").toBe(first);
    expect(screen.getByText("Thank you")).toBeTruthy();
  });

  it("gives separate answers separate report ids", () => {
    // Two rendered instances are two distinct reports; sharing an id would
    // make the second silently overwrite the first.
    renderFb();
    fireEvent.click(screen.getByRole("button", { name: "Yes" }));
    cleanup();
    renderFb();
    fireEvent.click(screen.getByRole("button", { name: "Yes" }));
    expect(bodyOf(1).reportId).not.toBe(bodyOf(0).reportId);
  });

  it("keeps the thumbs-down when the reader skips the follow-up", () => {
    renderFb();
    fireEvent.click(screen.getByRole("button", { name: "No" }));
    fireEvent.click(screen.getByRole("button", { name: "Skip" }));
    // Skipping declines to add DETAIL; it does not withdraw the signal.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(bodyOf().rating).toBe("down");
    expect(screen.getByText("Thank you")).toBeTruthy();
  });

  it("still thanks the reader when the request fails outright", async () => {
    // The reporter is the only sensor we have for a well-cited wrong answer.
    // Showing them an error teaches them not to bother.
    fetchMock.mockRejectedValue(new Error("offline"));
    renderFb();
    fireEvent.click(screen.getByRole("button", { name: "Yes" }));
    expect(screen.getByText("Thank you")).toBeTruthy();
  });
});
