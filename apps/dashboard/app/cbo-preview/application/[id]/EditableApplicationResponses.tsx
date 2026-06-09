"use client";

// Editable application responses for the full-application page. Mirrors the
// caseload dropdown's batch-edit UX (one "Edit responses" toggle unlocks every
// field; fixed-option fields become a <select>, others a text input) but laid out
// as the page's two-column document grid. Edits are ephemeral — this is the
// synthetic CBO preview, so nothing is persisted (matches the dropdown's honesty).

import { useState } from "react";
import type { SurveyAnswer } from "../../../../lib/cbo/demo-pipeline";
import { optionsFor } from "../../../../lib/cbo/field-options";

function groupBySection(answers: SurveyAnswer[]): { section: string; items: SurveyAnswer[] }[] {
  const out: { section: string; items: SurveyAnswer[] }[] = [];
  for (const a of answers) {
    const last = out[out.length - 1];
    if (last && last.section === a.section) last.items.push(a);
    else out.push({ section: a.section, items: [a] });
  }
  return out;
}

export default function EditableApplicationResponses({ answers }: { answers: SurveyAnswer[] }) {
  const [editing, setEditing] = useState(false);
  const [edited, setEdited] = useState<Record<string, string>>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const current = (a: SurveyAnswer) => edited[a.question] ?? a.answer;
  const sections = groupBySection(answers);

  const startEdit = () => {
    const seed: Record<string, string> = {};
    for (const a of answers) seed[a.question] = current(a);
    setDrafts(seed);
    setEditing(true);
  };
  const cancel = () => {
    setEditing(false);
    setDrafts({});
  };
  const save = () => {
    setEdited((prev) => {
      const next = { ...prev };
      for (const a of answers) {
        const v = drafts[a.question];
        if (v !== undefined && v !== current(a)) next[a.question] = v;
      }
      return next;
    });
    setEditing(false);
    setDrafts({});
  };

  return (
    <section className="py-4 border-b border-hairline">
      <div className="flex items-baseline justify-between gap-3 mb-2 print:hidden">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-graphite">Application responses</h2>
        {editing ? (
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={cancel}
              className="rounded-[2px] border border-hairline px-2.5 py-1 text-[11px] font-medium text-graphite hover:bg-surface-secondary"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={save}
              className="rounded-[2px] bg-pine px-2.5 py-1 text-[11px] font-medium text-white hover:bg-pine-pressed"
            >
              Save changes
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={startEdit}
            className="inline-flex items-center gap-1.5 rounded-[2px] border border-hairline px-2.5 py-1 text-[11px] font-medium text-pine hover:bg-surface-secondary"
          >
            <svg width="11" height="11" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M9.5 2.5l2 2L5 11l-2.5.5L3 9l6.5-6.5z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
            </svg>
            Edit responses
          </button>
        )}
      </div>
      {/* Print-only heading (the toolbar row above is hidden on print). */}
      <h2 className="hidden print:block text-[11px] font-semibold uppercase tracking-wider text-graphite border-b border-hairline pb-1 mb-2">
        Application responses
      </h2>

      <div className="columns-1 sm:columns-2 gap-x-8 [&>div]:break-inside-avoid">
        {sections.map((group) => (
          <div key={group.section} className="mb-3">
            <p className="text-[11px] font-semibold text-ink mb-0.5">{group.section}</p>
            <dl className="divide-y divide-hairline">
              {group.items.map((a) => {
                const wasEdited = a.question in edited;
                const opts = optionsFor(a.question, drafts[a.question] ?? current(a));
                return (
                  <div key={a.question} className="flex items-baseline justify-between gap-3 py-1">
                    <dt className="text-[12px] text-graphite shrink-0 max-w-[55%]">{a.question}</dt>
                    <dd className="text-[12px] text-right flex-1">
                      {editing ? (
                        opts ? (
                          <select
                            value={drafts[a.question] ?? ""}
                            onChange={(e) => setDrafts((p) => ({ ...p, [a.question]: e.target.value }))}
                            aria-label={a.question}
                            className="w-full px-1.5 py-1 text-[12px] bg-surface border border-hairline rounded-[2px] text-ink focus:border-pine focus:outline-none"
                          >
                            {opts.map((o) => (
                              <option key={o} value={o}>{o}</option>
                            ))}
                          </select>
                        ) : (
                          <input
                            value={drafts[a.question] ?? ""}
                            onChange={(e) => setDrafts((p) => ({ ...p, [a.question]: e.target.value }))}
                            aria-label={a.question}
                            className="w-full px-1.5 py-0.5 text-[12px] bg-surface border border-hairline rounded-[2px] text-ink focus:border-pine focus:outline-none"
                          />
                        )
                      ) : (
                        <span className={a.flagged && !wasEdited ? "text-brick font-semibold" : "text-ink font-medium"}>
                          {current(a)}
                          {a.flagged && !wasEdited && <span className="ml-1 text-[9px] uppercase tracking-wider">⚑ verify</span>}
                          {wasEdited && <span className="ml-1 text-[9px] uppercase tracking-wider text-graphite">· edited</span>}
                        </span>
                      )}
                    </dd>
                  </div>
                );
              })}
            </dl>
          </div>
        ))}
      </div>

      {editing && (
        <p className="mt-2 text-[11px] text-graphite print:hidden">
          Edits are a local preview — not saved to the case.
        </p>
      )}
    </section>
  );
}
