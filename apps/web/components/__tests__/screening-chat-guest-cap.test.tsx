// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor, within } from "@testing-library/react";
import { ScreeningChat } from "../ScreeningChat";

// Can't reach 5 real guest screenings against a live server without real
// Supabase persistence (unavailable in this sandbox — no Docker registry
// egress), so the guest_cap_reached UI path is covered here instead: mock
// exactly the 403 the real route returns and confirm the CTA renders.

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

// jsdom implements neither element scrolling nor smooth-scroll options.
Element.prototype.scrollTo = vi.fn() as unknown as typeof Element.prototype.scrollTo;

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("ScreeningChat — guest cap reached", () => {
  it("shows the exact server error plus a Sign in CTA, and never fakes a result", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ error: "Guest screening limit reached — sign in to keep going.", reason: "guest_cap_reached" }, 403),
    );
    render(<ScreeningChat initialState="CA" />);

    fireEvent.change(screen.getByPlaceholderText(/Describe the household/), {
      target: { value: "She's 62, gets Social Security." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    // The worksheet panel shows the identical guest-cap copy in its own
    // note — scope to the chat's own error banner specifically, the thing
    // this test is actually about, rather than the page as a whole.
    await waitFor(() => expect(document.querySelector(".screening__error")).toBeTruthy());
    const errorBanner = within(document.querySelector(".screening__error") as HTMLElement);
    expect(errorBanner.getByText(/Guest screening limit reached/)).toBeTruthy();
    const cta = errorBanner.getByRole("link", { name: /Sign in/ });
    expect(cta.getAttribute("href")).toBe("/screen/sign-in");
  });

  it("a non-cap error does NOT render the sign-in CTA", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: "Too many requests — try again in a minute." }, 429));
    render(<ScreeningChat initialState="CA" />);

    fireEvent.change(screen.getByPlaceholderText(/Describe the household/), { target: { value: "hi" } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => expect(document.querySelector(".screening__error")).toBeTruthy());
    const errorBanner = within(document.querySelector(".screening__error") as HTMLElement);
    expect(errorBanner.getByText(/Too many requests/)).toBeTruthy();
    expect(errorBanner.queryByRole("link", { name: /Sign in/ })).toBeNull();
  });
});
