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
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { DemeterWelcome, SNAP_SERVICE_MARK } from "../DemeterWelcome";
import { DemeterChat } from "../DemeterChat";
import { T } from "../../lib/i18n/demeter-chat-copy";
import { VERIFIED_STATES } from "@civica/demeter-engine/packs";

Element.prototype.scrollTo = vi.fn() as unknown as typeof Element.prototype.scrollTo;

// THIS jsdom HAS sessionStorage BUT NOT localStorage. Without the stub below
// every test here would exercise the blocked-storage path — which since
// 2026-08-26 SHOWS the card unconditionally, because a dismissal that cannot
// be remembered cannot be assumed. That path proves nothing about whether a
// dismissal sticks, which is what most of this file is about. Stubbing the
// ENVIRONMENT, not the component.
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

const copy = T.en.welcome;

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
      const c = T[lang].welcome;
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

// ── The card's second pass (owner, 2026-08-26) ────────────────────────────
//
// These are REGRESSION guards, and each one names the thing that actually went
// wrong. Two greys had already been removed from this card once, under a CSS
// comment explaining why; they came back a session later because the fix was
// appended to the end of globals.css rather than made where the rule lived, so
// the file ended up carrying four `font-size` declarations for one selector and
// the three dead ones still carried the reasoning. Whatever a future session
// changes here, these say what must not quietly revert.
describe("the definition is said once, not twice", () => {
  // THE BUG: the card borrowed `emptyWhatIsSnap`, so dismissing it handed the
  // reader the same 29 words again in the empty state directly behind it —
  // the first thing the product did after introducing itself was repeat
  // itself.
  //
  // They have different jobs now. The card carries USDA's full definition,
  // because it IS the introduction and it shows at both doors. The empty
  // state carries a gloss: enough that the letters "SNAP" are not meaningless
  // to someone who dismissed the card without reading it, and no more.
  const LANGS = ["en", "es", "vi", "zh"] as const;

  it("gives the card and the empty state different words, in every language", () => {
    for (const lang of LANGS) {
      const card = T[lang].welcome.whatIsSnap;
      const empty = T[lang].emptyWhatIsSnap;
      expect(card?.trim(), `${lang} card definition`).toBeTruthy();
      expect(empty?.trim(), `${lang} empty gloss`).toBeTruthy();
      expect(card, `${lang}: the same sentence twice`).not.toBe(empty);
      // Not merely different — neither may CONTAIN the other, which is how
      // "just shortening one" would quietly reintroduce the repeat.
      expect(card.includes(empty), `${lang}: the gloss sits inside the definition`).toBe(false);
      expect(empty.includes(card), `${lang}: the definition sits inside the gloss`).toBe(false);
    }
  });

  it("keeps the gloss genuinely shorter than the definition", () => {
    for (const lang of LANGS) {
      expect(
        T[lang].emptyWhatIsSnap.length,
        `${lang}: the gloss is not shorter than the definition it stands in for`,
      ).toBeLessThan(T[lang].welcome.whatIsSnap.length);
    }
  });

  it("still names the program in both places", () => {
    for (const lang of LANGS) {
      expect(T[lang].welcome.whatIsSnap, lang).toContain("SNAP");
      expect(T[lang].emptyWhatIsSnap, lang).toContain("SNAP");
    }
  });

  it("renders the card's own definition, not the empty state's gloss", () => {
    const c = card();
    expect(c.textContent).toContain(T.en.welcome.whatIsSnap);
    expect(c.textContent, "the card is showing the gloss").not.toContain(T.en.emptyWhatIsSnap);
  });
});

describe("the welcome card's second pass", () => {
  const css = () =>
    readFileSync(join(__dirname, "..", "..", "app", "globals.css"), "utf8");
  const rule = (sel: string) => {
    const hit = css().match(
      new RegExp(`^${sel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\{[^}]*\\}`, "m"),
    );
    return hit?.[0] ?? "";
  };

  it("keeps the card's ink on the two lines that had been greyed out", () => {
    // The caveat is the one sentence that limits what this product claims, and
    // it had been the faintest thing on the card. It recedes by SIZE now.
    const quiet = rule(".dmwel__body--quiet");
    expect(quiet, "the caveat is declared").not.toBe("");
    expect(quiet).not.toMatch(/color:\s*var\(--demeter-muted\)/);
    expect(quiet).toMatch(/font-size/);
    expect(rule(".dmwel__secondary")).not.toMatch(
      /color:\s*var\(--demeter-muted\)/,
    );
  });

  it("declares each of the card's properties exactly once", () => {
    // THE ACTUAL BUG BEHIND THE GREYS. Four `.dmwel__mark` font-sizes shipped
    // at once — 0.7rem, then 0.62rem under a comment explaining why it had to
    // be small, then 0.78rem, LARGER than it started. Only the last did
    // anything. A count is the only thing that catches an append.
    const sheet = css();
    for (const [sel, prop] of [
      [".dmwel__mark", "font-size"],
      [".dmwel__body--quiet", "color"],
      [".dmwel__logo img", "max-width"],
      [".dmwel__brandword", "font-size"],
    ] as const) {
      const blocks =
        sheet.match(
          new RegExp(
            `${sel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[^{}]*\\{[^}]*\\}`,
            "g",
          ),
        ) ?? [];
      const declaring = blocks.filter((b) =>
        new RegExp(`(^|[;{\\s])${prop}\\s*:`).test(b),
      );
      // AT MOST once. Zero is fine and sometimes the point — `--quiet` lost
      // its `color` outright when the grey came off it. What must never
      // return is TWO, where the later one silently wins and the earlier one
      // keeps the comment that explains the decision.
      expect(
        declaring.length,
        `${sel} declares ${prop} ${declaring.length}x — edit the rule, do not append a new one`,
      ).toBeLessThanOrEqual(1);
    }
  });

  it("sets the card's prose left while the title stays centred", () => {
    expect(rule(".dmwel__what,\n.dmwel__body")).toMatch(/text-align:\s*left/);
    expect(rule(".dmwel__title")).not.toMatch(/text-align/);
  });

  it("reproduces the SNAP logo unaltered, at a size the Demeter mark can meet", () => {
    // "The logo cannot be altered" is a CONDITION of being allowed to use it,
    // so the box has to keep the mark's true 663:460 ratio. And it may not
    // dwarf the product's own mark: a card that opens on the government's logo
    // as its largest object is the confusion the notice below exists to stop.
    const src = readFileSync(join(__dirname, "..", "DemeterWelcome.tsx"), "utf8");
    const w = Number(src.match(/snap-logo\.png[^/]*width=\{(\d+)\}/)?.[1]);
    const h = Number(src.match(/snap-logo\.png[^/]*height=\{(\d+)\}/)?.[1]);
    expect(Math.abs(w / h - 663 / 460), `${w}x${h} is not the true ratio`).toBeLessThan(0.01);
    const markSize = Number(src.match(/DemeterMark size=\{(\d+)\}/)?.[1]);
    // The lockup is the mark PLUS the word beneath it, so parity is not a
    // pixel identity — but the programme's mark must not run away with the
    // card the way 150x104 against 40px did.
    expect(w * h).toBeLessThan(markSize * markSize * 4);
  });

  it("has no divider left to strand when the marks wrap", () => {
    const src = readFileSync(join(__dirname, "..", "DemeterWelcome.tsx"), "utf8");
    expect(src).not.toContain("dmwel__marksep");
    expect(css()).not.toContain(".dmwel__marksep");
    // Wrap stays: it is the graceful failure for a long translation.
    expect(rule(".dmwel__marks")).toMatch(/flex-wrap:\s*wrap/);
  });

  it("puts the required notice after the action, not between it and the reader", () => {
    const c = card();
    const kids = [...c.querySelector(".dmwel__card")!.children].map(
      (e) => e.className,
    );
    const cls = (k: string) => String(k).split(/\s+/);
    const notice = kids.findIndex((k) => cls(k).includes("dmwel__mark"));
    const cta = kids.findIndex((k) => cls(k).includes("dmwel__cta"));
    expect(notice, "the notice is rendered").toBeGreaterThan(-1);
    expect(notice, "the notice follows the call to action").toBeGreaterThan(cta);
    // It is still THERE, verbatim, which is the condition of using the mark.
    expect(c.textContent).toContain(SNAP_SERVICE_MARK);
  });
});
