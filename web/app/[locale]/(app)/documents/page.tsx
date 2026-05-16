import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createSupabaseServerClient } from "@/lib/auth/supabase-server";
import { getMe, getOrCreatePacket, listDocuments } from "@/lib/api/actions";
import { DocumentChecklist } from "./_components/DocumentChecklist";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "documents" });
  return { title: t("title") };
}

export default async function DocumentsPage({ params }: Props) {
  const { locale } = await params;

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/sign-in`);

  const profileResult = await getMe();
  const profile = profileResult.success ? profileResult.data : null;
  if (!profile?.state_code || !profile?.language) {
    redirect(`/${locale}/app/onboarding`);
  }

  const packetResult = await getOrCreatePacket(profile.state_code as "CA" | "MA");
  if (!packetResult.success) {
    return (
      <div className="py-8 text-center text-slate-500">
        Unable to load your application. Please try again.
      </div>
    );
  }

  const documentsResult = await listDocuments(packetResult.data.id);
  const documents = documentsResult.success ? documentsResult.data : [];

  const t = await getTranslations({ locale, namespace: "documents" });

  return (
    <div className="space-y-6 pb-24">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      <DocumentChecklist
        packetId={packetResult.data.id}
        initialItems={documents}
      />
    </div>
  );
}
