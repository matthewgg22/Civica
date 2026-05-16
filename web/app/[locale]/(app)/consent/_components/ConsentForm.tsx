"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { submitWithConsent } from "@/lib/api/actions";
import type { ReadinessReport } from "@/lib/api/actions";

type Props = {
  packetId: string;
  locale: string;
  readiness: ReadinessReport;
};

export function ConsentForm({ packetId, locale, readiness }: Props) {
  const t = useTranslations("consent");
  const tc = useTranslations("common");

  const [checked, setChecked] = useState(false);
  const [signature, setSignature] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const isReady = readiness.questionsReady && readiness.documentsReady;
  const canSubmit = isReady && checked && signature.trim().length > 0 && !isPending;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    startTransition(async () => {
      const result = await submitWithConsent(packetId, signature.trim());
      if (!result.success) {
        setError(result.error);
        return;
      }
      router.push(`/${locale}/app/packet`);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6" aria-label={t("title")}>
      {/* Consent body */}
      <div
        className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 leading-relaxed"
        role="note"
        aria-label="Consent text"
      >
        {t("body")}
      </div>

      {/* Readiness blockers */}
      {!isReady && (
        <div role="alert" aria-live="polite" className="space-y-2">
          {!readiness.questionsReady && (
            <Alert variant="destructive">
              {t("blockerQuestions", {
                answered: readiness.requiredQuestionsAnswered,
                total: readiness.requiredQuestionsTotal,
              })}
            </Alert>
          )}
          {!readiness.documentsReady && (
            <Alert variant="destructive">
              {t("blockerDocuments", {
                uploaded: readiness.requiredDocsUploaded,
                total: readiness.requiredDocsTotal,
              })}
            </Alert>
          )}
        </div>
      )}

      {/* Checkbox */}
      <div className="flex items-start gap-3">
        <Checkbox
          id="consent-checkbox"
          checked={checked}
          onCheckedChange={(v) => setChecked(v === true)}
          aria-required="true"
          disabled={!isReady || isPending}
        />
        <Label htmlFor="consent-checkbox" className="text-sm leading-snug cursor-pointer">
          {t("checkboxLabel")}
        </Label>
      </div>

      {/* Signature */}
      <div className="space-y-2">
        <Label htmlFor="consent-signature" className="text-sm font-medium">
          {t("signaturePlaceholder")}
        </Label>
        <Input
          id="consent-signature"
          type="text"
          value={signature}
          onChange={(e) => setSignature(e.target.value)}
          placeholder={t("signaturePlaceholder")}
          autoComplete="name"
          aria-required="true"
          disabled={!isReady || isPending}
          className="max-w-sm"
        />
      </div>

      {/* Server error */}
      {error && (
        <Alert variant="destructive" role="alert" aria-live="assertive">
          {tc("error")}
        </Alert>
      )}

      {/* Submit */}
      <Button type="submit" disabled={!canSubmit} aria-disabled={!canSubmit}>
        {isPending ? tc("loading") : t("submit")}
      </Button>
    </form>
  );
}
