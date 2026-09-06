import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LANG_TAG } from "@civica/demeter-engine/packs";
import LangLayout from "../layout";

// The root layout hardcodes <html lang="en">, so a Spanish/Vietnamese/Chinese
// page tells screen readers it is English. This layout carries the content
// language on the SSR wrapper (WCAG 3.1.2); HtmlLang fixes <html lang> at
// runtime (3.1.1). Here we pin the SSR half.

async function render(lang: string): Promise<string> {
  const el = await LangLayout({
    children: createElement("main", { className: "dmpage" }, "content"),
    params: Promise.resolve({ lang }),
  });
  return renderToStaticMarkup(el);
}

describe("[lang] layout tags the localized content with its language", () => {
  it("uses each segment's BCP-47 tag and still renders its children", async () => {
    for (const l of ["es", "vi", "zh"] as const) {
      const html = await render(l);
      expect(html, `lang for /${l}`).toContain(`lang="${LANG_TAG[l]}"`);
      expect(html).toContain("content");
    }
  });

  it("adds no layout box (display:contents)", async () => {
    expect(await render("es")).toContain("display:contents");
  });

  it("falls back to en for an unknown segment rather than mislabeling", async () => {
    expect(await render("zz")).toContain('lang="en"');
  });
});
