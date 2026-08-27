// @vitest-environment jsdom
//
// The contents marker follows the section you are reading.
//
// The thing worth protecting is that this is an ENHANCEMENT. These pages are
// server-rendered text on purpose; the script adds a highlight and nothing
// else. So the first test here is that the list is complete and every link
// works with no IntersectionObserver at all — which is also what a crawler
// and a failed hydration get.
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, cleanup, act } from "@testing-library/react";
import { LegalContents, type ContentsEntry } from "../components/LegalContents";

const ENTRIES: ContentsEntry[] = [
  { id: "agreement", heading: "1. This agreement" },
  { id: "who", heading: "3. Who can use Demeter" },
  { id: "contact", heading: "16. Contact" },
];

/** Captures the observer callback so a test can drive it, and records what was
 *  observed. */
function stubObserver() {
  const state: {
    cb?: (records: unknown[]) => void;
    observed: string[];
    disconnected: boolean;
  } = { observed: [], disconnected: false };
  class IO {
    constructor(cb: (records: unknown[]) => void) {
      state.cb = cb;
    }
    observe(el: HTMLElement) {
      state.observed.push(el.id);
    }
    disconnect() {
      state.disconnected = true;
    }
    unobserve() {}
  }
  vi.stubGlobal("IntersectionObserver", IO);
  return state;
}

/** Sections must exist in the document — the component observes by id. */
function mount(entries = ENTRIES) {
  for (const e of entries) {
    const s = document.createElement("section");
    s.id = e.id;
    document.body.appendChild(s);
  }
  return render(<LegalContents entries={entries} label="Contents" />);
}

const marked = (c: HTMLElement) =>
  c.querySelector("a[aria-current]")?.getAttribute("href");

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
});

describe("without any script at all", () => {
  it("still renders every entry, linked", () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    const { container } = mount();
    const links = [...container.querySelectorAll("a")];
    expect(links).toHaveLength(ENTRIES.length);
    expect(links.map((a) => a.getAttribute("href"))).toEqual(["#agreement", "#who", "#contact"]);
  });

  it("marks the first section, rather than nothing", () => {
    // At the top of the page you are, in every sense that matters, at the
    // beginning — and a contents list with nothing marked reads as broken.
    vi.stubGlobal("IntersectionObserver", undefined);
    const { container } = mount();
    expect(marked(container)).toBe("#agreement");
  });
});

describe("the marker follows the reader", () => {
  it("observes every section", () => {
    const io = stubObserver();
    mount();
    expect(io.observed).toEqual(["agreement", "who", "contact"]);
  });

  it("moves to the section crossing the band", () => {
    const io = stubObserver();
    const { container } = mount();
    act(() => {
      io.cb!([{ target: { id: "who" }, isIntersecting: true, boundingClientRect: { top: 40 } }]);
    });
    expect(marked(container)).toBe("#who");
  });

  it("picks the one that just STARTED when two straddle the band", () => {
    // This is the case that decides whether the marker leads or lags, and it
    // happens on every section boundary: the outgoing section's bottom is
    // still in the band while the incoming section's top arrives. The one you
    // are now reading is the one that just started — the greater top.
    //
    // Getting this backwards is not subtle in use: the marker sits a heading
    // behind you the entire way down the document. It was backwards here, and
    // only the real-browser test caught it (e2e/legal-scrollspy.spec.ts) —
    // this assertion had been written to match the bug.
    const io = stubObserver();
    const { container } = mount();
    act(() => {
      io.cb!([
        { target: { id: "who" }, isIntersecting: true, boundingClientRect: { top: -40 } },
        { target: { id: "contact" }, isIntersecting: true, boundingClientRect: { top: 90 } },
      ]);
    });
    expect(marked(container)).toBe("#contact");
  });

  it("holds its place when nothing is in the band", () => {
    // Which happens constantly — mid-paragraph, between two sections. Clearing
    // the marker there is the difference between a marker and a flicker.
    const io = stubObserver();
    const { container } = mount();
    act(() => {
      io.cb!([{ target: { id: "who" }, isIntersecting: true, boundingClientRect: { top: 40 } }]);
    });
    act(() => {
      io.cb!([{ target: { id: "who" }, isIntersecting: false, boundingClientRect: { top: -10 } }]);
    });
    expect(marked(container)).toBe("#who");
  });

  it("reaches the last section at the bottom of the page", () => {
    // "Other terms" and "Contact" are short enough that they may never cross
    // the band, which would strand the marker three entries above the reader.
    const io = stubObserver();
    const { container } = mount();
    act(() => {
      io.cb!([{ target: { id: "agreement" }, isIntersecting: true, boundingClientRect: { top: 20 } }]);
    });
    Object.defineProperty(document.documentElement, "scrollHeight", {
      value: 2000,
      configurable: true,
    });
    Object.defineProperty(window, "innerHeight", { value: 800, configurable: true });
    Object.defineProperty(window, "scrollY", { value: 1200, configurable: true });
    act(() => {
      window.dispatchEvent(new Event("scroll"));
    });
    expect(marked(container)).toBe("#contact");
  });

  it("marks position, not page", () => {
    // aria-current="page" would claim this is a different page. It is a place
    // inside this one.
    const io = stubObserver();
    const { container } = mount();
    act(() => {
      io.cb!([{ target: { id: "who" }, isIntersecting: true, boundingClientRect: { top: 40 } }]);
    });
    expect(container.querySelector("a[aria-current]")!.getAttribute("aria-current")).toBe(
      "location",
    );
  });

  it("marks exactly one entry", () => {
    const io = stubObserver();
    const { container } = mount();
    act(() => {
      io.cb!([
        { target: { id: "who" }, isIntersecting: true, boundingClientRect: { top: 30 } },
        { target: { id: "contact" }, isIntersecting: true, boundingClientRect: { top: 90 } },
      ]);
    });
    expect(container.querySelectorAll("a[aria-current]")).toHaveLength(1);
    expect(container.querySelectorAll("a.is-current")).toHaveLength(1);
  });

  it("stops observing when it goes away", () => {
    const io = stubObserver();
    const { unmount } = mount();
    unmount();
    expect(io.disconnected).toBe(true);
  });
});
