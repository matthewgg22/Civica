"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { patchMe } from "@/lib/api/actions";

const SUPPORTED_STATES = [
  { code: "CA", labelKey: "stateCA" },
  { code: "MA", labelKey: "stateMA" },
] as const;

const SUPPORTED_LANGUAGES = [
  { code: "en", labelKey: "languageEn" },
  { code: "es", labelKey: "languageEs" },
] as const;

type Step = "state" | "language";

type Props = {
  locale: string;
  /** Pre-filled if user already has a profile */
  initialState?: "CA" | "MA" | null;
  initialLanguage?: "en" | "es" | null;
};

export function OnboardingFlow({ locale, initialState, initialLanguage }: Props) {
  const t = useTranslations("onboarding");
  const tc = useTranslations("common");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [step, setStep] = useState<Step>(initialState ? "language" : "state");
  const [selectedState, setSelectedState] = useState<"CA" | "MA" | "">(initialState ?? "");
  const [selectedLanguage, setSelectedLanguage] = useState<"en" | "es" | "">(
    initialLanguage ?? ""
  );

  function handleStateContinue() {
    if (!selectedState) return;
    setError(null);
    startTransition(async () => {
      const result = await patchMe({ state_code: selectedState });
      if (!result.success) {
        setError(result.error);
        return;
      }
      setStep("language");
    });
  }

  function handleLanguageContinue() {
    if (!selectedLanguage) return;
    setError(null);
    startTransition(async () => {
      const result = await patchMe({ language: selectedLanguage });
      if (!result.success) {
        setError(result.error);
        return;
      }
      // Redirect to the chosen locale's packet page
      router.push(`/${selectedLanguage}/app/packet`);
    });
  }

  return (
    <div className="space-y-8">
      {/* Step indicator */}
      <div className="flex items-center gap-2" aria-label="Onboarding progress">
        <StepDot active={step === "state"} done={step === "language"} label="1" />
        <div className="h-px flex-1 bg-slate-200" />
        <StepDot active={step === "language"} done={false} label="2" />
      </div>

      {error && (
        <Alert variant="destructive" aria-live="polite">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {step === "state" && (
        <StateStep
          t={t}
          tc={tc}
          selected={selectedState}
          onSelect={(v) => setSelectedState(v)}
          onContinue={handleStateContinue}
          isPending={isPending}
        />
      )}

      {step === "language" && (
        <LanguageStep
          t={t}
          tc={tc}
          selected={selectedLanguage}
          onSelect={(v) => setSelectedLanguage(v)}
          onContinue={handleLanguageContinue}
          onBack={() => setStep("state")}
          isPending={isPending}
        />
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StepDot({
  active,
  done,
  label,
}: {
  active: boolean;
  done: boolean;
  label: string;
}) {
  return (
    <div
      aria-hidden="true"
      className={[
        "flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium",
        active ? "bg-slate-900 text-white" : done ? "bg-green-600 text-white" : "bg-slate-100 text-slate-600",
      ].join(" ")}
    >
      {done ? "✓" : label}
    </div>
  );
}

type TFn = ReturnType<typeof useTranslations>;

function StateStep({
  t,
  tc,
  selected,
  onSelect,
  onContinue,
  isPending,
}: {
  t: TFn;
  tc: TFn;
  selected: string;
  onSelect: (v: "CA" | "MA") => void;
  onContinue: () => void;
  isPending: boolean;
}) {
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">{t("selectState")}</h2>

      <RadioGroup
        value={selected}
        onValueChange={(v) => onSelect(v as "CA" | "MA")}
        aria-label={t("selectState")}
      >
        {SUPPORTED_STATES.map(({ code, labelKey }) => (
          <label
            key={code}
            htmlFor={`state-${code}`}
            className={[
              "flex cursor-pointer items-center gap-4 rounded-xl border-2 p-4 transition-colors",
              selected === code
                ? "border-slate-900 bg-slate-50"
                : "border-slate-200 hover:border-slate-300",
            ].join(" ")}
          >
            <RadioGroupItem id={`state-${code}`} value={code} />
            <span className="text-base font-medium">{t(labelKey)}</span>
          </label>
        ))}
      </RadioGroup>

      <Button
        className="w-full"
        size="lg"
        onClick={onContinue}
        disabled={!selected || isPending}
      >
        {isPending ? tc("loading") : tc("continue")}
      </Button>
    </div>
  );
}

function LanguageStep({
  t,
  tc,
  selected,
  onSelect,
  onContinue,
  onBack,
  isPending,
}: {
  t: TFn;
  tc: TFn;
  selected: string;
  onSelect: (v: "en" | "es") => void;
  onContinue: () => void;
  onBack: () => void;
  isPending: boolean;
}) {
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">{t("selectLanguage")}</h2>

      <div className="grid grid-cols-2 gap-4" role="group" aria-label={t("selectLanguage")}>
        {SUPPORTED_LANGUAGES.map(({ code, labelKey }) => (
          <button
            key={code}
            type="button"
            onClick={() => onSelect(code)}
            aria-pressed={selected === code}
            className={[
              "rounded-xl border-2 p-6 text-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2",
              selected === code
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-200 bg-white text-slate-900 hover:border-slate-300",
            ].join(" ")}
          >
            {t(labelKey)}
          </button>
        ))}
      </div>

      <Button
        className="w-full"
        size="lg"
        onClick={onContinue}
        disabled={!selected || isPending}
      >
        {isPending ? tc("loading") : tc("continue")}
      </Button>

      <Button variant="ghost" className="w-full" onClick={onBack} disabled={isPending}>
        {tc("back")}
      </Button>
    </div>
  );
}
