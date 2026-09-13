// @vitest-environment jsdom
//
// REGRESSION: the box under the primary on the welcome card.
//
// Initial focus went to the "Continue without signing in" button, and a
// focused button paints its focus ring — so on every open, for anyone whose
// last input was the keyboard, a terracotta box appeared around that link
// directly beneath the filled pill. It read as a second bordered button
// competing with the first. Shrinking the ring to hug the text helped and did
// not fix it, because the problem was that a ring was being drawn at all.
//
// The card takes focus now, which is the ordinary modal pattern: the dialog is
// announced, Tab still walks the controls, and a ring appears only when
// someone actually tabs to one.
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { DemeterWelcome } from "../DemeterWelcome";
import { T } from "../../lib/i18n/demeter-chat-copy";

afterEach(() => cleanup());

function open(signInHref: string | undefined = "/sign-in?next=%2Fchat") {
  return render(
    <DemeterWelcome copy={T.en.welcome} signInHref={signInHref} onDismiss={vi.fn()} />,
  ).container;
}

describe("welcome card initial focus", () => {
  it("focuses the dialog itself, not a control inside it", () => {
    const c = open();
    const card = c.querySelector('.dmwel__card[role="dialog"]');
    expect(card, "card did not render").not.toBeNull();
    expect(document.activeElement, "focus is not on the dialog").toBe(card);
  });

  it("never lands initial focus on the quiet secondary action", () => {
    const c = open();
    const secondary = c.querySelector(".dmwel__secondary");
    expect(secondary, "secondary did not render").not.toBeNull();
    // The assertion that would have caught the box.
    expect(document.activeElement).not.toBe(secondary);
  });

  it("keeps the card focusable so the dialog is reachable at all", () => {
    const c = open();
    expect(c.querySelector('.dmwel__card')?.getAttribute("tabindex")).toBe("-1");
  });

  it("holds when there is no sign-in href and the card shows a single CTA", () => {
    const c = open(undefined);
    const card = c.querySelector('.dmwel__card[role="dialog"]');
    expect(document.activeElement).toBe(card);
  });
});
