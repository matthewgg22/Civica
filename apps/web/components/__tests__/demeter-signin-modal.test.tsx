// @vitest-environment jsdom
//
// The modal's own behaviour, tested against the shared auth actions rather
// than the network.
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { DemeterSignInModal } from "../DemeterSignInModal";
import { SIGNIN_T } from "../../lib/i18n/demeter-signin-copy";
import { EMAIL_SIGNIN_ENABLED } from "../../lib/magic-link";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const ok = () => vi.stubGlobal("fetch", vi.fn<typeof fetch>(async () => new Response(null, { status: 200 })));

function open(lang: "en" | "es" | "vi" | "zh" = "en") {
  return render(<DemeterSignInModal next="/chat" lang={lang} onClose={() => {}} />);
}

// SKIPPED WHILE EMAIL SIGN-IN IS OFF (#699). These drive the email field,
// which EMAIL_SIGNIN_ENABLED hides until SMTP is wired; they reactivate the
// day the flag flips, which is the point of skipIf over deletion.
describe.skipIf(!EMAIL_SIGNIN_ENABLED)("the sent state offers a way back", () => {
  it("shows the address it wrote to, and a retry that returns to the form", async () => {
    ok();
    const { container } = open();
    fireEvent.change(screen.getByLabelText(SIGNIN_T.en.emailLabel), {
      target: { value: "a@b.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: SIGNIN_T.en.emailCta }));
    await waitFor(() => expect(screen.getByText(SIGNIN_T.en.emailSentTitle)).toBeTruthy());
    expect(container.textContent).toContain("a@b.com");

    // Without this the card's only exit is closing it and starting over —
    // which is exactly what someone who mistyped their address needs not to
    // have to do.
    fireEvent.click(screen.getByRole("button", { name: SIGNIN_T.en.emailRetry }));
    expect(screen.getByLabelText(SIGNIN_T.en.emailLabel)).toBeTruthy();
  });
});

describe.skipIf(!EMAIL_SIGNIN_ENABLED)("failures name only what the person can act on", () => {
  it("a rate limit says so and returns focus to the field", async () => {
    vi.stubGlobal("fetch", vi.fn<typeof fetch>(async () => new Response(null, { status: 429 })));
    open();
    const field = screen.getByLabelText(SIGNIN_T.en.emailLabel);
    fireEvent.change(field, { target: { value: "a@b.com" } });
    fireEvent.click(screen.getByRole("button", { name: SIGNIN_T.en.emailCta }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe(SIGNIN_T.en.errorRateLimited));
    expect(document.activeElement).toBe(field);
  });
});

describe("it speaks the chat's language", () => {
  it("carries the Spanish card when the chat is in Spanish", () => {
    ok();
    open("es");
    expect(screen.getByText(SIGNIN_T.es.title)).toBeTruthy();
    // And the Google destination keeps the conversation's own next.
    expect(
      screen.getByRole("link", { name: new RegExp(SIGNIN_T.es.continueGoogle) }).getAttribute("href"),
    ).toContain("next=%2Fchat");
  });
});
