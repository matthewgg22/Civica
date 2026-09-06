import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { strings } from "../i18n";

// Launch audit: the app error/404/global-error boundaries used to render the
// retired Civica parchment palette and funnel users into the parked "CalFresh
// for California college students" portal (/welcome) — the wrong product, shown
// to every visitor while the dynamic pages are erroring. They also carried two
// defects: error.tsx's reference fell back to a bare "," and not-found.tsx had
// an empty-label secondary link. These pin the fix so none of it regresses.

const APP = join(__dirname, "..");
const read = (f: string) => readFileSync(join(APP, f), "utf8");

describe("error + 404 boundaries are Demeter-branded, not Civica", () => {
  it("i18n error/notFound copy carries no Civica/CalFresh/welcome branding (en + es)", () => {
    for (const loc of ["en", "es"] as const) {
      const s = strings[loc];
      const blob = [
        s.errorStatus, s.errorTitle, s.errorBody, s.errorHomeCta, s.errorHelpNote,
        s.notFoundStatus, s.notFoundTitle, s.notFoundBody, s.notFoundHomeCta, s.notFoundQuestionsCta,
      ].join(" | ");
      expect(blob, `${loc} boundary copy`).not.toMatch(/civica|calfresh|welcome/i);
    }
  });

  it("both locales define the new help + questions keys, and the help note names 211", () => {
    for (const loc of ["en", "es"] as const) {
      expect(strings[loc].errorHelpNote.length).toBeGreaterThan(10);
      expect(strings[loc].notFoundQuestionsCta.length).toBeGreaterThan(2);
      // The always-works path for a benefits audience, even while the app is down.
      expect(strings[loc].errorHelpNote).toMatch(/211/);
    }
  });

  it("boundaries link to Demeter surfaces, never the parked /welcome portal", () => {
    for (const f of ["error.tsx", "not-found.tsx", "global-error.tsx"]) {
      const src = read(f);
      expect(src, `${f} must not link /welcome`).not.toContain("/welcome");
      expect(src, `${f} must not mention Civica/CalFresh`).not.toMatch(/civica|calfresh/i);
    }
    const nf = read("not-found.tsx");
    expect(nf).toContain('href="/screen/ask"');
    expect(nf).toContain('href="/questions"');
    expect(read("error.tsx")).toContain('href="/screen/ask"');
  });

  it("the error reference falls back to 'none', not a bare comma (regression)", () => {
    const src = read("error.tsx");
    expect(src).toContain('error.digest ?? "none"');
    expect(src).not.toContain('?? ", "');
  });

  it("not-found has no empty-label link (regression)", () => {
    // The old bug was <Link href="/#lead-capture"> →</Link> — a link whose only
    // text was an arrow. Both links now carry a real label from copy.
    const nf = read("not-found.tsx");
    expect(nf).not.toContain("/#lead-capture");
    expect(nf).toContain("notFoundQuestionsCta");
  });
});
