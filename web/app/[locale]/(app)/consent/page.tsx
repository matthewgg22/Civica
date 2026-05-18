import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createSupabaseServerClient } from "@/lib/auth/supabase-server";
import { getMe, getOrCreatePacket, getReadiness } from "@/lib/api/actions";
import { ConsentForm } from "./_components/ConsentForm";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "consent" });
  return { title: t("title") };
}

export default async function ConsentPage({ params }: Props) {
  const { locale } = await params;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
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
      <div className="py-8 text-center text-graphite">
        {tc("loadError")}
      </div>
    );
  }

  const packet = packetResult.data;

  // Closed packets cannot be re-submitted
  if (packet.status === "Closed") {
    redirect(`/${locale}/app/packet`);
  }

  // Already submitted — no need to consent again
  if (
    packet.status === "Submitted for Review" ||
    packet.status === "In Navigator Review" ||
    packet.status === "Ready for Handoff" ||
    packet.status === "Handed Off"
  ) {
    redirect(`/${locale}/app/packet`);
  }

  const readiness = await getReadiness(packet.id);
  const t = await getTranslations({ locale, namespace: "consent" });

  return (
    <div className="space-y-6 pb-24">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      <ConsentForm packetId={packet.id} locale={locale} readiness={readiness} />
    </div>
  );
}
