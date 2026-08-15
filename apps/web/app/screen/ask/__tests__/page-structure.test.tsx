// @vitest-environment jsdom
//
// The entry page's SHAPE, which is the thing this restructure changed and the
// thing nothing was checking.
//
// Before: the page opened with an <h2> about SNAP and named the product only
// inside the chat card's own <h1>, ~15% down the page. An <h2> preceding the
// <h1> in document order is an inverted heading hierarchy — it misleads screen
// reader users navigating by heading, and it told search engines the page was a
// SNAP explainer that happened to contain a chatbot. ~1,300 words of static copy
// wrapped one chat box.
//
// After: a ~45-word orientation bar carries the only <h1>, the chat follows
// immediately, and the 17 form-question cards plus "why this is hard" moved to
// /questions. MOVED, not cut — so the tests that matter most here are the ones
// proving the words are still reachable and still indexed, not just gone.
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { FORM_QUESTIONS } from "@civica/demeter-engine";
import { ANSWER_LANGS, VERIFIED_STATES } from "@civica/demeter-engine/packs";

import {
  SnapOrientation,
  SnapDetail,
  SnapFormQuestions,
  SnapWhyHard,
  SnapTimeline,
  SnapFoodNow,
  SnapFears,
  SnapAskCta,
  questionsHref,
  askHref,
} from "../../../../components/SnapOverview";
import { PAGE_COPY } from "../../../../lib/i18n/snap-page";
import { askStructuredData, questionsStructuredData } from "../structured-data";
import { alternateLanguages, questionsUrl, askUrl } from "../../../../lib/i18n/routes";

afterEach(cleanup);

describe("orientation bar — the page names the product before it explains SNAP", () => {
  it("carries the page's h1, and it is about Demeter, not about SNAP", () => {
    render(<SnapOrientation />);
    const h1s = screen.getAllByRole("heading", { level: 1 });
    expect(h1s).toHaveLength(1);
    expect(h1s[0].textContent).toBe(PAGE_COPY.en.h1);
  });

  it("says what Demeter is BEFORE what SNAP is", () => {
    const { container } = render(<SnapOrientation />);
    const text = container.textContent ?? "";
    const product = text.indexOf(PAGE_COPY.en.productLede);
    const snap = text.indexOf(PAGE_COPY.en.snapLine);
    expect(product).toBeGreaterThan(-1);
    expect(snap).toBeGreaterThan(-1);
    // The order IS the decision. Category research: the products that own their
    // tool (mRelief, Consensus) lead with it; GetCalFresh leads with
    // comprehension because it gave its application away to BenefitsCal.
    expect(product).toBeLessThan(snap);
  });

  it("stays short enough that the chat clears the fold", () => {
    // ~45 words was the budget. A generous ceiling — this guards against the
    // bar quietly growing back into the 120-word lede it replaced.
    for (const lang of ANSWER_LANGS) {
      const c = PAGE_COPY[lang];
      const words = `${c.h1} ${c.productLede} ${c.snapLine}`.split(/\s+/).filter(Boolean).length;
      // CJK does not word-separate on spaces, so count characters there.
      const budget = lang === "zh" ? 200 : 70;
      const size = lang === "zh" ? `${c.h1}${c.productLede}${c.snapLine}`.length : words;
      expect(size, `${lang} orientation bar`).toBeLessThanOrEqual(budget);
    }
  });

  it("every locale has all three orientation strings", () => {
    for (const lang of ANSWER_LANGS) {
      const c = PAGE_COPY[lang];
      for (const key of ["h1", "productLede", "snapLine"] as const) {
        expect(c[key]?.trim(), `${lang}.${key}`).toBeTruthy();
      }
    }
  });
});

describe("the states-verified count — DC/Guam/USVI are not states", () => {
  // THE BUG THIS PINS: VERIFIED_STATES is 53 entries (50 states + DC + Guam +
  // the U.S. Virgin Islands), and both places that count it used to print
  // "{53} States verified" — an accurate number attached to the wrong word.
  // Nobody would call DC a state; the count just silently included it anyway.
  const NON_STATE_CODES = new Set(["DC", "GU", "VI"]);
  const actualStateCount = VERIFIED_STATES.filter((s) => !NON_STATE_CODES.has(s.code)).length;
  const otherCount = VERIFIED_STATES.length - actualStateCount;

  it("VERIFIED_STATES actually contains DC, GU, and VI (guards the test itself)", () => {
    // If a future corpus change ever drops these, the count-based assertions
    // below would pass vacuously — this pins the premise, not just the fix.
    for (const code of NON_STATE_CODES) {
      expect(VERIFIED_STATES.some((s) => s.code === code), code).toBe(true);
    }
    expect(otherCount).toBe(3);
  });

  it("the hero badge counts actual states only, and names DC/territories separately", () => {
    render(<SnapOrientation states={VERIFIED_STATES} />);
    expect(screen.getByText(`${actualStateCount} States verified`)).toBeTruthy();
    // The old, wrong count must not appear anywhere on the page.
    expect(screen.queryByText(`${VERIFIED_STATES.length} States verified`)).toBeNull();
    expect(screen.getByText(PAGE_COPY.en.statesAlsoVerified)).toBeTruthy();
  });

  it("the trust list counts actual states only, in every language", () => {
    for (const lang of ANSWER_LANGS) {
      const c = PAGE_COPY[lang];
      const { container, unmount } = render(<SnapDetail states={VERIFIED_STATES} lang={lang} />);
      const text = container.textContent ?? "";
      expect(text, lang).toContain(`${actualStateCount} ${c.trust[2]?.t}`);
      expect(text, lang).not.toContain(`${VERIFIED_STATES.length} ${c.trust[2]?.t}`);
      expect(text, lang).toContain(c.statesAlsoVerified);
      unmount();
    }
  });
});

describe("the chat page's depth — trimmed, and nothing orphaned", () => {
  it("no longer renders the 17 form-question cards", () => {
    render(<SnapDetail states={VERIFIED_STATES} />);
    // The phrase a card ACTUALLY renders. formQuestionHeading picks the LONGEST
    // phrasing, so household_composition prints "buy and fix food together",
    // never "purchase and prepare" — an assertion on the latter passes whether
    // the cards are here or not, which is worse than no assertion. (The e2e
    // suite caught this by failing on a real page; the first draft of this test
    // was vacuous.)
    expect(screen.queryByText(/buy and fix food together/i)).toBeNull();
    expect(screen.queryByText(PAGE_COPY.en.faqBody)).toBeNull();
  });

  it("and the phrase that proves it is one a card really prints", () => {
    // Guards the assertion above against becoming vacuous again if the
    // phrasings list is reordered.
    render(<SnapFormQuestions />);
    expect(screen.getByText(/buy and fix food together/i)).toBeTruthy();
  });

  it("still renders the trust claims — they moved down, they were not deleted", () => {
    render(<SnapDetail states={VERIFIED_STATES} />);
    for (const row of PAGE_COPY.en.trust) {
      expect(screen.getByText(row.d.slice(0, 40), { exact: false }), row.t).toBeTruthy();
    }
  });

  it("no two sections share a heading", () => {
    // Caught a real one: the relocated trust rows borrowed `howH2` for what had
    // been an <aside>'s aria-label, so once they became a real section the page
    // printed "How Demeter answers" TWICE. Duplicate <h2>s make the document
    // outline useless for heading navigation and give a search engine two
    // sections it cannot tell apart — and nothing about the rendered page looks
    // wrong, which is why this needs a test rather than an eye.
    const { container } = render(<SnapDetail states={VERIFIED_STATES} lang="en" />);
    const headings = [...container.querySelectorAll("h2, h3")].map((h) =>
      (h.textContent ?? "").trim(),
    );
    expect(new Set(headings).size, headings.join(" | ")).toBe(headings.length);
  });

  it("no two sections share a heading, in any language", () => {
    for (const lang of ANSWER_LANGS) {
      const { container, unmount } = render(<SnapDetail states={VERIFIED_STATES} lang={lang} />);
      const headings = [...container.querySelectorAll("h2, h3")].map((h) =>
        (h.textContent ?? "").trim(),
      );
      expect(new Set(headings).size, `${lang}: ${headings.join(" | ")}`).toBe(headings.length);
      unmount();
    }
  });

  it("links to /questions, so the moved content is reachable by a crawler", () => {
    // Moved content with no inbound link is deleted content as far as
    // discovery is concerned. This is the whole reason the move is safe.
    render(<SnapDetail states={VERIFIED_STATES} />);
    const link = screen.getByRole("link", { name: new RegExp(PAGE_COPY.en.questionsLink, "i") });
    expect(link.getAttribute("href")).toBe("/questions");
  });

  it("keeps each language's link inside that language", () => {
    expect(questionsHref("en")).toBe("/questions");
    expect(questionsHref("es")).toBe("/es/questions");
    expect(askHref("vi")).toBe("/vi/screen/ask");
  });
});

describe("/questions — the moved content, intact", () => {
  it("renders every form question", () => {
    render(<SnapFormQuestions />);
    expect(screen.getAllByRole("definition")).toHaveLength(FORM_QUESTIONS.length);
  });

  it("renders the 'why this is hard' cards that introduce them", () => {
    render(<SnapWhyHard />);
    for (const card of PAGE_COPY.en.cards) {
      expect(screen.getByText(card.t)).toBeTruthy();
    }
  });

  it("renders in every language the engine answers in", () => {
    for (const lang of ANSWER_LANGS) {
      const { unmount } = render(<SnapFormQuestions lang={lang} />);
      expect(screen.getAllByRole("definition"), lang).toHaveLength(FORM_QUESTIONS.length);
      unmount();
    }
  });
});

describe("structured data follows the content — no cloaking", () => {
  const parse = (json: string) => JSON.parse(json) as Record<string, unknown>[];

  it("the ask page no longer claims the form questions it stopped rendering", () => {
    const blocks = parse(askStructuredData("en", "Demeter AI", "desc"));
    const faq = blocks.find((b) => b["@type"] === "FAQPage");
    const names = ((faq?.mainEntity as { name: string }[]) ?? []).map((q) => q.name);
    expect(names.some((n) => /purchase and prepare/i.test(n))).toBe(false);
    // The general FAQ is hand-written and stays.
    expect(names).toContain("What is SNAP?");
  });

  it("emits no empty FAQPage on localized ask pages", () => {
    // The general FAQ is English-only by design, so after the move a localized
    // ask page has nothing to put in one. An empty FAQPage is invalid markup.
    for (const lang of ANSWER_LANGS.filter((l) => l !== "en")) {
      const blocks = parse(askStructuredData(lang, "Demeter AI", "desc"));
      expect(blocks.some((b) => b["@type"] === "FAQPage"), lang).toBe(false);
      expect(blocks.some((b) => b["@type"] === "WebApplication"), lang).toBe(true);
    }
  });

  it("/questions carries the form-question FAQPage, in every language", () => {
    for (const lang of ANSWER_LANGS) {
      const blocks = parse(questionsStructuredData(lang));
      const faq = blocks.find((b) => b["@type"] === "FAQPage");
      expect(faq, lang).toBeTruthy();
      expect((faq!.mainEntity as unknown[]).length, lang).toBe(FORM_QUESTIONS.length);
    }
  });

  it("every /questions answer still carries its citation", () => {
    const faq = parse(questionsStructuredData("en"))[0];
    for (const entry of faq.mainEntity as { acceptedAnswer: { text: string } }[]) {
      expect(entry.acceptedAnswer.text).toMatch(/7 CFR \d+/);
    }
  });
});

describe("hreflang — each page family annotates its own set", () => {
  it("/questions alternates point at /questions, not at the ask page", () => {
    // Annotating /es/questions as a translation of /screen/ask would tell a
    // search engine two different pages are the same page.
    const alts = alternateLanguages(questionsUrl);
    for (const url of Object.values(alts)) {
      expect(url.endsWith("/questions")).toBe(true);
    }
    expect(alts["x-default"]).toBe(questionsUrl("en"));
  });

  it("the ask page's set is unchanged by the new signature's default", () => {
    const alts = alternateLanguages();
    expect(alts["x-default"]).toBe(askUrl("en"));
    for (const url of Object.values(alts)) {
      expect(url.endsWith("/screen/ask")).toBe(true);
    }
  });
});

describe("the application timeline", () => {
  it("runs in chronological order, four steps, expedited folded into the interview", () => {
    // Was six steps, then five: the 7-day expedited route and the ordinary
    // interview were two columns on the same beat (timing before the
    // decision), and the interview column alone ran to 45 words in a
    // 1/5-width slot. Folded into one interview step that carries both facts,
    // so this now asserts the MERGED step contains the urgent-case fact and
    // still lands before the 30-day decision — not a literal "By day 7"
    // label, which no longer exists on its own and would make this pass
    // vacuously (indexOf returning -1 is "less than" any real index).
    const { container } = render(<SnapTimeline />);
    const whens = [...container.querySelectorAll(".dmtl__when")].map((n) => n.textContent);
    expect(whens).toEqual(PAGE_COPY.en.timeline.map((s) => s.when));
    expect(whens).toHaveLength(4);
    const text = container.textContent ?? "";
    expect(text).toContain("Day 0");
    expect(text.indexOf("interview")).toBeGreaterThan(-1);
    expect(text.indexOf("within 7 days")).toBeLessThan(text.indexOf("By day 30"));
    // Both facts survive the merge: the ordinary no-deadline case, and the
    // urgent 7-day one it used to take a whole second column to say.
    expect(text).toMatch(/no deadline/i);
    expect(text).toMatch(/7 days/);
  });

  it("is an ordered list, because it is a sequence", () => {
    const { container } = render(<SnapTimeline />);
    expect(container.querySelector("ol.dmtl")).not.toBeNull();
    expect(container.querySelectorAll("ol.dmtl > li")).toHaveLength(
      PAGE_COPY.en.timeline.length,
    );
  });

  it("is ONE continuous track with a dot per step, not one border per column", () => {
    // The original marker was a `border-top` on each <li>, which the grid's
    // own gaps broke into as many disconnected shelves as there were steps —
    // the opposite of a timeline. There is exactly one track element now,
    // shared across the whole row, plus one dot per step sitting on it.
    const { container } = render(<SnapTimeline />);
    expect(container.querySelectorAll(".dmtl__track")).toHaveLength(1);
    expect(container.querySelectorAll(".dmtl__dot")).toHaveLength(PAGE_COPY.en.timeline.length);
  });

  it("states no dollar figures, in any language", () => {
    // House rule, and the accurate call: these move every October, and the
    // rent-and-utilities test depends on figures that vary by state.
    for (const lang of ANSWER_LANGS) {
      const { container } = render(<SnapTimeline lang={lang} />);
      expect(container.textContent, `${lang} states a dollar figure`).not.toMatch(/[$￥€]\s?\d/);
      cleanup();
    }
  });

  it("cites the regulation the deadlines come from", () => {
    // Stating a deadline outright is only defensible because it is federal.
    for (const lang of ANSWER_LANGS) {
      const { container } = render(<SnapTimeline lang={lang} />);
      expect(container.textContent, `${lang}`).toContain("7 CFR 273.2");
      cleanup();
    }
  });
});

describe("the landing hands over to the chat rather than starting one", () => {
  it("links to /chat and carries any chosen state with it", () => {
    const { container } = render(<SnapAskCta state="CA" />);
    const a = container.querySelector("a")!;
    expect(a.getAttribute("href")).toBe("/chat?state=CA");
  });

  it("links to the localized chat for a localized page", () => {
    const { container } = render(<SnapAskCta lang="es" />);
    expect(container.querySelector("a")!.getAttribute("href")).toBe("/es/chat");
  });
});

describe("what SNAP is — the program, before the rules that decide who gets it", () => {
  it("explains SNAP BEFORE explaining what decides eligibility", () => {
    // The page went trust → eligibility, describing the qualifying rules for a
    // program it had never actually defined. Order is the whole point of this
    // section, so order is the thing worth pinning.
    const { container } = render(<SnapDetail states={VERIFIED_STATES} />);
    const text = container.textContent ?? "";
    const isSnap = text.indexOf(PAGE_COPY.en.snapH2);
    const decides = text.indexOf(PAGE_COPY.en.decidesH2);
    expect(isSnap).toBeGreaterThan(-1);
    expect(decides).toBeGreaterThan(-1);
    expect(isSnap).toBeLessThan(decides);
  });

  it("disclaims affiliation wherever it points at USDA, in every language", () => {
    // Linking the federal program without this is how a worried applicant ends
    // up reading a private site as an official one.
    for (const lang of ANSWER_LANGS) {
      const { container } = render(<SnapDetail states={VERIFIED_STATES} lang={lang} />);
      expect(
        container.querySelector('a[href="https://www.fns.usda.gov/snap"]'),
        `${lang} lost the USDA link`,
      ).not.toBeNull();
      expect(container.textContent, `${lang} lost the non-affiliation line`).toContain(
        PAGE_COPY[lang].officialNote,
      );
      cleanup();
    }
  });

  it("carries the SNAP service-mark notice verbatim, in every language", () => {
    // FNS requires this exact sentence on any material where an organisation
    // outside USDA uses the mark. It is a condition of being allowed to show
    // the logo at all, so it is asserted character-for-character — including
    // the spacing in "U. S." — and on every language of the page, since a
    // notice that only appears in English is missing from three of them.
    const REQUIRED =
      "The SNAP logo is a service mark of the U. S. Department of Agriculture. " +
      "USDA does not endorse any goods, services, or enterprises.";
    for (const lang of ANSWER_LANGS) {
      const { container } = render(<SnapDetail states={VERIFIED_STATES} lang={lang} />);
      expect(container.textContent, `${lang} is missing the required notice`).toContain(
        REQUIRED,
      );
      // The notice is meaningless if the logo it governs is not the one shown.
      const logo = container.querySelector('img[src*="snap-logo"]');
      expect(logo, `${lang} lost the SNAP logo`).not.toBeNull();
      cleanup();
    }
  });

  it("opens official links in a new tab without handing over the opener", () => {
    const { container } = render(<SnapDetail states={VERIFIED_STATES} />);
    for (const a of container.querySelectorAll<HTMLAnchorElement>('a[target="_blank"]')) {
      expect(a.rel, a.href).toContain("noopener");
    }
  });
});

describe("the Beeck finding — the one claim on the page that is not ours", () => {
  it("attributes the quote and links the report it came from", () => {
    const { container } = render(<SnapDetail states={VERIFIED_STATES} />);
    const fig = container.querySelector("figure.dmx__quote");
    expect(fig).not.toBeNull();
    // A quote without its source is just a sentence we wrote.
    expect(fig!.querySelector("figcaption")?.textContent).toContain("Beeck Center");
    expect(fig!.querySelector("blockquote")?.getAttribute("cite")).toContain(
      "beeckcenter.georgetown.edu",
    );
    const links = [...container.querySelectorAll<HTMLAnchorElement>("a")].map((a) => a.href);
    expect(links.some((h) => h.includes("ai-powered-rules-as-code"))).toBe(true);
    expect(links.some((h) => h.includes("policy2code-demo-day"))).toBe(true);
  });

  it("makes the argument in every language, not just English", () => {
    for (const lang of ANSWER_LANGS) {
      const { container } = render(<SnapDetail states={VERIFIED_STATES} lang={lang} />);
      expect(container.textContent, `${lang}`).toContain(PAGE_COPY[lang].evidenceQuote);
      cleanup();
    }
  });
});

describe("food this week — the page's one obligation", () => {
  it("is not behind a click, and points somewhere that can help today", () => {
    // SNAP takes at least seven days even under expedited service. A page that
    // only explains SNAP hands someone who is out of food an accurate answer
    // and no dinner.
    for (const lang of ANSWER_LANGS) {
      const { container } = render(<SnapFoodNow lang={lang} />);
      expect(container.textContent, lang).toContain(PAGE_COPY[lang].foodNowBody);
      const hrefs = [...container.querySelectorAll("a")].map((a) => a.getAttribute("href") ?? "");
      expect(hrefs.some((h) => h.includes("feedingamerica.org")), `${lang} food bank`).toBe(true);
      expect(hrefs.some((h) => h.includes("211.org")), `${lang} 211`).toBe(true);
      // Inside a <details> it would be one click away from someone who needs it
      // most, which is the whole thing this section exists to avoid.
      expect(container.querySelector("details"), `${lang} hid it`).toBeNull();
      cleanup();
    }
  });
});

describe("the fears — the reasons eligible people never apply", () => {
  it("renders every answer in the HTML, open or closed", () => {
    // <details> keeps closed answers in the markup, which is what makes them
    // readable by a crawler and quotable by a generative engine.
    const { container } = render(<SnapFears />);
    for (const f of PAGE_COPY.en.fears) {
      expect(container.textContent, f.q).toContain(f.a);
    }
    expect(container.querySelectorAll("details")).toHaveLength(PAGE_COPY.en.fears.length);
  });

  it("does NOT give a flat answer on public charge, and names the date", () => {
    // DHS rescinded the 2022 rule effective 2026-09-18. "SNAP isn't counted"
    // is true today and wrong next month, and this is the highest-stakes
    // sentence in the product — see issue #759.
    const immigration = PAGE_COPY.en.fears[0];
    expect(immigration.q).toMatch(/immigration/i);
    expect(immigration.a).toContain("18 September 2026");
    expect(immigration.a).toMatch(/rescinded/i);
    // The reassuring phrasing on its own would be the defect.
    expect(immigration.a).not.toMatch(/^No[.,]/);
  });

  it("names the date in every language, so no locale keeps the old promise", () => {
    for (const lang of ANSWER_LANGS) {
      const a = PAGE_COPY[lang].fears[0]?.a ?? "";
      expect(a, `${lang} lost the effective date`).toMatch(/2026/);
      expect(a.length, `${lang} immigration answer is too short to be careful`).toBeGreaterThan(80);
    }
  });

  it("offers a way out to the chat for whatever is not listed", () => {
    const { container } = render(<SnapFears lang="es" />);
    const cta = container.querySelector("a.dmfear__cta");
    expect(cta?.getAttribute("href")).toBe("/es/chat");
  });
});
