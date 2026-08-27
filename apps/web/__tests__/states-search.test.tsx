// @vitest-environment jsdom
//
// The search box that replaced the A–Z jump row.
//
// The jump row worked, but it only answered "where does W start" — and it cost
// three lines of phone screen before a single state appeared. These tests pin
// the three questions typing answers instead, and the two ways a filter goes
// wrong quietly: matching nothing and saying nothing, or filtering the list
// without telling anyone who is not watching it.
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { StateDirectory } from "../components/StateDirectory";
import { directoryRows } from "../components/StateDirectoryPage";
import { PAGE_COPY } from "../lib/i18n/snap-page";

const COPY = PAGE_COPY.en.directory;
const ROWS = directoryRows();

/** The same substitution the component does. Kept here rather than exported so
 *  the test asserts the RENDERED text, not a shared implementation. */
const fill = (t: string, v: Record<string, string | number>) =>
  t.replace(/\{(\w+)\}/g, (whole, k) => (k in v ? String(v[k]) : whole));
const countedAll = () => fill(COPY.countedAll, { total: ROWS.length });
const countedSome = (shown: number) =>
  fill(COPY.countedSome, { shown, total: ROWS.length });

function renderDirectory() {
  return render(<StateDirectory rows={ROWS} copy={COPY} chatHref="/chat" />);
}

const box = () => screen.getByRole("searchbox", { name: COPY.searchLabel });
const type = (value: string) => fireEvent.change(box(), { target: { value } });
const rowCount = () => document.querySelectorAll(".vrow").length;
/** The state names actually on screen. Queried by class rather than by text:
 *  "Ohio" also appears in that row's agency and in its Ask link's accessible
 *  name, so a text query matches three nodes and proves nothing about which
 *  rows survived the filter. */
const shownNames = () =>
  [...document.querySelectorAll(".vrow__name")].map((n) => n.textContent ?? "");
const showsOnly = (name: string) => {
  const names = shownNames();
  expect(names).toHaveLength(1);
  expect(names[0]).toContain(name);
};

afterEach(cleanup);

describe("what you can search by", () => {
  it("finds a state by name", () => {
    renderDirectory();
    type("ohio");
    showsOnly("Ohio");
  });

  it("finds a state by its two-letter code", () => {
    renderDirectory();
    type("wy");
    showsOnly("Wyoming");
  });

  it("finds a state by the agency on the letter you were sent", () => {
    // Someone holding a notice from "the Department of Transitional
    // Assistance" may not connect it to Massachusetts. That is the case the
    // jump row could not help with at all.
    renderDirectory();
    type("transitional assistance");
    showsOnly("Massachusetts");
  });

  it("finds a state by the portal it is branded as", () => {
    renderDirectory();
    type("benefitscal");
    showsOnly("California");
  });

  it("finds a state by the local name for SNAP", () => {
    renderDirectory();
    type("3squares");
    showsOnly("Vermont");
  });

  it("ignores case and surrounding whitespace", () => {
    renderDirectory();
    type("   OrEgOn  ");
    expect(rowCount()).toBe(1);
  });
});

describe("the filter says what it did", () => {
  it("starts with every row and a total", () => {
    renderDirectory();
    expect(rowCount()).toBe(ROWS.length);
    expect(screen.getByRole("status").textContent).toBe(countedAll());
  });

  it("announces the narrowed count, rather than silently removing rows", () => {
    // A filter is invisible to anyone not watching the list. role=status makes
    // it an announcement.
    renderDirectory();
    type("new");
    const shown = rowCount();
    expect(shown).toBeGreaterThan(1);
    expect(shown).toBeLessThan(ROWS.length);
    expect(screen.getByRole("status").textContent).toBe(countedSome(shown));
  });

  it("offers the chat when nothing matches, instead of an empty page", () => {
    renderDirectory();
    type("Ontario");
    expect(rowCount()).toBe(0);
    expect(screen.getByText(fill(COPY.noMatch, { query: "Ontario" }))).toBeTruthy();
    expect(screen.getByRole("link", { name: new RegExp(COPY.noMatchAsk) })).toBeTruthy();
  });

  it("restores the full list when cleared", () => {
    renderDirectory();
    type("ohio");
    fireEvent.click(screen.getByRole("button", { name: COPY.clear }));
    expect(rowCount()).toBe(ROWS.length);
    expect(box()).toHaveProperty("value", "");
  });

  it("offers no clear button until there is something to clear", () => {
    renderDirectory();
    expect(screen.queryByRole("button", { name: COPY.clear })).toBeNull();
  });
});

describe("the box does not take the page over", () => {
  it("never autofocuses", () => {
    // On a phone that opens the keyboard over the list the reader came to
    // look at, and it steals the page from a screen reader before it has
    // announced what the page is.
    const { container } = renderDirectory();
    expect(container.querySelector("input[autofocus]")).toBeNull();
    expect(document.activeElement).toBe(document.body);
  });
});

describe("everything handed to the client component is serializable", () => {
  // THE BUILD CAUGHT THIS, NOT THE TESTS. The copy object originally carried
  // four formatter functions, which typechecks, unit-tests green, and then
  // fails at prerender with "Functions cannot be passed directly to Client
  // Components" — because a test rendering the component directly never
  // crosses the server/client boundary that rejects them. This asserts the
  // property that boundary requires, in a place a test CAN see it.
  const isSerializable = (v: unknown): boolean =>
    v === null ||
    ["string", "number", "boolean", "undefined"].includes(typeof v) ||
    (Array.isArray(v) && v.every(isSerializable)) ||
    (typeof v === "object" && Object.values(v as object).every(isSerializable));

  it("the copy object carries no functions", () => {
    for (const [key, value] of Object.entries(COPY)) {
      // askAbout/applyIn stay functions in PAGE_COPY and are resolved per row
      // on the server, so they never reach the client and are exempt here.
      if (key === "askAbout" || key === "applyIn") continue;
      expect(typeof value, `directory copy "${key}" is a ${typeof value}`).toBe("string");
    }
  });

  it("every row is plain data", () => {
    for (const row of ROWS) {
      expect(isSerializable(row), `${row.code} carries something unserializable`).toBe(true);
    }
  });

  it("rows carry their resolved accessible names, not formatters", () => {
    for (const row of ROWS) {
      expect(row.askLabel).toContain(row.name);
      if (row.portal) expect(row.portal.applyLabel).toContain(row.name);
    }
  });
});

describe("the field is labelled, not just placeheld", () => {
  it("has a real <label> wired to the input", () => {
    // ux-guidelines, Forms / Input Labels (High): a placeholder is not a
    // label. It disappears on the first keystroke, taking the only statement
    // of what the control does with it — on the one field somebody comes back
    // to after being interrupted.
    const { container } = renderDirectory();
    const label = container.querySelector("label");
    const input = box();
    expect(label).toBeTruthy();
    expect(label!.textContent).toBe(COPY.searchLabel);
    expect(label!.getAttribute("for")).toBe(input.getAttribute("id"));
    expect(input.getAttribute("id")).toBeTruthy();
  });

  it("does not double up an aria-label over the visible one", () => {
    // Two accessible names for one control is how they drift apart.
    renderDirectory();
    expect(box().getAttribute("aria-label")).toBeNull();
  });

  it("keeps the placeholder for the EXAMPLE, not the label", () => {
    renderDirectory();
    const input = box();
    expect(input.getAttribute("placeholder")).toBe(COPY.searchPlaceholder);
    expect(input.getAttribute("placeholder")).not.toBe(COPY.searchLabel);
  });
});
