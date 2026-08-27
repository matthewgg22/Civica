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

/** Sections must exist in the document — the component observes them by id and
 *  reads their CURRENT position when it decides, rather than trusting the
 *  position captured in an observer record (see the component: those are
 *  captured at different moments and comparing them marked the wrong section).
 *  So the test has to place them, which jsdom will not do on its own. */
function mount(entries = ENTRIES, tops: Record<string, number> = {}) {
  for (const e of entries) {
    const el = document.createElement("section");
    el.id = e.id;
    el.getBoundingClientRect = () =>
      ({ top: tops[e.id] ?? 0, height: 100, bottom: (tops[e.id] ?? 0) + 100 }) as DOMRect;
    document.body.appendChild(el);
  }
  return render(<LegalContents entries={entries} label="Contents" />);
}

/** An observer record. Only the id and the flag matter now. */
const rec = (id: string, isIntersecting = true) => ({ target: { id }, isIntersecting });

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
      io.cb!([rec("who")]);
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
    // "who" is on its way out (top above the band), "contact" has just
    // arrived. Deliberately reported in the order that would trip a
    // first-wins rule.
    const { container } = mount(ENTRIES, { who: -40, contact: 90 });
    act(() => {
      io.cb!([rec("who"), rec("contact")]);
    });
    expect(marked(container)).toBe("#contact");
  });

  it("holds its place when nothing is in the band", () => {
    // Which happens constantly — mid-paragraph, between two sections. Clearing
    // the marker there is the difference between a marker and a flicker.
    const io = stubObserver();
    const { container } = mount();
    act(() => {
      io.cb!([rec("who")]);
    });
    act(() => {
      io.cb!([rec("who", false)]);
    });
    expect(marked(container)).toBe("#who");
  });

  it("reaches the last section at the bottom of the page", () => {
    // "Other terms" and "Contact" are short enough that they may never cross
    // the band, which would strand the marker three entries above the reader.
    const io = stubObserver();
    const { container } = mount();
    act(() => {
      io.cb!([rec("agreement")]);
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
      io.cb!([rec("who")]);
    });
    expect(container.querySelector("a[aria-current]")!.getAttribute("aria-current")).toBe(
      "location",
    );
  });

  it("marks exactly one entry", () => {
    const io = stubObserver();
    const { container } = mount(ENTRIES, { who: 30, contact: 90 });
    act(() => {
      io.cb!([rec("who"), rec("contact")]);
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

describe("positions are read at decision time, not taken from the record", () => {
  it("ignores where a section WAS when its record was made", () => {
    // THE BUG THIS EXISTS FOR. An observer record carries the rect from the
    // moment it was created, and records for two sections routinely arrive in
    // different callbacks during one scroll. Comparing those captured tops
    // meant a stale position could beat a current one, and the marker sat one
    // section behind the reader the whole way down a document.
    //
    // Here "who" is reported first, while it is still low on the screen, and
    // has since moved above the band. A rule trusting the record would keep
    // it; reading the element says "contact".
    const io = stubObserver();
    const { container } = mount(ENTRIES, { who: 300, contact: 120 });
    act(() => {
      io.cb!([rec("who")]);
    });
    expect(marked(container)).toBe("#who");

    // The page scrolls; "who" is now above the band, "contact" is in it. Only
    // "contact" produces a new record.
    const el = document.getElementById("who")!;
    el.getBoundingClientRect = () => ({ top: -200, height: 100, bottom: -100 }) as DOMRect;
    act(() => {
      io.cb!([rec("contact")]);
    });
    expect(marked(container)).toBe("#contact");
  });
});
