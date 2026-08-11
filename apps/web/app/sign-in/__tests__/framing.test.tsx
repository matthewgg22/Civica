// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

// Which product this page presents as (#698).
//
// The default used to be the Civica APPLY flow, dating from before the pivot.
// Every cold entry — a bookmark, a shared link, a back-navigation that dropped
// the query, an auth error redirect — greeted a Demeter user with "Save your
// application… for your navigator": an application they never started and a
// navigator they have never met, shown at the exact moment they are deciding
// whether to trust this with their email.
//
// Both real callers pass `next` explicitly (DemeterSave → /screen/…,
// BuddyBanner → /apply), so this fallback only ever governed entries that named
// no destination.

const searchParams = vi.hoisted(() => ({ value: new URLSearchParams() }));

vi.mock("next/navigation", () => ({
  useSearchParams: () => searchParams.value,
}));

import SignInPage from "../page";

function renderAt(query: string) {
  searchParams.value = new URLSearchParams(query);
  render(<SignInPage />);
}

describe("sign-in framing", () => {
  beforeEach(() => {
    searchParams.value = new URLSearchParams();
  });
  afterEach(cleanup);

  it("a cold entry with no destination reads as Demeter, not the apply flow", async () => {
    renderAt("");
    expect(await screen.findByText("Save your conversation")).toBeTruthy();
    expect(screen.queryByText("Save your application")).toBeNull();
  });

  it("arriving from the chat reads as Demeter", async () => {
    renderAt("next=%2Fscreen%2Fask");
    expect(await screen.findByText("Save your conversation")).toBeTruthy();
  });

  it("the apply flow still gets its own copy when it asks for it", async () => {
    // BuddyBanner sends people here with next=/apply. That flow is unchanged —
    // this fix inverts the DEFAULT, it does not take the apply copy away.
    renderAt("next=%2Fapply");
    expect(await screen.findByText("Save your application")).toBeTruthy();
    expect(screen.queryByText("Save your conversation")).toBeNull();
  });

  it("brands as Demeter and links back to the chat, not /welcome", async () => {
    // /welcome is on the retire list (#668); sending a Demeter user there
    // mid-sign-in lands them somewhere unrelated to what they were doing.
    renderAt("");
    const brand = await screen.findByRole("link", { name: /Demeter/ });
    expect(brand.getAttribute("href")).toBe("/screen/ask");
    expect(screen.queryByRole("link", { name: "Civica" })).toBeNull();
  });

  it("keeps the Civica brand on the apply flow", async () => {
    renderAt("next=%2Fapply");
    const brand = await screen.findByRole("link", { name: "Civica" });
    expect(brand.getAttribute("href")).toBe("/welcome");
  });

  it("scopes the reskin with data-surface so the apply flow is untouched", async () => {
    // The two products share this page; the Demeter styling is keyed off this
    // attribute rather than changing the shared page for everyone.
    const { container } = render(<SignInPage />);
    await screen.findByText("Save your conversation");
    expect(container.querySelector(".signin-page")?.getAttribute("data-surface")).toBe("demeter");
    cleanup();

    searchParams.value = new URLSearchParams("next=%2Fapply");
    const applyRender = render(<SignInPage />);
    await screen.findByText("Save your application");
    expect(applyRender.container.querySelector(".signin-page")?.getAttribute("data-surface")).toBe(
      "civica",
    );
  });
});
