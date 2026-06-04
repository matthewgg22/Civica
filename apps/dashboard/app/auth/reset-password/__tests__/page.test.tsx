import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const mockExchangeCodeForSession = vi.hoisted(() => vi.fn());
const mockUpdateUser = vi.hoisted(() => vi.fn());
const mockPush = vi.hoisted(() => vi.fn());

vi.mock("../../../../lib/supabase", () => ({
  createClient: vi.fn(() => ({
    auth: {
      exchangeCodeForSession: mockExchangeCodeForSession,
      updateUser: mockUpdateUser,
    },
  })),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => ({ get: (key: string) => key === "code" ? "test-code-abc" : null }),
}));

import ResetPasswordPage from "../page";

describe("ResetPasswordPage", () => {
  beforeEach(() => {
    mockExchangeCodeForSession.mockReset();
    mockUpdateUser.mockReset();
    mockPush.mockReset();
  });

  it("shows 'invalid or expired link' when code exchange fails", async () => {
    mockExchangeCodeForSession.mockResolvedValue({ error: { message: "expired" } });
    render(<ResetPasswordPage />);
    await waitFor(() => {
      expect(screen.getByText(/invalid or expired link/i)).toBeDefined();
    });
    expect(screen.queryByLabelText(/new password/i)).toBeNull();
  });

  it("shows password form after successful code exchange", async () => {
    mockExchangeCodeForSession.mockResolvedValue({ error: null });
    render(<ResetPasswordPage />);
    await waitFor(() => {
      expect(screen.getByLabelText(/new password/i)).toBeDefined();
    });
    expect(screen.getByLabelText(/confirm password/i)).toBeDefined();
  });

  it("shows error when passwords do not match — no API call", async () => {
    mockExchangeCodeForSession.mockResolvedValue({ error: null });
    render(<ResetPasswordPage />);
    await waitFor(() => screen.getByLabelText(/new password/i));

    fireEvent.change(screen.getByLabelText(/new password/i), { target: { value: "password123" } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: "different456" } });
    fireEvent.submit(screen.getByRole("button", { name: /set password/i }).closest("form")!);

    expect(screen.getByText(/passwords do not match/i)).toBeDefined();
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  it("shows success message after password update", async () => {
    mockExchangeCodeForSession.mockResolvedValue({ error: null });
    mockUpdateUser.mockResolvedValue({ error: null });

    render(<ResetPasswordPage />);
    await waitFor(() => screen.getByLabelText(/new password/i));

    fireEvent.change(screen.getByLabelText(/new password/i), { target: { value: "newpassword1" } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: "newpassword1" } });
    fireEvent.submit(screen.getByRole("button", { name: /set password/i }).closest("form")!);

    await waitFor(() => {
      expect(screen.getByText(/password updated/i)).toBeDefined();
    });
  });

  it("shows error when updateUser fails", async () => {
    mockExchangeCodeForSession.mockResolvedValue({ error: null });
    mockUpdateUser.mockResolvedValue({ error: { message: "Auth error" } });

    render(<ResetPasswordPage />);
    await waitFor(() => screen.getByLabelText(/new password/i));

    fireEvent.change(screen.getByLabelText(/new password/i), { target: { value: "newpassword1" } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: "newpassword1" } });
    fireEvent.submit(screen.getByRole("button", { name: /set password/i }).closest("form")!);

    await waitFor(() => {
      expect(screen.getByText(/auth error/i)).toBeDefined();
    });
  });
});
