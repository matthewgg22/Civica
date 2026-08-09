// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";

const mockPush = vi.hoisted(() => vi.fn());
const mockSignInWithPassword = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));
vi.mock("../../../../lib/supabase-browser", () => ({
  supabaseBrowser: () => ({ auth: { signInWithPassword: mockSignInWithPassword } }),
}));

import ScreeningSignInPage from "../page";

beforeEach(() => {
  mockPush.mockReset();
  mockSignInWithPassword.mockReset().mockResolvedValue({ error: null });
});
afterEach(() => cleanup());

function fillAndSubmit(email: string, password: string) {
  fireEvent.change(screen.getByLabelText("Work email"), { target: { value: email } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: password } });
  fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
}

describe("ScreeningSignInPage", () => {
  it("a successful sign-in redirects to /screen/session", async () => {
    render(<ScreeningSignInPage />);
    fillAndSubmit("staff@franklincounty.org", "correct-horse");
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/screen/session"));
    expect(mockSignInWithPassword).toHaveBeenCalledWith({
      email: "staff@franklincounty.org",
      password: "correct-horse",
    });
  });

  it("a rejected credential shows an inline error and does not redirect", async () => {
    mockSignInWithPassword.mockResolvedValue({ error: { message: "Invalid login credentials" } });
    render(<ScreeningSignInPage />);
    fillAndSubmit("staff@franklincounty.org", "wrong-password");
    await waitFor(() => expect(screen.getByRole("alert").textContent).toBeTruthy());
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("a network failure shows an error instead of crashing", async () => {
    mockSignInWithPassword.mockRejectedValue(new Error("network down"));
    render(<ScreeningSignInPage />);
    fillAndSubmit("staff@franklincounty.org", "correct-horse");
    await waitFor(() => expect(screen.getByRole("alert").textContent).toBeTruthy());
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("the SSO button is present but disabled — a visible stub, not a dead end", () => {
    render(<ScreeningSignInPage />);
    const sso = screen.getByRole("button", { name: /organization's SSO/ });
    expect(sso).toHaveProperty("disabled", true);
  });

  it("offers a guest path out, matching the landing page's own escape hatch", () => {
    render(<ScreeningSignInPage />);
    const link = screen.getByRole("link", { name: /Continue as a guest/ });
    expect(link.getAttribute("href")).toBe("/screen/session");
  });

  it("does not submit with an empty password", () => {
    render(<ScreeningSignInPage />);
    fireEvent.change(screen.getByLabelText("Work email"), { target: { value: "a@b.org" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(mockSignInWithPassword).not.toHaveBeenCalled();
  });
});
