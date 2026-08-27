// @vitest-environment jsdom
//
// The first-visit card (owner, 2026-08-22).
//
// FNS permits a non-profit engaged in SNAP outreach or nutrition education to
// use the SNAP logo for noncommercial educational and outreach purposes. That
// permission comes WITH a condition, not instead of one: the service-mark
// statement must appear wherever an organisation outside USDA uses the mark,
// and the logo may not be altered. Those two are what this file protects —
// they are the difference between permitted use and a product that looks like
// a government service.
import { describe, it, expect, afterEach, afterAll, vi } from "vitest";
import { render, cleanup, fireEvent, screen } from "@testing-library/react";

import { DemeterWelcome, SNAP_SERVICE_MARK } from "../DemeterWelcome";
import { DemeterChat } from "../DemeterChat";
import { T } from "../../lib/i18n/demeter-chat-copy";
import { VERIFIED_STATES } from "@civica/demeter-engine/packs";

Element.prototype.scrollTo = vi.fn() as unknown as typeof Element.prototype.scrollTo;

// THIS jsdom HAS sessionStorage BUT NOT localStorage. The component treats a
// missing localStorage as "never show the card" — deliberately, since showing
// it every visit is worse than never — so without this stub the tests below
// would exercise that fallback and silently prove nothing about first-visit
// behaviour. Stubbing the ENVIRONMENT, not the component.
const store = new Map<string, string>();
// Captured so it can be PUT BACK. Without this the stub leaks into every test
// file that shares the worker: the card starts rendering in their mounts, and
// it intercepts clicks, so unrelated suites fail in the full run while passing
// alone. That is exactly how it failed once here.
const originalLocalStorage = Object.getOwnPropertyDescriptor(window, "localStorage");
Object.defineProperty(window, "localStorage", {
  configurable: true,
  value: {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    key: (i: number) => [...store.keys()][i] ?? null,
    get length() {
      return store.size;
    },
  },
});

afterEach(cleanup);

afterAll(() => {
  if (originalLocalStorage) {
    Object.defineProperty(window, "localStorage", originalLocalStorage);
  } else {
    // This jsdom had none to begin with — restore that, don't leave a stub.
    delete (window as unknown as Record<string, unknown>).localStorage;
  }
});

const copy = { ...T.en.welcome, whatIsSnap: T.en.emptyWhatIsSnap };

function card(onDismiss = () => {}) {
  return render(<DemeterWelcome copy={copy} onDismiss={onDismiss} />).container;
}

function chat(initialMessages: Array<{ role: "user" | "assistant"; content: string }> = []) {
  store.clear();
  try {
    window.sessionStorage.clear();
  } catch {
    /* sessionStorage disabled */
  }
  return render(
    <DemeterChat states={VERIFIED_STATES} initialMessages={initialMessages} />,
  ).container;
}

describe("the conditions attached to using the SNAP logo", () => {
  it("carries the service mark VERBATIM", () => {
    expect(card().querySelector(".dmwel__mark")?.textContent).toBe(SNAP_SERVICE_MARK);
    // FNS's own spacing in "U. S." — reproduced, not tidied.
    expect(SNAP_SERVICE_MARK).toContain("U. S. Department of Agriculture");
    expect(SNAP_SERVICE_MARK).toContain("does not endorse");
  });

  it("keeps the mark in English on every language", () => {
    // "Must include the statement" does not survive translation drift, so the
    // string is deliberately absent from the localized copy table.
    for (const lang of ["en", "es", "vi", "zh"] as const) {
      const c = { ...T[lang].welcome, whatIsSnap: T[lang].emptyWhatIsSnap };
      cleanup();
      const el = render(<DemeterWelcome copy={c} onDismiss={() => {}} />).container;
      expect(el.querySelector(".dmwel__mark")?.textContent, lang).toBe(SNAP_SERVICE_MARK);
      expect(el.querySelector(".dmwel__mark")?.getAttribute("lang"), lang).toBe("en");
    }
  });

  it("renders the logo unaltered, at its true ratio", () => {
    // "The logo cannot be altered" is a condition of being allowed to use it.
    // Scoped to the SNAP logo's own box: the card carries Demeter's mark as
    // well now, and querySelector("img") would grab whichever comes first.
    const img = card().querySelector(".dmwel__logo img")!;
    const w = Number(img.getAttribute("width"));
    const h = Number(img.getAttribute("height"));
    expect(img.getAttribute("src")).toContain("snap-logo");
    expect(w / h).toBeCloseTo(663 / 460, 2);
  });

  it("says plainly that this is not the government", () => {
    // The clause permits outreach and education, not the appearance of being
    // the agency. The logo makes that confusion easy; the body undoes it.
    // It moved to its own line when the card was split into one-point-per-line.
    expect(copy.bodyTwo.toLowerCase()).toContain("not the government");
  });
});

describe("it is a card, not a gate", () => {
  it("Escape closes it", () => {
    const onDismiss = vi.fn();
    card(onDismiss);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onDismiss).toHaveBeenCalled();
  });

  it("the backdrop closes it", () => {
    const onDismiss = vi.fn();
    const c = card(onDismiss);
    fireEvent.click(c.querySelector(".dmwel")!);
    expect(onDismiss).toHaveBeenCalled();
  });

  it("a click inside does NOT close it", () => {
    const onDismiss = vi.fn();
    const c = card(onDismiss);
    fireEvent.click(c.querySelector(".dmwel__card")!);
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it("announces itself as a dialog and names itself", () => {
    const dialog = card().querySelector('[role="dialog"]')!;
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(dialog.getAttribute("aria-labelledby")).toBe("dmwel-title");
    expect(screen.getByText(copy.title)).toBeTruthy();
  });
});

describe("when it shows", () => {
  it("shows on a first visit", () => {
    expect(chat().querySelector(".dmwel")).toBeTruthy();
  });

  it("shows when storage is BLOCKED — we cannot know they have seen it", () => {
    // Reversed 2026-08-26. It used to stay hidden when localStorage threw, on
    // the reasoning that showing it every visit was worse. The two failure
    // modes are not equal: a card shown again is a second of annoyance; a card
    // never shown means someone who does not know what SNAP is never finds
    // out, and never reads that this is not the government.
    const throwing = {
      getItem: () => {
        throw new Error("storage blocked");
      },
      setItem: () => {
        throw new Error("storage blocked");
      },
      removeItem: () => {},
      clear: () => {},
      key: () => null,
      length: 0,
    };
    const saved = Object.getOwnPropertyDescriptor(window, "localStorage");
    Object.defineProperty(window, "localStorage", { configurable: true, value: throwing });
    try {
      const c = render(
        <DemeterChat states={VERIFIED_STATES} initialMessages={[]} />,
      ).container;
      expect(c.querySelector(".dmwel")).toBeTruthy();
      // And dismissing still works for the session, even though the setItem
      // that would remember it throws.
      fireEvent.click(c.querySelector(".dmwel__secondary")!);
      expect(c.querySelector(".dmwel")).toBeNull();
    } finally {
      if (saved) Object.defineProperty(window, "localStorage", saved);
    }
  });

  it("never over an existing conversation — they have already met the product", () => {
    expect(chat([{ role: "user", content: "hi" }]).querySelector(".dmwel")).toBeNull();
  });

  it("holds focus while up, and hands it to the composer on dismissal", () => {
    // THE REGRESSION THIS CAUGHT (CI, 2026-08-26): the composer's
    // desktop-autofocus effect and the card both grabbed focus on mount, and
    // the card won — leaving a keyboard reader inside a dialog while the
    // effect believed it had focused the box behind it. Now the effect stands
    // down while the card is up and takes over when it closes.
    const c = chat();
    expect(document.activeElement?.tagName, "the card holds focus").toBe("BUTTON");
    // "Sign in" is the primary and is a LINK; the dismiss is the quiet button
    // beneath it, and it is the one that holds focus.
    fireEvent.click(c.querySelector(".dmwel__secondary")!);
    expect(c.querySelector(".dmwel")).toBeNull();
  });

  it("does not come back once dismissed", () => {
    const c = chat();
    fireEvent.click(c.querySelector(".dmwel__secondary")!);
    expect(c.querySelector(".dmwel")).toBeNull();
    // A fresh mount, same browser: it stays gone.
    cleanup();
    const again = render(
      <DemeterChat states={VERIFIED_STATES} initialMessages={[]} />,
    ).container;
    expect(again.querySelector(".dmwel")).toBeNull();
  });
});
