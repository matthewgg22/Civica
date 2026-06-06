import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const mockSignInWithOAuth = vi.hoisted(() => vi.fn());
const mockSignInWithPassword = vi.hoisted(() => vi.fn());
const mockSignOut = vi.hoisted(() => vi.fn());
const mockPush = vi.hoisted(() => vi.fn());
const mockRefresh = vi.hoisted(() => vi.fn());

vi.mock("../../../lib/supabase", () => ({
  createClient: vi.fn(() => ({
    auth: {
      signInWithOAuth: mockSignInWithOAuth,
      signInWithPassword: mockSignInWithPassword,
      signOut: mockSignOut,
    },
  })),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
}));

import LoginPage from "../page";

// jsdom has no window.location.origin override needed — defaults to http://localhost.
const EXPECTED_CALLBACK = "http://localhost:3000/auth/callback";

describe("LoginPage OAuth buttons", () => {
  beforeEach(() => {
    mockSignInWithOAuth.mockReset();
    mockSignInWithOAuth.mockResolvedValue({ error: null });
    // jsdom origin is http://localhost; pin it so redirectTo is deterministic.
    Object.defineProperty(window, "location", {
      value: { origin: "http://localhost:3000", search: "" },
      writable: true,
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("Google button calls signInWithOAuth with provider google + callback redirect", async () => {
    render(<LoginPage />);
    fireEvent.click(screen.getByRole("button", { name: /sign in with google/i }));
    await waitFor(() => {
      expect(mockSignInWithOAuth).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: "google",
          options: expect.objectContaining({ redirectTo: EXPECTED_CALLBACK }),
        }),
      );
    });
  });

  it("hides the Microsoft button by default (flag unset)", () => {
    render(<LoginPage />);
    expect(screen.queryByRole("button", { name: /sign in with microsoft/i })).toBeNull();
  });

  it("shows the Microsoft button when NEXT_PUBLIC_ENABLE_MICROSOFT_OAUTH=true", () => {
    vi.stubEnv("NEXT_PUBLIC_ENABLE_MICROSOFT_OAUTH", "true");
    render(<LoginPage />);
    expect(screen.getByRole("button", { name: /sign in with microsoft/i })).toBeDefined();
  });

  it("Microsoft button (when enabled) calls signInWithOAuth with provider azure + email scope + callback redirect", async () => {
    vi.stubEnv("NEXT_PUBLIC_ENABLE_MICROSOFT_OAUTH", "true");
    render(<LoginPage />);
    fireEvent.click(screen.getByRole("button", { name: /sign in with microsoft/i }));
    await waitFor(() => {
      expect(mockSignInWithOAuth).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: "azure",
          options: expect.objectContaining({
            scopes: "email",
            redirectTo: EXPECTED_CALLBACK,
          }),
        }),
      );
    });
  });

  it("surfaces the provider error message when OAuth fails", async () => {
    mockSignInWithOAuth.mockResolvedValue({ error: { message: "provider disabled" } });
    render(<LoginPage />);
    fireEvent.click(screen.getByRole("button", { name: /sign in with google/i }));
    await waitFor(() => {
      expect(screen.getByText(/provider disabled/i)).toBeDefined();
    });
  });
});
