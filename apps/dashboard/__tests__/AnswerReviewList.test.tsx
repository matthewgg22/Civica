import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

// globals: false → mock fns must be hoisted to be referenced in vi.mock factories.
const mocks = vi.hoisted(() => ({
  answersReview: vi.fn(),
  routerRefresh: vi.fn(),
  getSession: vi.fn(),
}));

vi.mock("../lib/api", () => ({
  api: { answers: { review: mocks.answersReview } },
}));
vi.mock("../lib/supabase", () => ({
  createClient: () => ({ auth: { getSession: mocks.getSession } }),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.routerRefresh }),
}));
vi.mock("../lib/format", () => ({
  decryptDemoName: (s: string) => s,
}));

import AnswerReviewList from "../components/AnswerReviewList";

interface Answer {
  answer_id: string;
  question_key: string;
  question_label: string;
  applicant_answer: string | null;
  original_ocr_value: string | null;
  navigator_confirmed_value: string | null;
  reviewed_at: string | null;
  review_note: string | null;
}

const base = (o: Partial<Answer> = {}): Answer => ({
  answer_id: "ans-1",
  question_key: "monthly_income",
  question_label: "Monthly income",
  applicant_answer: "1980",
  original_ocr_value: null,
  navigator_confirmed_value: null,
  reviewed_at: null,
  review_note: null,
  ...o,
});

describe("AnswerReviewList", () => {
  beforeEach(() => {
    mocks.answersReview.mockReset();
    mocks.routerRefresh.mockReset();
    mocks.getSession.mockReset();
    mocks.answersReview.mockResolvedValue({});
    mocks.getSession.mockResolvedValue({ data: { session: { access_token: "tok" } } });
  });
  afterEach(() => cleanup());

  it("shows 'Review →' for an unreviewed answer", () => {
    render(<AnswerReviewList answers={[base()]} />);
    expect(screen.getByRole("button", { name: "Review →" })).toBeInTheDocument();
  });

  it("lets a navigator EDIT an already-reviewed answer and re-persists the correction", async () => {
    // Previously confirmed — the old UI hid the edit button entirely here.
    const reviewed = base({
      navigator_confirmed_value: "1980",
      reviewed_at: "2026-06-01T10:00:00Z",
    });
    render(<AnswerReviewList answers={[reviewed]} />);

    // The gap fix: a reviewed answer still offers "Edit".
    const editBtn = screen.getByRole("button", { name: "Edit" });
    expect(editBtn).toBeInTheDocument();
    fireEvent.click(editBtn);

    // Pre-filled with the current confirmed value; correct it.
    const input = screen.getByLabelText("Confirmed value for Monthly income") as HTMLInputElement;
    expect(input.value).toBe("1980");
    fireEvent.change(input, { target: { value: "2100" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(mocks.answersReview).toHaveBeenCalledWith("tok", "ans-1", {
        navigator_confirmed_value: "2100",
        review_note: undefined,
      });
    });
    // Refreshes server state and reflects the new value optimistically.
    expect(mocks.routerRefresh).toHaveBeenCalled();
    await waitFor(() => expect(screen.getByText("2100")).toBeInTheDocument());
  });

  it("first review pre-fills from the applicant answer", () => {
    render(<AnswerReviewList answers={[base({ applicant_answer: "1980" })]} />);
    fireEvent.click(screen.getByRole("button", { name: "Review →" }));
    const input = screen.getByLabelText("Confirmed value for Monthly income") as HTMLInputElement;
    expect(input.value).toBe("1980");
  });
});
