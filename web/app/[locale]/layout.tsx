import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/lib/i18n/routing";
import { DevA11yAudit } from "@/components/DevA11yAudit";
import { Footer } from "@/components/layout/Footer";
import "../globals.css";

const SITE_NAME = "Civica";
const DEFAULT_TITLE = "Civica SNAP — Prepare your application";
const DEFAULT_DESCRIPTION_EN =
  "Civica helps you prepare your SNAP application packet.";
const DEFAULT_DESCRIPTION_ES =
  "Civica te ayuda a preparar tu paquete de solicitud de SNAP.";
const OG_IMAGE = "/og-image.png";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const isEs = locale === "es";
  const ogLocale = isEs ? "es_US" : "en_US";
  const description = isEs ? DEFAULT_DESCRIPTION_ES : DEFAULT_DESCRIPTION_EN;

  return {
    title: {
      default: DEFAULT_TITLE,
      template: `%s | ${SITE_NAME}`,
    },
    description,
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      title: DEFAULT_TITLE,
      description,
      locale: ogLocale,
      images: [
        {
          url: OG_IMAGE,
          width: 1200,
          height: 630,
          alt: SITE_NAME,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: DEFAULT_TITLE,
      description,
      images: [OG_IMAGE],
    },
  };
}

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
      <body className="min-h-full flex flex-col bg-paper text-ink font-sans">
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
