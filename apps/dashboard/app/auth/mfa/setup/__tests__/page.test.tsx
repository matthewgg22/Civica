import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const mockEnroll = vi.hoisted(() => vi.fn());
const mockChallenge = vi.hoisted(() => vi.fn());
const mockVerify = vi.hoisted(() => vi.fn());
const mockPush = vi.hoisted(() => vi.fn());
const mockRefresh = vi.hoisted(() => vi.fn());

vi.mock("../../../../../lib/supabase", () => ({
  createClient: vi.fn(() => ({
    auth: {
      mfa: {
        enroll: mockEnroll,
        challenge: mockChallenge,
        verify: mockVerify,
      },
    },
  })),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
}));

import MFASetupPage from "../page";

const ENROLL_OK = {
  data: { id: "factor-1", totp: { qr_code: "data:image/svg+xml;base64,abc", secret: "SECRET123" } },
  error: null,
};

describe("MFASetupPage", () => {
  beforeEach(() => {
    mockEnroll.mockReset();
    mockChallenge.mockReset();
    mockVerify.mockReset();
    mockPush.mockReset();
    mockRefresh.mockReset();
    mockChallenge.mockResolvedValue({ data: { id: "challenge-1" }, error: null });
  });

  it("shows the QR code and secret after enroll succeeds", async () => {
    mockEnroll.mockResolvedValue(ENROLL_OK);
    render(<MFASetupPage />);
    await waitFor(() => {
      expect(screen.getByText(/set up authenticator app/i)).toBeDefined();
    });
    expect(screen.getByAltText(/scan this qr code/i)).toBeDefined();
    expect(screen.getByText("SECRET123")).toBeDefined();
  });

  it("shows the error stage when enroll fails", async () => {
    mockEnroll.mockResolvedValue({ data: null, error: { message: "already enrolled" } });
    render(<MFASetupPage />);
    await waitFor(() => {
      expect(screen.getByText(/could not start 2fa setup/i)).toBeDefined();
    });
  });

  it("enables 2FA on a correct confirmation code", async () => {
    mockEnroll.mockResolvedValue(ENROLL_OK);
    mockVerify.mockResolvedValue({ error: null });
    render(<MFASetupPage />);
    await waitFor(() => screen.getByText(/set up authenticator app/i));

    fireEvent.change(screen.getByLabelText(/enter the 6-digit code/i), { target: { value: "123456" } });
    fireEvent.submit(screen.getByRole("button", { name: /confirm and enable 2fa/i }).closest("form")!);

    await waitFor(() => {
      expect(mockChallenge).toHaveBeenCalledWith({ factorId: "factor-1" });
      expect(mockVerify).toHaveBeenCalledWith({
        factorId: "factor-1",
        challengeId: "challenge-1",
        code: "123456",
      });
      expect(screen.getByText(/two-factor authentication is on/i)).toBeDefined();
    });
  });

  it("shows an error and stays on the form when the code is wrong", async () => {
    mockEnroll.mockResolvedValue(ENROLL_OK);
    mockVerify.mockResolvedValue({ error: { message: "invalid" } });
    render(<MFASetupPage />);
    await waitFor(() => screen.getByText(/set up authenticator app/i));

    fireEvent.change(screen.getByLabelText(/enter the 6-digit code/i), { target: { value: "000000" } });
    fireEvent.submit(screen.getByRole("button", { name: /confirm and enable 2fa/i }).closest("form")!);

    await waitFor(() => {
      expect(screen.getByText(/invalid code/i)).toBeDefined();
    });
    expect(screen.queryByText(/two-factor authentication is on/i)).toBeNull();
  });
});
