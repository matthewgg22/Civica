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

  // #512: middleware now fail-closes to this page on an indeterminate AAL
  // check, not only for genuinely-enrolled-but-unverified staff -- so a
  // non-enrolled visitor (or one hitting a real listFactors/challenge
  // error) can land here too. Before this fix that silently produced a
  // permanently-disabled Verify button with no explanation; these three
  // tests cover the explicit recovery UI that replaced it.
  describe("#512: no_factor / check_failed recovery UI", () => {
    it("shows a clear message (not the code form) when no TOTP factor is enrolled", async () => {
      mockListFactors.mockResolvedValue({ data: { totp: [] } });
      render(<MFAVerifyPage />);
      await screen.findByText(/no two-factor method found/i);
      expect(screen.queryByLabelText(/6-digit code/i)).toBeNull();
      expect(screen.getByRole("button", { name: /try again/i })).toBeDefined();
      expect(screen.getByRole("button", { name: /sign out/i })).toBeDefined();
    });

    it("shows a clear message when listFactors itself errors", async () => {
      mockListFactors.mockResolvedValue({ data: null, error: { message: "network error" } });
      render(<MFAVerifyPage />);
      await screen.findByText(/couldn.t verify two-factor status/i);
      expect(screen.queryByLabelText(/6-digit code/i)).toBeNull();
    });

    it("shows a clear message when the challenge call fails for an enrolled factor", async () => {
      mockChallenge.mockResolvedValue({ data: null, error: { message: "network error" } });
      render(<MFAVerifyPage />);
      await screen.findByText(/couldn.t verify two-factor status/i);
      expect(screen.queryByLabelText(/6-digit code/i)).toBeNull();
    });

    it("the sign-out escape hatch posts to /auth/signout, not a GET link", async () => {
      // /auth/signout only has a POST handler -- a plain <a href> would 405.
      mockListFactors.mockResolvedValue({ data: { totp: [] } });
      render(<MFAVerifyPage />);
      const signOutButton = await screen.findByRole("button", { name: /sign out/i });
      const form = signOutButton.closest("form");
      expect(form?.getAttribute("action")).toBe("/auth/signout");
      expect(form?.getAttribute("method")).toBe("post");
    });
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
