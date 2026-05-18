import { getTranslations } from "next-intl/server";

// Privacy policy + CCPA "Do Not Sell or Share My Personal Information"
// disclosure. The #do-not-sell anchor satisfies CCPA §1798.135's
// requirement that the link appear on any internet property where
// personal information is collected.
//
// All copy is translated; both English and Spanish ship at v1.

export default async function PrivacyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "privacy" });

  return (
    <main
      id="main-content"
      className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 text-zinc-900"
      tabIndex={-1}
    >
      <h1 className="text-3xl font-semibold tracking-tight">{t("title")}</h1>
      <p className="mt-2 text-sm text-zinc-600">{t("effectiveDate")}</p>

      <section className="mt-8 space-y-4">
        <h2 className="text-xl font-semibold">{t("collectHeading")}</h2>
        <p className="text-zinc-700">{t("collectBody")}</p>
      </section>

      <section className="mt-8 space-y-4">
        <h2 className="text-xl font-semibold">{t("useHeading")}</h2>
        <p className="text-zinc-700">{t("useBody")}</p>
      </section>

      <section className="mt-8 space-y-4">
        <h2 className="text-xl font-semibold">{t("rightsHeading")}</h2>
        <p className="text-zinc-700">{t("rightsBody")}</p>
        <p className="text-zinc-700">
          {t("rightsContact")}{" "}
          <a
            href={`mailto:${t("contactEmail")}`}
            className="underline decoration-zinc-400 underline-offset-2 hover:text-zinc-900"
          >
            {t("contactEmail")}
          </a>
          .
        </p>
      </section>

      <section id="do-not-sell" className="mt-8 space-y-4 scroll-mt-16">
        <h2 className="text-xl font-semibold">{t("doNotSellHeading")}</h2>
        <p className="text-zinc-700">{t("doNotSellBody")}</p>
        <p className="text-zinc-700">
          {t("doNotSellContact")}{" "}
          <a
            href={`mailto:${t("contactEmail")}`}
            className="underline decoration-zinc-400 underline-offset-2 hover:text-zinc-900"
          >
            {t("contactEmail")}
          </a>
          .
        </p>
      </section>

      <section className="mt-8 space-y-4">
        <h2 className="text-xl font-semibold">{t("childrenHeading")}</h2>
        <p className="text-zinc-700">{t("childrenBody")}</p>
      </section>
    </main>
  );
}
