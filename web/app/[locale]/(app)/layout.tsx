import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createSupabaseServerClient } from "@/lib/auth/supabase-server";
import { listInboxItems } from "@/lib/api/actions";
import { AppShell } from "@/components/layout/AppShell";

type Props = { children: React.ReactNode; params: Promise<{ locale: string }> };

export default async function AppLayout({ children, params }: Props) {
  const { locale } = await params;

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/sign-in`);

  // Fetch inbox unread count — non-blocking; default to 0 on error
  const inboxResult = await listInboxItems().catch(() => null);
  const inboxUnreadCount = inboxResult?.success
    ? inboxResult.data.filter((i) => !i.resolved).length
    : 0;

  const t = await getTranslations({ locale, namespace: "common" });
  const tQ = await getTranslations({ locale, namespace: "questions" });
  const tD = await getTranslations({ locale, namespace: "documents" });
  const tI = await getTranslations({ locale, namespace: "inbox" });
  const tP = await getTranslations({ locale, namespace: "packet" });

  return (
    <AppShell
      locale={locale}
      disclaimer={t("disclaimer")}
      signOutLabel={t("signOut")}
      inboxUnreadCount={inboxUnreadCount}
      navLabels={{
        questions: tQ("sectionHousehold"),
        documents: tD("title"),
        inbox: tI("title"),
        packet: tP("title"),
      }}
    >
      {children}
    </AppShell>
  );
}
