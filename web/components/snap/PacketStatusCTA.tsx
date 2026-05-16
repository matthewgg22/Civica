"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import type { PacketStatus } from "./StatusPill";

type Props = { status: PacketStatus; locale: string };

export function PacketStatusCTA({ status, locale }: Props) {
  const t = useTranslations("packet");
  const router = useRouter();

  const cta = CTA_MAP[status];
  if (!cta) return null;

  return (
    <Button
      size="lg"
      className="w-full"
      variant={cta.variant ?? "default"}
      onClick={() => router.push(`/${locale}/app/${cta.href}`)}
    >
      {t(cta.labelKey as Parameters<typeof t>[0])}
    </Button>
  );
}

type CTAConfig = {
  labelKey: string;
  href: string;
  variant?: "default" | "outline";
};

const CTA_MAP: Partial<Record<PacketStatus, CTAConfig>> = {
  Draft: {
    labelKey: "ctaAnswerQuestions",
    href: "questions",
  },
  "Needs Documents": {
    labelKey: "ctaUploadDocuments",
    href: "documents",
  },
  "Needs Applicant Clarification": {
    labelKey: "ctaAnswerQuestions",
    href: "inbox",
  },
  // No CTA for: Submitted for Review, In Navigator Review,
  // Ready for Handoff, Handed Off, Closed
};
