// A screen reader announces content in the language named by the NEAREST
// ancestor `lang` attribute. The App Router owns the single <html>, fixed at
// lang="en", so each localized route must set `lang` on its own content root or
// a Spanish/Vietnamese/Chinese page is read aloud with English phonetics — for
// exactly the LEP readers these routes exist to serve.
//
// [lang]/chat and [lang]/screen/ask already did this; [lang]/questions and the
// state directory did not (launch audit 2026-08-28). These pin all the routes
// to the same contract so a future page can't silently drop it.
import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { StateDirectoryPage } from "../components/StateDirectoryPage";
import LocalizedQuestionsPage from "../app/[lang]/questions/page";
import ChatPage from "../app/chat/page";
import LocalizedChatPage from "../app/[lang]/chat/page";
import { LANG_TAG } from "@civica/demeter-engine/packs";

// The chat pages SSR the real DemeterChat; these two side inputs would reach
// for request-scoped / DB state, which a static render has no business doing.
vi.mock("../lib/geo-hint", () => ({ geoHint: async () => null }));
vi.mock("../lib/demeter-conversations-server", () => ({ loadConversation: async () => null }));

const PREFIXED = [
  ["es", "es"],
  ["vi", "vi"],
  ["zh", "zh-Hans"],
] as const;

/** Pull the lang attribute off the first <main> in a rendered HTML string. */
function mainLang(html: string): string | null {
  const m = html.match(/<main[^>]*\slang="([^"]+)"/);
  return m ? m[1]! : null;
}

describe("state directory carries the reader's language", () => {
  it.each(PREFIXED)("renders <main lang> for /%s/verify", (lang, tag) => {
    const html = renderToStaticMarkup(<StateDirectoryPage lang={lang} />);
    expect(mainLang(html)).toBe(tag);
    expect(tag).toBe(LANG_TAG[lang]);
  });

  it("the English directory is announced as English", () => {
    const html = renderToStaticMarkup(<StateDirectoryPage lang="en" />);
    expect(mainLang(html)).toBe("en");
  });
});

describe("localized questions page carries the reader's language", () => {
  it.each(PREFIXED)("renders <main lang> for /%s/questions", async (lang, tag) => {
    const el = await LocalizedQuestionsPage({ params: Promise.resolve({ lang }) });
    const html = renderToStaticMarkup(el);
    expect(mainLang(html)).toBe(tag);
  });
});

// The chat surfaces have no visible title bar by design, so a screen reader had
// no page heading to orient with. Each now carries one visually-hidden H1
// (launch audit 2026-08-28) — pinned here so the design decision can't quietly
// drop the heading a heading-navigation user depends on.
function firstH1(html: string): { cls: string | null; text: string } | null {
  const m = html.match(/<h1(?:\s+class="([^"]*)")?[^>]*>(.*?)<\/h1>/);
  return m ? { cls: m[1] ?? null, text: m[2]! } : null;
}

describe("chat pages expose exactly one visually-hidden H1", () => {
  it("English /chat", async () => {
    const el = await ChatPage({ searchParams: Promise.resolve({}) });
    const h1 = firstH1(renderToStaticMarkup(el));
    expect(h1?.cls).toBe("sr-only");
    expect(h1?.text).toBe("Ask Demeter about SNAP");
  });

  it.each(PREFIXED)("localized /%s/chat", async (lang) => {
    const el = await LocalizedChatPage({
      params: Promise.resolve({ lang }),
      searchParams: Promise.resolve({}),
    });
    const h1 = firstH1(renderToStaticMarkup(el));
    expect(h1?.cls).toBe("sr-only");
    expect(h1?.text.length ?? 0).toBeGreaterThan(0);
  });
});
