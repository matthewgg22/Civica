// /verify is a directory: every state, in an order a person can scan.
//
// The page it replaced rendered the same 53 packs as cards in SHIP order —
// California, Washington, Texas, New York… — which is a fact about our roadmap
// and useless to someone looking for Ohio. There was no way to scan for a
// state and no guarantee a newly merged pack appeared anywhere findable.
//
// Alphabetical order is therefore the load-bearing property here, not a
// styling preference, and it is derived (not a hand-kept list) so a pack
// merged tomorrow lands in the right place without anyone remembering to
// re-sort. These tests assert on rendered markup so they fail if the sort is
// dropped, if a state stops rendering, or if a row loses the agency or the
// application link that are the reason to visit at all.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { VERIFIED_STATES } from "@civica/demeter-engine/packs";
import { stateName } from "../lib/state-names";
import { hasLocalProgramName, primaryAgency, programDisplayName, splitPortalName } from "../lib/program-name";
import StatesPage from "../app/states/page";
import { PAGE_COPY as T } from "../lib/i18n/snap-page";

const html = renderToStaticMarkup(<StatesPage />);

/** The codes as the page actually prints them, in document order. */
const renderedCodes = [...html.matchAll(/class="vrow__code">\((\w+)\)</g)].map((m) => m[1]);

const expectedCodes = [...VERIFIED_STATES]
  .sort((a, b) => stateName(a.code).localeCompare(stateName(b.code), "en"))
  .map((s) => s.code);

describe("every jurisdiction appears, exactly once", () => {
  it("renders one row per verified pack", () => {
    expect(renderedCodes).toHaveLength(VERIFIED_STATES.length);
    expect(new Set(renderedCodes).size).toBe(VERIFIED_STATES.length);
  });

  it("leaves nobody out", () => {
    for (const s of VERIFIED_STATES) {
      expect(renderedCodes, `${s.code} is missing from the list`).toContain(s.code);
    }
  });
});

describe("the order is alphabetical by state NAME", () => {
  it("matches a fresh sort of the packs", () => {
    // Name, not code: someone scanning for "Washington" is not looking under
    // W-A, and DC sorts under D for "District of Columbia" rather than under
    // its code. Comparing against a sort computed here rather than a frozen
    // list means a new pack is covered the day it merges.
    expect(renderedCodes).toEqual(expectedCodes);
  });

  it("is not merely the pack file's own order", () => {
    // Guards the case where someone alphabetizes packs.ts and quietly drops
    // the sort here — it would pass the test above and silently regress the
    // next time a pack is appended.
    const shipOrder = VERIFIED_STATES.map((s) => s.code);
    expect(shipOrder).not.toEqual(expectedCodes);
  });

  it("groups under initials that are themselves in order", () => {
    const letters = [...html.matchAll(/class="vstates__letter"[^>]*>(\w)</g)].map((m) => m[1]);
    expect(letters.length).toBeGreaterThan(1);
    expect(letters).toEqual([...letters].sort());
    expect(new Set(letters).size).toBe(letters.length);
  });
});

describe("a row carries the three things somebody came for", () => {
  it("names the agency that runs the program", () => {
    for (const s of VERIFIED_STATES) {
      // Escaped by React on the way out, so compare against the escaped form.
      const agency = primaryAgency(s.agency).replace(/&/g, "&amp;").replace(/'/g, "&#x27;");
      expect(html, `${s.code} has no agency`).toContain(agency);
    }
  });

  it("links to the agency's own application where one exists", () => {
    for (const s of VERIFIED_STATES) {
      if (!s.portal) continue;
      expect(html, `${s.code} has no portal link`).toContain(s.portal.url);
    }
  });

  it("links into the chat scoped to that state", () => {
    for (const s of VERIFIED_STATES) {
      expect(html, `${s.code} has no way into the chat`).toContain(`/chat?state=${s.code}`);
    }
  });

  it("distinguishes 53 identical 'Ask' links for a screen reader", () => {
    // The visible label is one word on purpose. That only works because the
    // accessible name carries the state — without it this is 53 links all
    // announcing "Ask".
    for (const s of VERIFIED_STATES) {
      expect(html).toContain(`aria-label="Ask Demeter about ${stateName(s.code)}"`);
    }
  });

  it("shows a flag beside the name", () => {
    // next/image rewrites the src to /_next/image?url=%2Fflags%2Fal.png, so
    // the path is percent-encoded in the markup, not literal.
    const flags = [...html.matchAll(/%2Fflags%2F(\w+)\.png/g)].map((m) => m[1].toUpperCase());
    for (const s of VERIFIED_STATES) {
      expect(flags, `${s.code} has no flag`).toContain(s.code);
    }
  });
});

describe("the page is only the states and the way into the chat", () => {
  it("prints no verification machinery", () => {
    for (const needle of ["Corrections forced", "Last verified", "primary sources", "CERTAIN"]) {
      expect(html, `"${needle}" is back on the page`).not.toContain(needle);
    }
  });

  it("keeps exactly one in-content call to action", () => {
    // The palette allows one wheat next action per page. 53 rows of filled
    // buttons is the card grid again in another shape.
    expect([...html.matchAll(/vstates__askcta/g)]).toHaveLength(1);
  });
});

describe("a row prints only what varies", () => {
  it("names the program only where the state calls it something else", () => {
    // 44 of 53 packs say "SNAP". Printing that on every row put the page's own
    // subject 44 times down a column and buried the nine names that actually
    // distinguish a state.
    const shown = [...html.matchAll(/class="vrow__program">([^<]*)</g)].map((m) => m[1]);
    const expected = VERIFIED_STATES.filter((s) => hasLocalProgramName(s.program)).map((s) =>
      programDisplayName(s.program),
    );
    expect(shown.sort()).toEqual(expected.sort());
    expect(shown).toContain("CalFresh");
    expect(shown).toContain("3SquaresVT");
    expect(shown.length).toBeLessThan(VERIFIED_STATES.length / 2);
  });

  it("never leaves a bare 'SNAP' as a program line", () => {
    const shown = [...html.matchAll(/class="vrow__program">([^<]*)</g)].map((m) => m[1].trim());
    expect(shown).not.toContain("SNAP");
    expect(shown).not.toContain("Supplemental Nutrition Assistance Program (SNAP)");
  });

  it("says county-administered exactly where the pack says so", () => {
    // The agency string is cut back to the department, which drops clauses
    // like "administered locally by the 100 County Departments of Social
    // Services". That is not a detail to lose silently — in these states the
    // county is who you deal with — so it comes back from adminModel.
    const tags = [...html.matchAll(/class="vrow__admin">([^<]*)</g)];
    const expected = VERIFIED_STATES.filter((s) => s.adminModel === "county");
    expect(tags).toHaveLength(expected.length);
    expect(expected.length).toBeGreaterThan(0);
  });

  it("keeps every portal annotation it lifts out of a link label", () => {
    for (const s of VERIFIED_STATES) {
      if (!s.portal) continue;
      const { note } = splitPortalName(s.portal.name);
      if (!note) continue;
      const escaped = note.replace(/&/g, "&amp;").replace(/'/g, "&#x27;");
      expect(html, `${s.code} dropped "${note}"`).toContain(escaped);
    }
  });

  it("still warns where there is no online application at all", () => {
    // The single case where the note is the whole message.
    expect(html).toMatch(/paper application only/);
  });
});

describe("the search box replaces the letter jump", () => {
  it("ships a search input, server-rendered", () => {
    // The A–Z row answered "where does W start" and cost three lines of phone
    // screen before a single state appeared. Typing answers that question and
    // two better ones — "who runs this in Ohio", "which state is BenefitsCal".
    expect(html).toContain('type="search"');
    expect(html).toContain(T.en.directory.searchPlaceholder);
    expect(html).not.toContain("vjump__letter");
  });

  it("still renders all 53 rows without JavaScript", () => {
    // The list is a client component for the filtering only. If hydration
    // never happens — a crawler, a slow phone, JS disabled — the whole
    // directory must still be there.
    expect(renderedCodes).toHaveLength(VERIFIED_STATES.length);
  });

  it("keeps the alphabetical group headings the jump bar used to target", () => {
    const headings = [...html.matchAll(/class="vstates__letter" id="letter-(\w)"/g)].map((m) => m[1]);
    expect(headings.length).toBeGreaterThan(1);
    expect(headings).toEqual([...headings].sort());
  });
});

describe("the page carries no site nav, only a way back", () => {
  it("has no DemeterNav on either route", () => {
    // Owner's call, the same one made for /chat (2026-08-22). Asserted at the
    // SOURCE, not the markup: a hidden nav is still a nav, and the point is
    // that the brand, the two tabs and the four language links are not on a
    // page whose entire job is one list.
    for (const page of ["../components/StateDirectoryPage.tsx", "../app/states/page.tsx"]) {
      const src = readFileSync(new URL(page, import.meta.url), "utf8");
      expect(src, page).not.toMatch(/DemeterNav/);
    }
    expect(html).not.toContain("dmnav");
  });

  it("the back link is the FIRST focusable thing on the page", () => {
    // Which is what makes a skip link unnecessary here: there is nothing to
    // skip. If chrome is ever added above it, the skip link has to come back.
    const firstLink = html.indexOf("<a ");
    const backLink = html.indexOf('class="vback"');
    expect(backLink).toBeGreaterThan(-1);
    expect(backLink).toBeLessThan(firstLink === -1 ? Infinity : firstLink + 200);
    expect(html.slice(0, backLink)).not.toContain("<button");
  });

  it("points at the chat, and keeps the reader's language", () => {
    expect(html).toContain('class="vback" href="/chat"');
    expect(html).toContain(T.en.directory.back);
  });

  it("main still carries the skip target other surfaces link to", () => {
    expect(html).toContain('id="main-content"');
  });
});