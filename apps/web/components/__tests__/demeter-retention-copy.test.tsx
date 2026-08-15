// @vitest-environment jsdom
//
// The estimate rail's privacy line is a RETENTION CLAIM (#703), not decoration.
//
// It used to read "Nothing here is saved. Close this tab and it is gone." That
// was true when written and became false when `publicAuditSink` was wired into
// apps/web/app/api/demeter/route.ts — every public answer now writes the
// question text and the full answer to `mae_query_log`, confirmed in production
// with `mode='public'`. Logging free chats is deliberate; a page telling people
// the opposite is not, and understating retention is the harmful direction on a
// benefits service.
//
// Nothing here can prove the sentence is TRUE — that is a human reading. What
// it can do is make the sentence hard to change by accident, in any of four
// languages, and catch the specific regression that already happened once.
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { T } from "../DemeterChat";
import { DemeterWorksheet } from "../DemeterWorksheet";

const LOCALES = ["en", "es", "vi", "zh"] as const;

describe("retention copy — the estimate rail must not understate what is kept", () => {
  afterEach(cleanup);

  it("the audit sink this copy is about is actually wired to the public route", () => {
    // The guard below only means something while the sink is live. If this
    // ever stops being true, the copy is wrong in the OTHER direction and
    // these expectations should be revisited rather than deleted.
    const route = readFileSync(
      join(__dirname, "..", "..", "app", "api", "demeter", "route.ts"),
      "utf8",
    );
    expect(route).toContain("publicAuditSink");
    expect(route).toContain("audit: publicAuditSink");
  });

  it("every locale carries both variants, non-empty", () => {
    for (const locale of LOCALES) {
      const copy = T[locale].worksheet;
      expect(copy.privacy.trim(), locale).not.toBe("");
      expect(copy.privacySaved.trim(), locale).not.toBe("");
    }
  });

  it("no locale still claims nothing is saved", () => {
    // The exact strings that shipped the bug, so a revert or a copy-paste of
    // the old table fails here rather than in production.
    const RETIRED = [
      "Nothing here is saved",
      "Nada de esto se guarda",
      "Không có gì ở đây được lưu lại",
      "这里的内容不会被保存",
    ];
    const all = LOCALES.flatMap((l) => [T[l].worksheet.privacy, T[l].worksheet.privacySaved]).join(
      "\n",
    );
    for (const phrase of RETIRED) expect(all).not.toContain(phrase);
  });

  it("every locale says a record is kept, in both variants", () => {
    // Language-specific because there is no locale-agnostic way to assert a
    // meaning. Each fragment is the "we keep it" clause of its own sentence.
    // The clause was shortened — the panel was two paragraphs of chrome under
    // an estimate — from "we keep the question and answer" to "we keep the
    // text". That is the same admission, and if anything a broader one, so
    // what is pinned is the ADMISSION, not the wording: it must still say we
    // keep something, and say why. Loosening this is only safe in that
    // direction; a version that says we keep NOTHING has to keep failing.
    const KEEPS: Record<(typeof LOCALES)[number], RegExp> = {
      en: /We keep the (question and answer|text)/,
      es: /Guardamos (la pregunta y la respuesta|el texto)/,
      vi: /Chúng tôi (lưu|giữ) (câu hỏi và câu trả lời|nội dung)/,
      zh: /(我们会保留问题和回答|我们保留文字)/,
    };
    const WHY: Record<(typeof LOCALES)[number], RegExp> = {
      en: /check our accuracy/,
      es: /verificar nuestra exactitud/,
      vi: /kiểm tra độ chính xác/,
      zh: /核查准确性/,
    };
    for (const locale of LOCALES) {
      const copy = T[locale].worksheet;
      expect(copy.privacy, `${locale} unsaved`).toMatch(KEEPS[locale]);
      expect(copy.privacySaved, `${locale} saved`).toMatch(KEEPS[locale]);
      expect(copy.privacy, `${locale} unsaved why`).toMatch(WHY[locale]);
      expect(copy.privacySaved, `${locale} saved why`).toMatch(WHY[locale]);
    }
  });

  it("every locale asks people not to type names — redactPii does not strip them", () => {
    // pii.ts redacts structured identifiers and says in its own header that
    // names are deliberately NOT detected ("a privacy control, not a
    // guarantee; pair it with the 'don't paste PII' prompt"). This copy is
    // that pairing, so the ask has to survive translation edits.
    // Shortened to "avoid names" / "evita nombres" — the ask survives, the
    // verb went. Matched as a pattern so the ask is what is pinned.
    const ASKS: Record<(typeof LOCALES)[number], RegExp> = {
      en: /avoid (typing )?names/,
      es: /evita (escribir )?nombres/,
      vi: /đừng nhập tên/,
      zh: /请勿输入姓名/,
    };
    for (const locale of LOCALES) {
      expect(T[locale].worksheet.privacy, locale).toMatch(ASKS[locale]);
      expect(T[locale].worksheet.privacySaved, locale).toMatch(ASKS[locale]);
    }
  });

  it("does not tell a saved conversation it will be gone when the tab closes", () => {
    // The bug that made this a two-variant string: the sidebar sat inches from
    // a ✓ Saved badge and contradicted it.
    const copy = T.en.worksheet;

    render(
      <DemeterWorksheet
        classification={null}
        stateSelected={false}
        saved={false}
        copy={copy}
        mode="estimate"
        onModeChange={() => {}}
      />,
    );
    expect(screen.getByText(copy.privacy)).toBeTruthy();
    expect(screen.queryByText(copy.privacySaved)).toBeNull();
    cleanup();

    render(
      <DemeterWorksheet
        classification={null}
        stateSelected={false}
        saved
        copy={copy}
        mode="estimate"
        onModeChange={() => {}}
      />,
    );
    expect(screen.getByText(copy.privacySaved)).toBeTruthy();
    expect(screen.queryByText(copy.privacy)).toBeNull();
  });

  it("defaults to the unsaved variant when the flag is absent", () => {
    // An omitted prop must not silently promise someone their conversation is
    // stored; the safe default is the one that claims less.
    const copy = T.en.worksheet;
    render(
      <DemeterWorksheet
        classification={null}
        stateSelected={false}
        copy={copy}
        mode="estimate"
        onModeChange={() => {}}
      />,
    );
    expect(screen.getByText(copy.privacy)).toBeTruthy();
  });
});
