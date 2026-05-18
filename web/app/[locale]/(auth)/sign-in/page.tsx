import { getTranslations } from "next-intl/server";
import { SignInForm } from "./_components/SignInForm";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "auth" });
  return { title: t("signIn") };
}

export default async function SignInPage({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "common" });

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm space-y-8">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Civica SNAP</h1>
        </div>

        <SignInForm locale={locale} />

        <p className="px-4 text-center text-xs text-graphite">{t("disclaimer")}</p>
      </div>
    </main>
  );
}
