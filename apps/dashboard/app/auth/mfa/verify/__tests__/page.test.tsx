import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const mockListFactors = vi.hoisted(() => vi.fn());
const mockChallenge = vi.hoisted(() => vi.fn());
const mockVerify = vi.hoisted(() => vi.fn());
const mockReplace = vi.hoisted(() => vi.fn());
const mockRefresh = vi.hoisted(() => vi.fn());

vi.mock("../../../../../lib/supabase", () => ({
  createClient: vi.fn(() => ({
    auth: {
      mfa: {
        listFactors: mockListFactors,
        challenge: mockChallenge,
        verify: mockVerify,
      },
    },
  })),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace, refresh: mockRefresh }),
}));

import MFAVerifyPage from "../page";

describe("MFAVerifyPage", () => {
  beforeEach(() => {
    mockListFactors.mockReset();
    mockChallenge.mockReset();
    mockVerify.mockReset();
    mockReplace.mockReset();
    mockRefresh.mockReset();
    mockListFactors.mockResolvedValue({ data: { totp: [{ id: "factor-1" }] } });
    mockChallenge.mockResolvedValue({ data: { id: "challenge-1" } });
  });

  it("renders the code prompt", () => {
    render(<MFAVerifyPage />);
    expect(screen.getByText(/check your authenticator/i)).toBeDefined();
    expect(screen.getByLabelText(/6-digit code/i)).toBeDefined();
  });

  it("challenges the enrolled TOTP factor on mount", async () => {
    render(<MFAVerifyPage />);
    await waitFor(() => {
      expect(mockChallenge).toHaveBeenCalledWith({ factorId: "factor-1" });
    });
  });

  it("does not challenge when no TOTP factor is enrolled", async () => {
    mockListFactors.mockResolvedValue({ data: { totp: [] } });
    render(<MFAVerifyPage />);
    await waitFor(() => expect(mockListFactors).toHaveBeenCalled());
    expect(mockChallenge).not.toHaveBeenCalled();
  });

  it("redirects to /packets on successful verify", async () => {
    mockVerify.mockResolvedValue({ error: null });
    render(<MFAVerifyPage />);
    await waitFor(() => expect(mockChallenge).toHaveBeenCalled());

    fireEvent.change(screen.getByLabelText(/6-digit code/i), { target: { value: "123456" } });
    fireEvent.submit(screen.getByRole("button", { name: /verify/i }).closest("form")!);

    await waitFor(() => {
      expect(mockVerify).toHaveBeenCalledWith({
        factorId: "factor-1",
        challengeId: "challenge-1",
        code: "123456",
      });
      expect(mockReplace).toHaveBeenCalledWith("/packets");
    });
  });

  it("shows an error message when the code is wrong", async () => {
    mockVerify.mockResolvedValue({ error: { message: "invalid" } });
    render(<MFAVerifyPage />);
    await waitFor(() => expect(mockChallenge).toHaveBeenCalled());

    fireEvent.change(screen.getByLabelText(/6-digit code/i), { target: { value: "000000" } });
    fireEvent.submit(screen.getByRole("button", { name: /verify/i }).closest("form")!);

    await waitFor(() => {
      expect(screen.getByText(/invalid code/i)).toBeDefined();
    });
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("strips non-digits from the code input", async () => {
    render(<MFAVerifyPage />);
    const input = screen.getByLabelText(/6-digit code/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "12ab34" } });
    expect(input.value).toBe("1234");
  });
});
