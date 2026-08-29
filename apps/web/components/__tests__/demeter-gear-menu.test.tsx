// @vitest-environment jsdom
//
// The settings gear is a native <details>. A comment here used to claim Escape
// and outside-click "come free" with <details> — they do not (only <dialog>
// and popovers close that way), so the menu stayed open until you clicked the
// gear again. A small effect now adds both; these pin it (launch audit
// 2026-08-28), and pin that a click INSIDE the menu does not close it.
import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, cleanup, fireEvent } from "@testing-library/react";

vi.mock("../../lib/supabase-browser", () => ({
  supabaseBrowser: () => ({ auth: { getSession: async () => ({ data: { session: null } }) } }),
}));

import { DemeterChat } from "../DemeterChat";
import { VERIFIED_STATES } from "@civica/demeter-engine/packs";

Element.prototype.scrollTo = vi.fn() as unknown as typeof Element.prototype.scrollTo;

function chat() {
  return render(
    <DemeterChat
      states={VERIFIED_STATES}
      initialState={null}
      initialQuestion={null}
      initialMessages={[]}
      initialWorksheet={null}
      savedConversationId={null}
      pendingSave={false}
      geoHint={null}
    />,
  ).container;
}

function gearOf(container: HTMLElement): HTMLDetailsElement {
  const el = container.querySelector("details.demeter__gear");
  expect(el, "gear menu did not render").not.toBeNull();
  return el as HTMLDetailsElement;
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 200 })));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("settings gear menu", () => {
  it("closes on Escape", () => {
    const gear = gearOf(chat());
    gear.open = true;
    fireEvent.keyDown(document, { key: "Escape" });
    expect(gear.open).toBe(false);
  });

  it("closes on an outside click", () => {
    const gear = gearOf(chat());
    gear.open = true;
    fireEvent.pointerDown(document.body);
    expect(gear.open).toBe(false);
  });

  it("stays open when the click lands inside the menu", () => {
    const gear = gearOf(chat());
    gear.open = true;
    const link = gear.querySelector("a.demeter__settingslink");
    expect(link, "settings links did not render").not.toBeNull();
    fireEvent.pointerDown(link!);
    expect(gear.open).toBe(true);
  });

  it("does nothing on Escape while already closed (no throw, stays closed)", () => {
    const gear = gearOf(chat());
    expect(gear.open).toBe(false);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(gear.open).toBe(false);
  });
});
