import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createSupabaseServerClient } from "@/lib/auth/supabase-server";
import { getMe, getOrCreatePacket, getQuestions, getAnswers } from "@/lib/api/actions";
import { QuestionFlow } from "./_components/QuestionFlow";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "questions" });
  return { title: t("sectionHousehold") };
}

export default async function QuestionsPage({ params }: Props) {
  const { locale } = await params;

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/sign-in`);

  // Profile check
  const profileResult = await getMe();
  const profile = profileResult.success ? profileResult.data : null;
  if (!profile?.state_code || !profile?.language) {
    redirect(`/${locale}/app/onboarding`);
  }

  // Get or create packet
  const packetResult = await getOrCreatePacket(profile.state_code as "CA" | "MA");
  if (!packetResult.success) {
    // Non-fatal: render empty state
    return (
      <div className="py-8 text-center text-slate-500">
        Unable to load your application. Please try again.
      </div>
    );
  }
  const packet = packetResult.data;

  // Fetch questions and saved answers in parallel
  const [questionsResult, answersResult] = await Promise.all([
    getQuestions(packet.id),
    getAnswers(packet.id),
  ]);

  const sections = questionsResult.success ? questionsResult.data : [];
  const savedAnswers = answersResult.success ? answersResult.data : [];

  const t = await getTranslations({ locale, namespace: "questions" });

  return (
    <div className="pb-24">
      <h1 className="mb-6 text-2xl font-semibold">{t("sectionHousehold")}</h1>
      {sections.length === 0 ? (
        <p className="text-slate-500">No questions available yet.</p>
      ) : (
        <QuestionFlow
          packetId={packet.id}
          locale={locale}
          sections={sections}
          initialAnswers={savedAnswers}
        />
      )}
    </div>
  );
}
