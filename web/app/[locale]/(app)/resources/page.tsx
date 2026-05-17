import { getTranslations } from "next-intl/server";
import { CloseTabButton } from "./_components/CloseTabButton";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "resources" });
  return { title: t("title") };
}

export default async function ResourcesPage({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "resources" });

  const resources = [
    {
      title: t("call211Title"),
      body: t("call211Body"),
      action: { label: "2-1-1", href: "tel:211" },
    },
    {
      title: t("snapHotlineTitle"),
      body: t("snapHotlineBody"),
    },
    {
      title: t("foodBankTitle"),
      body: t("foodBankBody"),
    },
  ];

  return (
    <div className="space-y-8 pb-24">
      <div>
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="mt-2 text-sm text-slate-600">{t("intro")}</p>
      </div>

      <ul className="space-y-4">
        {resources.map((r) => (
          <li
            key={r.title}
            className="rounded-xl border border-slate-200 bg-white p-5 space-y-2"
          >
            <h2 className="font-semibold text-slate-900">{r.title}</h2>
            <p className="text-sm text-slate-600 leading-relaxed">{r.body}</p>
            {r.action && (
              <a
                href={r.action.href}
                className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2"
              >
                {r.action.label}
              </a>
            )}
          </li>
        ))}
      </ul>

      <CloseTabButton label={t("backToApp")} fallbackHref={`/${locale}/app/questions`} />
    </div>
  );
}
