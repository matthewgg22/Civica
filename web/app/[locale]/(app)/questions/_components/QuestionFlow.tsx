"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { QuestionField, type FieldValue } from "@/components/snap/QuestionField";
import { ProgressBar } from "@/components/snap/ProgressBar";

const DistressConfirmModal = dynamic(
  () => import("@/components/snap/DistressConfirmModal").then((m) => m.DistressConfirmModal),
  { ssr: false }
);
import { saveAnswer } from "@/lib/api/actions";
import { enqueue } from "@/lib/storage/draftQueue";
import { useOfflineQueue } from "@/hooks/useOfflineQueue";
import type { components } from "@/lib/api/types";

type QuestionSection = components["schemas"]["QuestionSection"];
type Question = components["schemas"]["Question"];
type Answer = components["schemas"]["Answer"];

type SaveState = "idle" | "saving" | "saved" | "offline" | "error";

type Props = {
  packetId: string;
  locale: string;
  sections: QuestionSection[];
  initialAnswers: Answer[];
};

// ── Section key → i18n key map ────────────────────────────────────────────────
const SECTION_LABEL_KEYS: Record<string, string> = {
  household: "sectionHousehold",
  income: "sectionIncome",
  expenses: "sectionExpenses",
  housing: "sectionHousing",
  identity: "sectionIdentity",
  residency: "sectionResidency",
};

export function QuestionFlow({ packetId, locale, sections, initialAnswers }: Props) {
  const t = useTranslations("questions");
  const tc = useTranslations("common");
  const router = useRouter();
  const { isOnline, hasPending } = useOfflineQueue();

  // ── Answer state ──────────────────────────────────────────────────────────
  const [answers, setAnswers] = useState<Record<string, FieldValue>>(() => {
    const map: Record<string, FieldValue> = {};
    for (const a of initialAnswers) {
      map[a.question_id] = a.value as FieldValue;
    }
    return map;
  });

  const [saveStates, setSaveStates] = useState<Record<string, SaveState>>({});
  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // ── Distress gate ─────────────────────────────────────────────────────────
  const [distressPending, setDistressPending] = useState<Question | null>(null);
  const [acknowledgedDistress, setAcknowledgedDistress] = useState<Set<string>>(new Set());

  // All questions flat, for progress calculation
  const allQuestions = sections.flatMap((s) => s.questions);
  const requiredQuestions = allQuestions.filter((q) => q.required);
  const completedCount = requiredQuestions.filter((q) => {
    const v = answers[q.id];
    if (v === null || v === undefined) return false;
    if (typeof v === "string") return v.trim().length > 0;
    if (Array.isArray(v)) return v.length > 0;
    return true;
  }).length;

  // ── Save logic ────────────────────────────────────────────────────────────
  const persistAnswer = useCallback(
    async (questionId: string, value: FieldValue) => {
      if (!isOnline) {
        enqueue({ packetId, questionId, value });
        setSaveStates((s) => ({ ...s, [questionId]: "offline" }));
        return;
      }
      setSaveStates((s) => ({ ...s, [questionId]: "saving" }));
      const result = await saveAnswer(packetId, questionId, value);
      setSaveStates((s) => ({
        ...s,
        [questionId]: result.success ? "saved" : "error",
      }));
      // Reset to idle after 2s
      setTimeout(() => {
        setSaveStates((s) => ({ ...s, [questionId]: "idle" }));
      }, 2000);
    },
    [packetId, isOnline]
  );

  function handleChange(question: Question, value: FieldValue) {
    // Show distress modal on first interaction with a distress-prompt question
    if (question.distress_prompt && !acknowledgedDistress.has(question.id)) {
      setDistressPending(question);
      return;
    }

    setAnswers((prev) => ({ ...prev, [question.id]: value }));
    setSaveStates((s) => ({ ...s, [question.id]: "saving" }));

    // Debounce 500ms
    if (debounceTimers.current[question.id]) {
      clearTimeout(debounceTimers.current[question.id]);
    }
    debounceTimers.current[question.id] = setTimeout(() => {
      persistAnswer(question.id, value);
    }, 500);
  }

  // Clean up timers on unmount
  useEffect(() => {
    const timers = debounceTimers.current;
    return () => {
      for (const t of Object.values(timers)) clearTimeout(t);
    };
  }, []);

  function handleDistressContinue() {
    if (!distressPending) return;
    setAcknowledgedDistress((prev) => new Set([...prev, distressPending.id]));
    setDistressPending(null);
  }

  function handleDistressResources() {
    // Opens local resources in a new tab; for now a placeholder
    window.open(`/${locale}/resources`, "_blank", "noopener");
    setDistressPending(null);
  }

  const allRequiredAnswered =
    completedCount === requiredQuestions.length && requiredQuestions.length > 0;

  return (
    <div className="space-y-8">
      {/* Overall progress */}
      <div className="sticky top-0 z-10 -mx-4 bg-white px-4 pb-3 pt-4 shadow-sm">
        <ProgressBar
          completed={completedCount}
          total={requiredQuestions.length}
          label={t("progress", { completed: completedCount, total: requiredQuestions.length })}
        />
        {(!isOnline || hasPending) && (
          <p className="mt-1 text-xs text-amber-700" aria-live="polite">
            {tc("savedOffline")}
          </p>
        )}
      </div>

      {/* Sections */}
      {sections.map((section) => {
        const labelKey = SECTION_LABEL_KEYS[section.key] ?? section.key;
        const sectionCompleted = section.questions.filter((q) => {
          const v = answers[q.id];
          if (v === null || v === undefined) return false;
          if (typeof v === "string") return v.trim().length > 0;
          if (Array.isArray(v)) return v.length > 0;
          return true;
        }).length;

        return (
          <section key={section.key} aria-labelledby={`section-${section.key}`}>
            <div className="mb-4 flex items-center justify-between">
              <h2
                id={`section-${section.key}`}
                className="text-lg font-semibold"
              >
                {t(labelKey as Parameters<typeof t>[0])}
              </h2>
              <ProgressBar
                completed={sectionCompleted}
                total={section.questions.length}
                size="sm"
              />
            </div>

            <div className="space-y-6 rounded-xl border border-slate-200 p-4">
              {section.questions.map((question) => (
                <QuestionField
                  key={question.id}
                  question={question}
                  value={answers[question.id] ?? null}
                  onChange={(v) => handleChange(question, v)}
                  saveState={saveStates[question.id] ?? "idle"}
                />
              ))}
            </div>
          </section>
        );
      })}

      {/* Continue CTA */}
      {allRequiredAnswered && (
        <div className="sticky bottom-0 -mx-4 border-t border-slate-200 bg-white px-4 py-4">
          <button
            type="button"
            className="w-full rounded-xl bg-slate-900 py-4 text-base font-semibold text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2"
            onClick={() => router.push(`/${locale}/app/documents`)}
          >
            {tc("continue")}
          </button>
        </div>
      )}

      {/* Distress gate modal */}
      <DistressConfirmModal
        open={distressPending !== null}
        onContinue={handleDistressContinue}
        onResources={handleDistressResources}
      />
    </div>
  );
}
