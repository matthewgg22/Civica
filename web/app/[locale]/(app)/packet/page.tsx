import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createSupabaseServerClient } from "@/lib/auth/supabase-server";
import { getMe, getOrCreatePacket, getPacketHistory } from "@/lib/api/actions";
import { StatusPill, type PacketStatus } from "@/components/snap/StatusPill";
import { PacketTimeline } from "@/components/snap/PacketTimeline";
import { PacketStatusCTA } from "@/components/snap/PacketStatusCTA";
import { WithdrawConsentButton } from "@/components/snap/WithdrawConsentButton";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "packet" });
  return { title: t("title") };
}

export default async function PacketPage({ params }: Props) {
  const { locale } = await params;

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/sign-in`);

  const profileResult = await getMe();
  const profile = profileResult.success ? profileResult.data : null;
  if (!profile?.state_code || !profile?.language) {
    redirect(`/${locale}/app/onboarding`);
  }

  const tc = await getTranslations({ locale, namespace: "common" });

  const packetResult = await getOrCreatePacket(profile.state_code as "CA" | "MA");
  if (!packetResult.success) {
    return (
      <div className="py-8 text-center text-slate-500">
        {tc("loadError")}
      </div>
    );
  }
  const packet = packetResult.data;
  const status = packet.status as PacketStatus;

  // Fetch history — non-blocking, fall back to empty
  const historyResult = await getPacketHistory(packet.id).catch(() => null);
  const history = historyResult?.success ? historyResult.data : [];

  // Synthesise a history entry from packet timestamps if API returns nothing
  const displayHistory =
    history.length > 0
      ? history
      : [
          {
            status: packet.status,
            timestamp: packet.updated_at ?? packet.created_at ?? new Date().toISOString(),
          },
        ];

  const t = await getTranslations({ locale, namespace: "packet" });

  // Build a map of all status → translated label so StatusPill and
  // PacketTimeline can render locale-correct strings instead of raw API values.
  const statusLabels: Record<PacketStatus, string> = {
    Draft: t("statusDraft"),
    "Submitted for Review": t("statusSubmitted"),
    "Needs Documents": t("statusNeedsDocuments"),
    "Needs Applicant Clarification": t("statusNeedsClarification"),
    "In Navigator Review": t("statusInReview"),
    "Ready for Handoff": t("statusReadyForHandoff"),
    "Handed Off": t("statusHandedOff"),
    Closed: t("statusClosed"),
  };

  return (
    <div className="space-y-8 pb-24">
      {/* Current status */}
      <section aria-labelledby="status-heading">
        <h1 id="status-heading" className="mb-4 text-2xl font-semibold">
          {t("title")}
        </h1>

        <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
          <StatusPill status={status} label={statusLabels[status]} size="lg" />

          <p className="text-sm text-slate-500">
            {t(`statusDesc${statusLabelKey(status)}` as Parameters<typeof t>[0])}
          </p>

          {packet.updated_at && (
            <p className="text-xs text-slate-500">
              {t("lastUpdated", { date: new Date(packet.updated_at).toLocaleString() })}
            </p>
          )}

          {CONSENT_WITHDRAWABLE_STATUSES.has(status) && (
            <WithdrawConsentButton packetId={packet.id} />
          )}
        </div>
      </section>

      {/* CTA */}
      <PacketStatusCTA status={status} locale={locale} />

      {/* Timeline */}
      {displayHistory.length > 0 && (
        <section aria-labelledby="timeline-heading">
          <h2 id="timeline-heading" className="mb-4 text-lg font-semibold">
            {t("historyHeading")}
          </h2>
          <PacketTimeline entries={displayHistory} statusLabels={statusLabels} />
        </section>
      )}
    </div>
  );
}

// Consent can be withdrawn any time before the packet is handed off.
const CONSENT_WITHDRAWABLE_STATUSES = new Set<PacketStatus>([
  "Submitted for Review",
  "Needs Documents",
  "Needs Applicant Clarification",
  "In Navigator Review",
]);

// Maps PacketStatus to the i18n key suffix used in packet.* namespace
function statusLabelKey(status: PacketStatus): string {
  const map: Record<PacketStatus, string> = {
    Draft: "Draft",
    "Submitted for Review": "Submitted",
    "Needs Documents": "NeedsDocuments",
    "Needs Applicant Clarification": "NeedsClarification",
    "In Navigator Review": "InReview",
    "Ready for Handoff": "ReadyForHandoff",
    "Handed Off": "HandedOff",
    Closed: "Closed",
  };
  return map[status];
}
