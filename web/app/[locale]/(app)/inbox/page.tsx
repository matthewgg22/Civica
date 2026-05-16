import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createSupabaseServerClient } from "@/lib/auth/supabase-server";
import { listInboxItems } from "@/lib/api/actions";
import { InboxList } from "./_components/InboxList";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "inbox" });
  return { title: t("title") };
}

export default async function InboxPage({ params }: Props) {
  const { locale } = await params;

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/sign-in`);

  const result = await listInboxItems();
  const items = result.success ? result.data : [];

  const t = await getTranslations({ locale, namespace: "inbox" });
  const openCount = items.filter((i) => !i.resolved).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        {openCount > 0 && (
          <span
            className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-red-600 px-1.5 text-xs font-bold text-white"
            aria-label={`${openCount} open requests`}
          >
            {openCount}
          </span>
        )}
      </div>

      <InboxList initialItems={items} />
    </div>
  );
}
