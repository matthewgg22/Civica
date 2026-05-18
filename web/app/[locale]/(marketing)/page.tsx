import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Calculator, Camera, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FadeInOnScroll } from "./_components/FadeInOnScroll";

type PageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "landing" });
  return {
    title: `Civica — ${t("hero.headline")}`,
    description: t("hero.subheadline"),
    openGraph: {
      title: `Civica — ${t("hero.headline")}`,
      description: t("hero.subheadline"),
      type: "website",
    },
  };
}

export default async function LandingPage({ params }: PageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "landing" });

  const valueProps = [
    { Icon: Calculator, title: t("valueProps.card1.title"), body: t("valueProps.card1.body") },
    { Icon: Camera, title: t("valueProps.card2.title"), body: t("valueProps.card2.body") },
    { Icon: Users, title: t("valueProps.card3.title"), body: t("valueProps.card3.body") },
  ];

  const steps = [1, 2, 3, 4].map((n) => ({
    n,
    title: t(`howItWorks.step${n}.title`),
    body: t(`howItWorks.step${n}.body`),
  }));

  return (
    <main className="bg-paper text-ink">
      {/* Hero */}
      <header
        className="relative overflow-hidden"
        style={{
          background:
            "radial-gradient(1100px 520px at 50% -10%, rgba(156, 58, 36, 0.10), transparent 60%), #F5F2EC",
        }}
      >
        <div className="mx-auto w-full max-w-3xl px-4 pb-16 pt-12 sm:pt-20 sm:pb-24">
          <div className="flex items-center justify-between">
            <Image
              src="/civica-wordmark.svg"
              alt={t("hero.wordmarkAlt")}
              width={120}
              height={32}
              priority
              className="h-7 w-auto"
              style={{ width: "auto" }}
            />
            <nav aria-label="Sign in" className="text-sm">
              <Link
                href={`/${locale}/sign-in`}
                className="text-graphite underline-offset-2 hover:text-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brick focus-visible:ring-offset-2"
              >
                {t("hero.ctaSecondary")}
              </Link>
            </nav>
          </div>

          <h1 className="mt-12 text-4xl font-semibold leading-tight tracking-tight sm:text-5xl sm:leading-[1.1]">
            {t("hero.headline")}
          </h1>
          <p className="mt-5 max-w-2xl text-base text-graphite sm:text-lg">
            {t("hero.subheadline")}
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href={`/${locale}/app/onboarding`}
              className="inline-flex items-center justify-center rounded-[3px] bg-brick px-6 py-3 text-base font-medium text-white motion-safe:transition-transform motion-safe:hover:scale-[1.02] hover:bg-brick-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brick focus-visible:ring-offset-2"
            >
              {t("hero.ctaPrimary")}
            </Link>
            <Button asChild variant="outline" size="lg" className="rounded-[3px]">
              <Link href={`/${locale}/sign-in`}>{t("hero.ctaSecondary")}</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Value props */}
      <section
        aria-labelledby="value-props-heading"
        className="mx-auto w-full max-w-3xl px-4 py-16 sm:py-20"
      >
        <p className="eyebrow">{t("valueProps.eyebrow")}</p>
        <h2 id="value-props-heading" className="mt-2 text-2xl font-semibold sm:text-3xl">
          {t("valueProps.heading")}
        </h2>

        <ul className="mt-8 grid gap-6 md:grid-cols-3">
          {valueProps.map(({ Icon, title, body }, i) => (
            <li key={title}>
              <FadeInOnScroll delayMs={i * 80}>
                <article className="h-full space-y-3 rounded-[4px] border border-hairline bg-surface p-6">
                  <div className="flex h-12 w-12 items-center justify-center rounded-[4px] bg-brick/8 text-brick">
                    <Icon aria-hidden="true" className="h-6 w-6" />
                  </div>
                  <h3 className="text-lg font-semibold">{title}</h3>
                  <p className="text-sm text-graphite">{body}</p>
                </article>
              </FadeInOnScroll>
            </li>
          ))}
        </ul>
      </section>

      {/* How it works */}
      <section
        aria-labelledby="how-it-works-heading"
        className="border-t border-hairline bg-surface"
      >
        <div className="mx-auto w-full max-w-3xl px-4 py-16 sm:py-20">
          <p className="eyebrow">{t("howItWorks.eyebrow")}</p>
          <h2 id="how-it-works-heading" className="mt-2 text-2xl font-semibold sm:text-3xl">
            {t("howItWorks.heading")}
          </h2>

          <ol className="mt-8 space-y-6">
            {steps.map(({ n, title, body }) => (
              <li key={n} className="flex gap-4">
                <span
                  aria-hidden="true"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brick font-semibold text-white"
                >
                  {n}
                </span>
                <div className="pt-1">
                  <h3 className="text-base font-semibold">{title}</h3>
                  <p className="mt-1 text-sm text-graphite">{body}</p>
                </div>
              </li>
            ))}
          </ol>

          <div className="mt-10">
            <Link
              href={`/${locale}/app/onboarding`}
              className="inline-flex items-center justify-center rounded-[3px] bg-brick px-6 py-3 text-base font-medium text-white motion-safe:transition-transform motion-safe:hover:scale-[1.02] hover:bg-brick-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brick focus-visible:ring-offset-2"
            >
              {t("hero.ctaPrimary")}
            </Link>
          </div>
        </div>
      </section>

      {/* Trust strip */}
      <section
        aria-label={t("trust.rulesEngine")}
        className="border-t border-hairline"
      >
        <div className="mx-auto w-full max-w-3xl px-4 py-8">
          <ul className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-graphite">
            <li>
              <Link
                href={`/${locale}/privacy`}
                className="underline decoration-hairline underline-offset-2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brick focus-visible:ring-offset-2"
              >
                {t("trust.rulesEngine")}
              </Link>
            </li>
            <li aria-hidden="true">·</li>
            <li>
              <Link
                href={`/${locale}/app/onboarding`}
                className="underline decoration-hairline underline-offset-2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brick focus-visible:ring-offset-2"
              >
                {t("trust.stateCdss")}
              </Link>
            </li>
            <li aria-hidden="true">·</li>
            <li>
              <Link
                href={`/${locale}/privacy#do-not-sell`}
                className="underline decoration-hairline underline-offset-2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brick focus-visible:ring-offset-2"
              >
                {t("trust.ccpa")}
              </Link>
            </li>
            <li aria-hidden="true">·</li>
            <li>
              <Link
                href={`/${locale}/privacy`}
                className="underline decoration-hairline underline-offset-2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brick focus-visible:ring-offset-2"
              >
                {t("trust.wcag")}
              </Link>
            </li>
          </ul>
        </div>
      </section>
    </main>
  );
}
