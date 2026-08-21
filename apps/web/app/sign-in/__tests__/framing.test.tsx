// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";

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
import { SIGNIN_T } from "../../../lib/i18n/demeter-signin-copy";

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

// #898 P1-5 — the third-pass audit's screenshot showed the OLD Civica
// "Save your application… for your navigator" page reached from the Demeter
// chat. Two confirmed wrong-branch entries:
//   1. every LOCALIZED chat page — /es/screen/ask etc. — failed the bare
//      startsWith("/screen") check, so every Spanish/Vietnamese/Chinese
//      user who pressed Save got the wrong product's sign-in;
//   2. the "Email this to me" sign-in link hardcoded next=/chat (not a
//      real route, and not /screen-prefixed).
describe("Demeter framing survives localized paths (#898 P1-5)", () => {
  afterEach(cleanup);

  // Since #694 these assert the LOCALIZED Demeter title — the same check
  // (right product, not the apply flow), one better: the right language too.
  it("a Spanish chat page's save still reads as Demeter", async () => {
    renderAt("next=%2Fes%2Fscreen%2Fask%3Fsave%3Dpending");
    expect(await screen.findByText(SIGNIN_T.es.title)).toBeTruthy();
    expect(screen.queryByText(/for your navigator/)).toBeNull();
  });

  it("Vietnamese and Chinese too", async () => {
    renderAt("next=%2Fvi%2Fscreen%2Fask");
    expect(await screen.findByText(SIGNIN_T.vi.title)).toBeTruthy();
    cleanup();
    renderAt("next=%2Fzh%2Fscreen%2Fask");
    expect(await screen.findByText(SIGNIN_T.zh.title)).toBeTruthy();
  });
});

// The language gap (#694). The chat, the save panel, and the saved list are
// fully four-language; sign-in was the one monolingual step, standing between
// a Vietnamese speaker and their saved conversation. The Demeter branch now
// draws from its own AnswerLang-keyed table (the surface's own pattern) and
// offers all four languages; the apply flow keeps snap-copy and its EN/ES
// toggle untouched.
describe("the Demeter branch speaks all four languages (#694)", () => {
  beforeEach(() => {
    searchParams.value = new URLSearchParams();
  });
  afterEach(cleanup);

  it("?lang=vi renders the card in Vietnamese", async () => {
    renderAt("next=%2Fvi%2Fscreen%2Fask&lang=vi");
    expect(await screen.findByText(SIGNIN_T.vi.title)).toBeTruthy();
    expect(screen.getByText(SIGNIN_T.vi.emailCta)).toBeTruthy();
  });

  it("a localized next path implies the language when ?lang is absent", async () => {
    // The magic-link round trip and older callers carry only next — the
    // /zh/screen/ask prefix is itself the language signal.
    renderAt("next=%2Fzh%2Fscreen%2Fask%3Fsave%3Dpending");
    expect(await screen.findByText(SIGNIN_T.zh.title)).toBeTruthy();
  });

  it("offers all four languages, and switching works without navigation", async () => {
    renderAt("next=%2Fscreen%2Fask");
    fireEvent.click(await screen.findByRole("button", { name: "Tiếng Việt" }));
    expect(screen.getByText(SIGNIN_T.vi.title)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "中文" }));
    expect(screen.getByText(SIGNIN_T.zh.title)).toBeTruthy();
  });

  it("the apply flow keeps its two-way EN/ES toggle", async () => {
    renderAt("next=%2Fapply");
    // The toggle's accessible name is its aria-label, which names the action
    // in the OTHER language ("Cambiar a español" while showing English).
    expect(
      await screen.findByRole("button", { name: /Cambiar a español|Switch to English/ }),
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Tiếng Việt" })).toBeNull();
  });

  it("every language has every string, non-empty", () => {
    const keys = Object.keys(SIGNIN_T.en) as Array<keyof typeof SIGNIN_T.en>;
    for (const lang of ["en", "es", "vi", "zh"] as const) {
      for (const key of keys) {
        expect(SIGNIN_T[lang][key], `${lang}.${key}`).toBeTruthy();
      }
    }
  });
});

// The browser tab is part of the framing too (#698). The page could not export
// metadata while it was itself the "use client" module, so every visit wore
// the root layout's "Civica — Apply for SNAP food benefits" title — including
// a Vietnamese Demeter user mid-save. generateMetadata switches on the same
// forConversation test as the page body.
describe("tab title matches the product (#698)", () => {
  it("Demeter by default and for chat arrivals; Civica for the apply flow", async () => {
    const { generateMetadata } = await import("../page");
    const titleFor = async (query: Record<string, string>) =>
      (await generateMetadata({ searchParams: Promise.resolve(query) })).title;
    expect(await titleFor({})).toMatch(/Demeter/);
    expect(await titleFor({ next: "/vi/screen/ask" })).toMatch(/Demeter/);
    expect(await titleFor({ next: "/apply" })).toMatch(/Civica/);
    expect(await titleFor({ next: "/apply" })).not.toMatch(/Demeter/);
  });
});
