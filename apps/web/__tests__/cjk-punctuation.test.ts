// Chinese copy uses Chinese punctuation.
//
// The zh strings mixed half-width and full-width marks — 20 ASCII commas
// against 17 correct full-width ones in snap-copy.ts alone, plus ASCII colons
// and parentheses wrapping Chinese. To a Chinese reader that is the
// equivalent of inconsistent spacing in English: it does not change the
// meaning, it just looks like nobody proofread it.
//
// Some of it predates #1007's em-dash pass; some was introduced by it, where
// "——" became a half-width "," or ":".
//
// THE CITATION EXCEPTION IS DELIBERATE. "(7 CFR 273.1(a))" keeps ASCII
// parentheses, because citations render verbatim and never translate
// (DEMETER-DESIGN §2.1). The rules below key off what is ADJACENT to the
// punctuation, so a citation bounded by digits is untouched by construction
// rather than by a special case.
import { describe, expect, it } from "vitest";
import { PAGE_COPY } from "../lib/i18n/snap-page";
import { T as CHAT_COPY } from "../lib/i18n/demeter-chat-copy";
import { welcomeStrings } from "../lib/i18n/snap-copy";

const HAN = "一-鿿";

function strings(value: unknown, out: string[] = []): string[] {
  if (typeof value === "string") out.push(value);
  else if (typeof value === "function") {
    try {
      out.push(String((value as (...a: unknown[]) => unknown)("X", "Y", 1, 2)));
    } catch {
      /* formatters needing a richer shape are skipped rather than guessed at */
    }
  } else if (Array.isArray(value)) value.forEach((v) => strings(v, out));
  else if (value && typeof value === "object") Object.values(value).forEach((v) => strings(v, out));
  return out;
}

// snapStrings is NOT here, and that is a fact about the product rather than
// an omission: it carries the Civica application flow and exists in en/es
// only. The Chinese home_* strings live in welcomeStrings, which has
// en/es/zh/vi/tl. TypeScript is what caught me indexing the wrong one.
const ZH: string[] = [
  ...strings(PAGE_COPY.zh),
  ...strings(CHAT_COPY.zh),
  ...strings(welcomeStrings.zh),
].filter((s) => new RegExp(`[${HAN}]`).test(s));

const offending = (re: RegExp) =>
  [...new Set(ZH.filter((s) => re.test(s)))].map((s) => s.slice(0, 90));

describe("Chinese copy uses full-width punctuation", () => {
  it("has Chinese strings to check at all", () => {
    // Guards the guard: if the copy moves and this collects nothing, every
    // assertion below passes vacuously.
    expect(ZH.length).toBeGreaterThan(20);
  });

  it("uses ，not a half-width comma beside Chinese", () => {
    // Either side counts. "1,000" has digits both sides and is fine;
    // "EBT, SNAP" is a Latin list and is fine.
    const bad = offending(new RegExp(`([${HAN}]\\s*,)|(,\\s*[${HAN}])`));
    expect(bad, `half-width comma next to Chinese:\n${bad.join("\n")}`).toEqual([]);
  });

  it("uses ：not a half-width colon after Chinese", () => {
    // What precedes decides it: "美国农业部食品与营养服务局：SNAP" takes a
    // full-width colon even though what follows is Latin.
    const bad = offending(new RegExp(`[${HAN}]\\s*:`));
    expect(bad, `half-width colon after Chinese:\n${bad.join("\n")}`).toEqual([]);
  });

  it("uses （） not half-width parentheses around Chinese", () => {
    const bad = offending(new RegExp(`(\\([${HAN}])|([${HAN}]\\))`));
    expect(bad, `half-width parentheses around Chinese:\n${bad.join("\n")}`).toEqual([]);
  });
});
