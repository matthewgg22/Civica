// TWO ZH REGISTERS, ONE PER SURFACE, AND THEY MUST NOT BLEED.
//
// Chinese forces a choice English does not: 您 (formal) or 你 (familiar).
// Mixing them inside one surface reads to a native speaker the way switching
// between "sir" and "buddy" mid-paragraph reads in English — not wrong word by
// word, just visibly unedited.
//
// It had drifted exactly that way. The Demeter chat was 44:5 formal with all
// five stragglers in the save panel, and /screen/saved was headed 你的对话
// while the link that sends you there (DemeterSave.tsx) was labelled 您的对话
// — the same two words, different politeness, one click apart.
//
// The surfaces settled on opposite conventions, and this test does NOT merge
// them. It pins each one:
//   Demeter (chat, saved, signin, /questions) -> 您
//   Civica apply flow (welcome, next-steps, buddy) -> 你
// If a surface should switch register, change it here on purpose and in full.
//
// SCANS FILE TEXT, NOT IMPORTED OBJECTS. The first version of this guard
// walked the exported copy modules and would have sailed straight past
// /screen/saved, whose copy is a local const the test cannot import. Page-level
// strings are exactly where this kind of drift hides, so the check reads source.
//
// 你们 IS ALLOWED IN THE FORMAL SURFACES. Standard Mandarin has no ordinary
// plural of 您 — 您们 is not idiomatic — so 你们 is the correct plural "you"
// even in writing that is otherwise scrupulously formal.

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const WEB = join(__dirname, "..", "..", "..");

/** Demeter speaks formally. */
const FORMAL = [
  "lib/i18n/demeter-chat-copy.ts",
  "lib/i18n/demeter-signin-copy.ts",
  "lib/i18n/snap-page.ts",
  "lib/i18n/feedback-copy.ts",
  "app/screen/saved/page.tsx",
  "app/[lang]/chat/page.tsx",
  "app/[lang]/questions/page.tsx",
  "app/[lang]/screen/ask/page.tsx",
];

/** The older Civica apply flow speaks familiarly. */
const FAMILIAR = [
  "lib/i18n/snap-copy.ts",
  "app/apply/next-steps/page.tsx",
  "components/ApplyHeader.tsx",
  "components/BuddyBanner.tsx",
  "components/MaeHelpButton.tsx",
];

/** Language names and one regex — CJK, but no prose to address anyone in. */
const NO_PROSE = [
  "app/i18n.ts",
  "app/sign-in/signin-form.tsx",
  "components/LanguagePicker.tsx",
  "components/DemeterChat.tsx",
  // The English-only notice (#1013): a fixed factual line per language, no
  // second-person pronoun to carry a register.
  "components/LegalPage.tsx",
];

const CJK = /[一-鿿]/;

function linesWith(file: string, re: RegExp): string[] {
  const src = readFileSync(join(WEB, file), "utf8").split("\n");
  return src
    .map((line, i) => [i + 1, line] as const)
    .filter(([, line]) => re.test(line))
    .map(([n, line]) => `${file}:${n}  ${line.trim().slice(0, 70)}`);
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".next" || entry === "__tests__") continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(entry) && CJK.test(readFileSync(full, "utf8"))) {
      out.push(relative(WEB, full));
    }
  }
  return out;
}

describe("zh register consistency", () => {
  for (const file of FORMAL) {
    it(`${file} addresses the reader as 您, never bare 你`, () => {
      // 你们 is the legitimate plural; everything else is a register slip.
      const slips = linesWith(file, /你(?!们)/);
      expect(slips, `bare 你 in a 您 surface:\n${slips.join("\n")}`).toEqual([]);
    });
  }

  for (const file of FAMILIAR) {
    it(`${file} stays in its familiar 你 register`, () => {
      const slips = linesWith(file, /您/);
      expect(slips, `您 in a 你 surface:\n${slips.join("\n")}`).toEqual([]);
    });
  }

  it("the label-only files carry no second-person prose", () => {
    for (const file of NO_PROSE) {
      const slips = linesWith(file, /您|你(?!们)/);
      expect(slips, `${file} grew prose — give it a register above:\n${slips.join("\n")}`).toEqual(
        [],
      );
    }
  });

  // THE POINT OF THE WHOLE FILE. A guard listing files by hand rots the moment
  // someone adds a zh surface it does not name — which is how /screen/saved
  // stayed mixed. Any new file carrying Chinese must declare its register here.
  it("every file carrying zh copy has declared a register", () => {
    const declared = new Set([...FORMAL, ...FAMILIAR, ...NO_PROSE]);
    const found = [...walk(join(WEB, "app")), ...walk(join(WEB, "components")), ...walk(join(WEB, "lib"))];
    const undeclared = found.filter((f) => !declared.has(f)).sort();
    expect(
      undeclared,
      `zh copy in files with no declared register — add each to FORMAL, FAMILIAR, or NO_PROSE:\n${undeclared.join("\n")}`,
    ).toEqual([]);
  });

  it("the formal surfaces really are formal (guards against a vacuous pass)", () => {
    // If a path here went stale, every assertion above would pass by reading
    // nothing. Require the formal set to actually contain 您.
    const total = FORMAL.reduce((n, f) => n + linesWith(f, /您/).length, 0);
    expect(total, "formal set has almost no 您 — are these paths still right?").toBeGreaterThan(20);
  });
});
