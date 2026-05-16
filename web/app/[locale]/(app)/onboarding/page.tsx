import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createSupabaseServerClient } from "@/lib/auth/supabase-server";
import { getMe } from "@/lib/api/actions";
import { OnboardingFlow } from "./_components/OnboardingFlow";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "onboarding" });
  return { title: t("selectState") };
}

export default async function OnboardingPage({ params }: Props) {
  const { locale } = await params;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/sign-in`);

  // Fetch current profile to pre-fill / skip if already complete
  const profileResult = await getMe();
  const profile = profileResult.success ? profileResult.data : null;

  // Already onboarded → go straight to packet
  if (profile?.state_code && profile?.language) {
    redirect(`/${profile.language}/app/packet`);
  }

  const t = await getTranslations({ locale, namespace: "onboarding" });

  return (
    <div className="mx-auto max-w-md py-8">
      <h1 className="mb-8 text-2xl font-semibold">
        {t("selectState")}
      </h1>
      <OnboardingFlow
        locale={locale}
        initialState={profile?.state_code ?? null}
        initialLanguage={profile?.language ?? null}
      />
    </div>
  );
}
