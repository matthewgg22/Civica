import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import BenefitsCalPanel from "../BenefitsCalPanel";

const {
  mockRefresh,
  mockGetSession,
  mockBcStatus,
  mockBcPrepareExport,
  mockBcSubmit,
} = vi.hoisted(() => ({
  mockRefresh: vi.fn(),
  mockGetSession: vi.fn(),
  mockBcStatus: vi.fn(),
  mockBcPrepareExport: vi.fn(),
  mockBcSubmit: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}));

vi.mock("../../lib/supabase", () => ({
  createClient: () => ({
    auth: { getSession: mockGetSession },
  }),
}));

vi.mock("../../lib/api", () => ({
  api: {
    benefitscal: {
      status: mockBcStatus,
      prepareExport: mockBcPrepareExport,
      submit: mockBcSubmit,
    },
  },
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

const PACKET_ID = "p1";
const SESSION = { data: { session: { access_token: "tok" } } };

function makeStatusRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    submission_id: "sub-1",
    packet_id: PACKET_ID,
    status: "pending_review",
    consent_type: "async_portal",
    benefitscal_confirmation_number: null,
    submitted_at: null,
    submitted_by: null,
    assister_account_id: null,
    error_message: null,
    retry_count: 0,
    created_at: "2026-05-27T20:00:00Z",
    updated_at: "2026-05-27T20:00:00Z",
    ...overrides,
  };
}

beforeEach(() => {
  mockGetSession.mockResolvedValue(SESSION);
  // Default: no prior submission (404 from /status).
  mockBcStatus.mockRejectedValue(new Error("API 404: No BenefitsCal submission found"));
  mockBcPrepareExport.mockResolvedValue({
    submission_id: "sub-1",
    status: "pending_review",
    created_at: "2026-05-27T20:00:00Z",
    payload: {
      packet_id: PACKET_ID,
      state_code: "CA",
      county: "Los Angeles",
      full_name_ciphertext: "snap_v1::abc",
      date_of_birth_ciphertext: "snap_v1::def",
      answers: [{}, {}, {}],
      document_urls: [{ type: "paystub", url: "https://x/y" }],
      consent_type: "async_portal",
    },
  });
  mockBcSubmit.mockResolvedValue({
    submission_id: "sub-1",
    status: "queued",
    idempotent: false,
  });
});

afterEach(() => vi.resetAllMocks());

describe("BenefitsCalPanel — gating", () => {
  it("disables the Prepare button when blockerCount > 0", async () => {
    render(
      <BenefitsCalPanel packetId={PACKET_ID} packetStatus="Ready for Handoff" blockerCount={2} />,
    );
    await waitFor(() => expect(mockBcStatus).toHaveBeenCalled());
    const btn = screen.getByRole("button", { name: /prepare for benefitscal/i });
    expect(btn).toBeDisabled();
    expect(screen.getByText(/resolve all readiness blockers/i)).toBeInTheDocument();
  });

  it("disables the Prepare button when packetStatus is outside allowed set", async () => {
    render(
      <BenefitsCalPanel packetId={PACKET_ID} packetStatus="Draft" blockerCount={0} />,
    );
    await waitFor(() => expect(mockBcStatus).toHaveBeenCalled());
    const btn = screen.getByRole("button", { name: /prepare for benefitscal/i });
    expect(btn).toBeDisabled();
    expect(screen.getByText(/must be in "Ready for Handoff"/i)).toBeInTheDocument();
  });

  it("enables the Prepare button when packetStatus is Ready for Handoff and no blockers", async () => {
    render(
      <BenefitsCalPanel packetId={PACKET_ID} packetStatus="Ready for Handoff" blockerCount={0} />,
    );
    await waitFor(() => expect(mockBcStatus).toHaveBeenCalled());
    const btn = screen.getByRole("button", { name: /prepare for benefitscal/i });
    expect(btn).not.toBeDisabled();
  });
});

describe("BenefitsCalPanel — initial /status fetch", () => {
  it("treats 404 from /status as the no_submission state (no error shown)", async () => {
    render(
      <BenefitsCalPanel packetId={PACKET_ID} packetStatus="Ready for Handoff" blockerCount={0} />,
    );
    await waitFor(() => expect(mockBcStatus).toHaveBeenCalled());
    expect(screen.queryByText(/API 404/)).toBeNull();
    expect(screen.getByRole("button", { name: /prepare for benefitscal/i })).toBeInTheDocument();
  });

  it("renders the pending_review state with a Submit button when /status returns a pending row", async () => {
    mockBcStatus.mockResolvedValueOnce(makeStatusRow({ status: "pending_review" }));
    render(
      <BenefitsCalPanel packetId={PACKET_ID} packetStatus="Ready for Handoff" blockerCount={0} />,
    );
    await waitFor(() => expect(mockBcStatus).toHaveBeenCalled());
    expect(
      await screen.findByRole("button", { name: /submit to benefitscal/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/pending navigator review/i)).toBeInTheDocument();
  });

  it("renders the succeeded state with the confirmation number when /status returns succeeded", async () => {
    mockBcStatus.mockResolvedValueOnce(
      makeStatusRow({
        status: "succeeded",
        benefitscal_confirmation_number: "BC-12345678",
        submitted_at: "2026-05-27T20:30:00Z",
      }),
    );
    render(
      <BenefitsCalPanel packetId={PACKET_ID} packetStatus="Handed Off" blockerCount={0} />,
    );
    await waitFor(() =>
      expect(screen.getByText("BC-12345678", { exact: false })).toBeInTheDocument(),
    );
    // No action buttons on the succeeded terminal state.
    expect(screen.queryByRole("button", { name: /prepare/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /submit/i })).toBeNull();
  });

  it("renders the failed state with a Re-prepare button and the error message", async () => {
    mockBcStatus.mockResolvedValueOnce(
      makeStatusRow({ status: "failed", error_message: "Portal timed out" }),
    );
    render(
      <BenefitsCalPanel packetId={PACKET_ID} packetStatus="Ready for Handoff" blockerCount={0} />,
    );
    await waitFor(() =>
      expect(screen.getByText(/portal timed out/i)).toBeInTheDocument(),
    );
    expect(
      screen.getByRole("button", { name: /re-prepare for benefitscal/i }),
    ).toBeInTheDocument();
  });

  it("renders the DRIVER_NOT_WIRED guidance when the failure message mentions the missing driver", async () => {
    mockBcStatus.mockResolvedValueOnce(
      makeStatusRow({
        status: "failed",
        error_message:
          "BenefitsCal browser driver not wired in this environment. Use manual PDF export SOP until M2 ships.",
      }),
    );
    render(
      <BenefitsCalPanel packetId={PACKET_ID} packetStatus="Ready for Handoff" blockerCount={0} />,
    );
    // The BROWSERLESS_API_KEY mention is unique to the guidance block — the
    // duplicate "driver not wired" text also appears in the StatusBlock error,
    // so use the unique tokens to pin the assertion.
    await waitFor(() =>
      expect(screen.getByText(/BROWSERLESS_API_KEY/)).toBeInTheDocument(),
    );
    expect(screen.getByText(/wrangler secret \(TODO-15\)/i)).toBeInTheDocument();
  });
});

describe("BenefitsCalPanel — Prepare action", () => {
  it("calls api.benefitscal.prepareExport with the default async_portal consent type on click", async () => {
    render(
      <BenefitsCalPanel packetId={PACKET_ID} packetStatus="Ready for Handoff" blockerCount={0} />,
    );
    await waitFor(() => expect(mockBcStatus).toHaveBeenCalled());
    fireEvent.click(screen.getByRole("button", { name: /prepare for benefitscal/i }));
    await waitFor(() => expect(mockBcPrepareExport).toHaveBeenCalledTimes(1));
    expect(mockBcPrepareExport).toHaveBeenCalledWith("tok", PACKET_ID, {
      consent_type: "async_portal",
    });
  });

  it("renders the Submit button + payload preview after a successful prepare-export", async () => {
    render(
      <BenefitsCalPanel packetId={PACKET_ID} packetStatus="Ready for Handoff" blockerCount={0} />,
    );
    await waitFor(() => expect(mockBcStatus).toHaveBeenCalled());
    fireEvent.click(screen.getByRole("button", { name: /prepare for benefitscal/i }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /submit to benefitscal/i })).toBeInTheDocument(),
    );
    // Payload preview disclosure shows up
    expect(screen.getByText(/payload preview/i)).toBeInTheDocument();
  });

  it("surfaces an inline error when prepare-export fails", async () => {
    mockBcPrepareExport.mockRejectedValueOnce(new Error("API 422: Bad request"));
    render(
      <BenefitsCalPanel packetId={PACKET_ID} packetStatus="Ready for Handoff" blockerCount={0} />,
    );
    await waitFor(() => expect(mockBcStatus).toHaveBeenCalled());
    fireEvent.click(screen.getByRole("button", { name: /prepare for benefitscal/i }));
    await waitFor(() => expect(screen.getByText(/api 422: bad request/i)).toBeInTheDocument());
  });
});

describe("BenefitsCalPanel — Submit action", () => {
  it("calls api.benefitscal.submit (no body args expected on the client side)", async () => {
    mockBcStatus.mockResolvedValueOnce(makeStatusRow({ status: "pending_review" }));
    render(
      <BenefitsCalPanel packetId={PACKET_ID} packetStatus="Ready for Handoff" blockerCount={0} />,
    );
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /submit to benefitscal/i }),
      ).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByRole("button", { name: /submit to benefitscal/i }));
    await waitFor(() => expect(mockBcSubmit).toHaveBeenCalledTimes(1));
    expect(mockBcSubmit).toHaveBeenCalledWith("tok", PACKET_ID);
  });

  it("calls router.refresh() after a successful submit", async () => {
    mockBcStatus.mockResolvedValueOnce(makeStatusRow({ status: "pending_review" }));
    render(
      <BenefitsCalPanel packetId={PACKET_ID} packetStatus="Ready for Handoff" blockerCount={0} />,
    );
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /submit to benefitscal/i }),
      ).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByRole("button", { name: /submit to benefitscal/i }));
    await waitFor(() => expect(mockRefresh).toHaveBeenCalled());
  });
});
