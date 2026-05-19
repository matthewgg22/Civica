import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

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

/* ─── Phone mockup – inline SVG showing a SNAP question card ─── */
function AppMockup() {
  return (
    <svg
      viewBox="0 0 280 480"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      role="img"
      className="w-full max-w-[240px] drop-shadow-xl sm:max-w-[260px]"
    >
      {/* Phone shell */}
      <rect x="1" y="1" width="278" height="478" rx="32" fill="#FFFFFF" stroke="#E8E4DC" strokeWidth="1.5" />
      {/* Status bar notch */}
      <rect x="100" y="10" width="80" height="14" rx="7" fill="#F0EDE6" />
      {/* Progress bar track */}
      <rect x="20" y="44" width="240" height="4" rx="2" fill="#EBE8E1" />
      {/* Progress fill (teal, 60%) */}
      <rect x="20" y="44" width="144" height="4" rx="2" fill="#2A6F66" />
      {/* "Step 2 of 3" label */}
      <rect x="20" y="58" width="60" height="8" rx="2" fill="#D6D2CB" />
      <rect x="200" y="58" width="40" height="8" rx="2" fill="#D6D2CB" />
      {/* Question heading */}
      <rect x="20" y="84" width="200" height="12" rx="3" fill="#1A1714" />
      <rect x="20" y="102" width="160" height="10" rx="3" fill="#C8C4BC" />
      {/* Option card 1 – selected */}
      <rect x="20" y="126" width="240" height="56" rx="4" fill="rgba(156,58,36,0.07)" stroke="#9C3A24" strokeWidth="1.5" />
      <circle cx="42" cy="154" r="9" fill="#9C3A24" />
      <circle cx="42" cy="154" r="4" fill="#FFFFFF" />
      <rect x="62" y="148" width="100" height="8" rx="3" fill="#1A1714" />
      <rect x="62" y="162" width="72" height="7" rx="3" fill="#9E9790" />
      {/* Option card 2 */}
      <rect x="20" y="192" width="240" height="56" rx="4" fill="#FAFAF8" stroke="#E0DDD5" strokeWidth="1" />
      <circle cx="42" cy="220" r="9" fill="none" stroke="#C8C4BC" strokeWidth="1.5" />
      <rect x="62" y="214" width="120" height="8" rx="3" fill="#1A1714" />
      <rect x="62" y="228" width="80" height="7" rx="3" fill="#C8C4BC" />
      {/* Option card 3 */}
      <rect x="20" y="258" width="240" height="56" rx="4" fill="#FAFAF8" stroke="#E0DDD5" strokeWidth="1" />
      <circle cx="42" cy="286" r="9" fill="none" stroke="#C8C4BC" strokeWidth="1.5" />
      <rect x="62" y="280" width="90" height="8" rx="3" fill="#1A1714" />
      <rect x="62" y="294" width="110" height="7" rx="3" fill="#C8C4BC" />
      {/* Continue button */}
      <rect x="20" y="396" width="240" height="44" rx="3" fill="#9C3A24" />
      <rect x="100" y="415" width="80" height="8" rx="3" fill="rgba(255,255,255,0.85)" />
      {/* Bottom bar */}
      <rect x="100" y="456" width="80" height="5" rx="2.5" fill="#C8C4BC" />
    </svg>
  );
}

/* ─── Value prop icons – inline SVGs with more visual weight ─── */
function EstimateIcon() {
  return (
    <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-full w-full" aria-hidden="true">
      <rect width="48" height="48" rx="12" fill="rgba(156,58,36,0.08)" />
      <rect x="12" y="14" width="24" height="20" rx="3" fill="none" stroke="#9C3A24" strokeWidth="1.5" />
      <rect x="16" y="18" width="16" height="2.5" rx="1.25" fill="#9C3A24" />
      <rect x="16" y="23" width="10" height="2.5" rx="1.25" fill="#9C3A24" opacity="0.5" />
      <rect x="16" y="28" width="13" height="2.5" rx="1.25" fill="#9C3A24" opacity="0.5" />
      <circle cx="36" cy="34" r="7" fill="#2A6F66" />
      <path d="M33 34h6M36 31v6" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function ScanIcon() {
  return (
    <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-full w-full" aria-hidden="true">
      <rect width="48" height="48" rx="12" fill="rgba(156,58,36,0.08)" />
      <rect x="15" y="12" width="18" height="24" rx="4" fill="none" stroke="#9C3A24" strokeWidth="1.5" />
      <circle cx="24" cy="21" r="4" fill="none" stroke="#9C3A24" strokeWidth="1.5" />
      <rect x="20" y="28" width="8" height="2" rx="1" fill="#9C3A24" opacity="0.4" />
      <path d="M11 20v-4a2 2 0 0 1 2-2h4M33 14h4a2 2 0 0 1 2 2v4M11 28v4a2 2 0 0 0 2 2h4M33 34h4a2 2 0 0 0 2-2v-4" stroke="#2A6F66" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function NavigatorIcon() {
  return (
    <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-full w-full" aria-hidden="true">
      <rect width="48" height="48" rx="12" fill="rgba(156,58,36,0.08)" />
      <circle cx="18" cy="20" r="5" fill="none" stroke="#9C3A24" strokeWidth="1.5" />
      <path d="M10 34c0-4.418 3.582-8 8-8s8 3.582 8 8" stroke="#9C3A24" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="30" cy="20" r="5" fill="none" stroke="#9C3A24" strokeWidth="1.5" opacity="0.45" />
      <path d="M28 34c0-2.21.895-4.21 2.343-5.657" stroke="#9C3A24" strokeWidth="1.5" strokeLinecap="round" opacity="0.45" />
      <circle cx="38" cy="37" r="5" fill="#2A6F66" />
      <path d="M36 37h4M38 35v4" stroke="white" strokeWidth="1.25" strokeLinecap="round" />
    </svg>
  );
}

export default async function LandingPage({ params }: PageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "landing" });

  const valueProps = [
    { Icon: EstimateIcon, title: t("valueProps.card1.title"), body: t("valueProps.card1.body") },
    { Icon: ScanIcon, title: t("valueProps.card2.title"), body: t("valueProps.card2.body") },
    { Icon: NavigatorIcon, title: t("valueProps.card3.title"), body: t("valueProps.card3.body") },
  ];

  const steps = [1, 2, 3, 4].map((n) => ({
    n,
    title: t(`howItWorks.step${n}.title`),
    body: t(`howItWorks.step${n}.body`),
  }));

  return (
    <main className="bg-paper text-ink">

      {/* ── Hero ─────────────────────────────────────── */}
      <header className="relative overflow-hidden border-b border-hairline">
        {/* Warm radial blush behind hero */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 800px 500px at 70% -20%, rgba(156,58,36,0.12), transparent 60%)",
          }}
        />

        <div className="relative mx-auto w-full max-w-5xl px-4 pt-5 pb-0 sm:pt-6">
          {/* Nav */}
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

          {/* Hero body – two-column on md+ */}
          <div className="mt-10 flex flex-col gap-10 pb-12 sm:mt-14 md:flex-row md:items-end md:gap-16 md:pb-0">
            {/* Left: copy + CTAs */}
            <div className="flex-1">
              <p className="eyebrow mb-3">CalFresh / SNAP</p>
              <h1 className="text-4xl font-semibold leading-tight tracking-tight sm:text-5xl sm:leading-[1.1]">
                {t("hero.headline")}
              </h1>
              <p className="mt-4 max-w-lg text-base text-graphite sm:text-lg">
                {t("hero.subheadline")}
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  href={`/${locale}/app/onboarding`}
                  className="inline-flex items-center justify-center rounded-[3px] bg-brick px-6 py-3 text-base font-medium text-white hover:bg-brick-pressed motion-safe:transition-transform motion-safe:hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brick focus-visible:ring-offset-2"
                >
                  {t("hero.ctaPrimary")}
                </Link>
                <Link
                  href={`/${locale}/sign-in`}
                  className="inline-flex items-center justify-center rounded-[3px] border border-hairline bg-surface px-6 py-3 text-base font-medium text-ink hover:bg-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brick focus-visible:ring-offset-2"
                >
                  {t("hero.ctaSecondary")}
                </Link>
              </div>
              {/* Mini trust nudge */}
              <p className="mt-5 text-xs text-graphite">
                Free to use · No SSN required to check eligibility
              </p>
            </div>

            {/* Right: phone mockup */}
            <div className="flex justify-center md:justify-end md:self-end md:pr-4">
              <AppMockup />
            </div>
          </div>
        </div>
      </header>

      {/* ── Value props ──────────────────────────────── */}
      <section
        aria-labelledby="value-props-heading"
        className="mx-auto w-full max-w-5xl px-4 py-16 sm:py-20"
      >
        <p className="eyebrow">{t("valueProps.eyebrow")}</p>
        <h2 id="value-props-heading" className="mt-2 text-2xl font-semibold sm:text-3xl">
          {t("valueProps.heading")}
        </h2>

        <ul className="mt-10 grid gap-6 sm:grid-cols-3">
          {valueProps.map(({ Icon, title, body }) => (
            <li key={title}>
              <article className="flex h-full flex-col gap-4 rounded-[4px] border border-hairline bg-surface p-6">
                <div className="h-12 w-12">
                  <Icon />
                </div>
                <div>
                  <h3 className="text-base font-semibold">{title}</h3>
                  <p className="mt-1 text-sm text-graphite">{body}</p>
                </div>
              </article>
            </li>
          ))}
        </ul>
      </section>

      {/* ── How it works – brick tint band ───────────── */}
      <section
        aria-labelledby="how-it-works-heading"
        className="border-y border-hairline"
        style={{ background: "linear-gradient(135deg, rgba(156,58,36,0.04) 0%, rgba(42,111,102,0.04) 100%)" }}
      >
        <div className="mx-auto w-full max-w-5xl px-4 py-16 sm:py-20">
          <p className="eyebrow">{t("howItWorks.eyebrow")}</p>
          <h2 id="how-it-works-heading" className="mt-2 text-2xl font-semibold sm:text-3xl">
            {t("howItWorks.heading")}
          </h2>

          <ol className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map(({ n, title, body }) => (
              <li key={n} className="flex flex-col items-start gap-3 rounded-[4px] bg-surface border border-hairline p-5">
                <span
                  aria-hidden="true"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brick text-sm font-semibold text-white"
                >
                  {n}
                </span>
                <div>
                  <h3 className="text-base font-semibold">{title}</h3>
                  <p className="mt-1 text-sm text-graphite">{body}</p>
                </div>
              </li>
            ))}
          </ol>

          <div className="mt-10">
            <Link
              href={`/${locale}/app/onboarding`}
              className="inline-flex items-center justify-center rounded-[3px] bg-brick px-6 py-3 text-base font-medium text-white hover:bg-brick-pressed motion-safe:transition-transform motion-safe:hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brick focus-visible:ring-offset-2"
            >
              {t("hero.ctaPrimary")}
            </Link>
          </div>
        </div>
      </section>

      {/* ── Trust strip ──────────────────────────────── */}
      <section aria-label={t("trust.rulesEngine")}>
        <div className="mx-auto w-full max-w-5xl px-4 py-8">
          <ul className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-graphite">
            <li>
              {/* External: USDA FNS SNAP eligibility rules */}
              <a
                href="https://www.fns.usda.gov/snap/eligibility"
                target="_blank"
                rel="noopener noreferrer"
                className="underline decoration-hairline underline-offset-2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brick focus-visible:ring-offset-2"
              >
                {t("trust.rulesEngine")}
              </a>
            </li>
            <li aria-hidden="true">·</li>
            <li>
              {/* External: CDSS CalFresh program page */}
              <a
                href="https://www.cdss.ca.gov/food-and-nutrition/calfresh"
                target="_blank"
                rel="noopener noreferrer"
                className="underline decoration-hairline underline-offset-2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brick focus-visible:ring-offset-2"
              >
                {t("trust.stateCdss")}
              </a>
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
              {/* No linkable internal page for WCAG statement yet */}
              <span>{t("trust.wcag")}</span>
            </li>
          </ul>
        </div>
      </section>
    </main>
  );
}
