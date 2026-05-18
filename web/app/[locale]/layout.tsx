import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/lib/i18n/routing";
import { DevA11yAudit } from "@/components/DevA11yAudit";
import { Footer } from "@/components/layout/Footer";
import "../globals.css";

export const metadata: Metadata = {
  title: "Civica SNAP — Prepare your application",
  description: "Civica helps you prepare your SNAP application packet.",
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!routing.locales.includes(locale as "en" | "es")) {
    notFound();
  }

  const messages = await getMessages();
  const resolvedLocale = await getLocale();
  const tFooter = await getTranslations({ locale: resolvedLocale, namespace: "footer" });

  return (
    <html lang={resolvedLocale} className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-white text-zinc-900 font-sans">
        <NextIntlClientProvider locale={resolvedLocale} messages={messages}>
          <div className="flex-1">{children}</div>
          <Footer
            locale={resolvedLocale}
            privacyLabel={tFooter("privacy")}
            doNotSellLabel={tFooter("doNotSell")}
          />
          <DevA11yAudit />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
