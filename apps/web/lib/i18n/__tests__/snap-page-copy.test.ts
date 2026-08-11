// Landing copy, checked for the mistakes a non-speaker actually makes.
//
// The page copy in snap-page.ts is not native-reviewed (its own header says so).
// A parity test catches a MISSING translation; it cannot catch a translation
// that is fluent, well-formed, and means something else. This file targets the
// second kind, starting with one that shipped.
//
// 贵州手册 was meant to read "your state's manual". 贵 IS an honorific before a
// noun — 贵公司 is "your company" — but 贵州 collides head-on with Guizhou
// Province, so every Chinese reader saw "the Guizhou manual" on a page whose
// entire claim is that it knows which state's rules apply to them. Fluent,
// grammatical, wrong. Found by reading the rendered /zh page, not by any test.

import { describe, it, expect } from "vitest";
import { PAGE_COPY } from "../snap-page";
import { ANSWER_LANGS } from "@civica/demeter-engine/packs";

/** Every string on the page, flattened, per language. */
function allStrings(lang: (typeof ANSWER_LANGS)[number]): string[] {
  const out: string[] = [];
  const walk = (v: unknown): void => {
    if (typeof v === "string") out.push(v);
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") Object.values(v).forEach(walk);
  };
  walk(PAGE_COPY[lang]);
  return out;
}

describe("landing copy — meaning, not just presence", () => {
  it("never writes 贵州 for 'your state'", () => {
    // The whole point of the product is knowing WHICH state governs someone.
    // Naming the wrong one, in the sentence that makes the claim, is the worst
    // possible place for this error.
    for (const s of allStrings("zh")) {
      expect(s, `"${s}" contains 贵州 (Guizhou Province), not "your state"`).not.toContain("贵州");
    }
  });

  it("says 'your state' the way that actually reads as second person in zh", () => {
    const joined = allStrings("zh").join("\n");
    expect(joined).toContain("您所在州");
  });

  it("every language defines every key the page renders", () => {
    // Structural backstop. The meaning checks above are per-string and narrow;
    // this catches a key that silently went missing in one language.
    const enKeys = Object.keys(PAGE_COPY.en).sort();
    for (const lang of ANSWER_LANGS) {
      expect(Object.keys(PAGE_COPY[lang]).sort(), lang).toEqual(enKeys);
    }
  });

  it("no language ships an empty or placeholder string", () => {
    for (const lang of ANSWER_LANGS) {
      for (const s of allStrings(lang)) {
        expect(s.trim(), `${lang} has an empty string`).not.toBe("");
        expect(s, `${lang}: "${s}" looks like a placeholder`).not.toMatch(/^(TODO|TBD|FIXME|XXX)/i);
      }
    }
  });
});
