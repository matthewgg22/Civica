"use client";

import { useEffect, useState } from "react";
import { notFound } from "next/navigation";
import { use } from "react";
import { ApplyWizard } from "../../../components/ApplyWizard";
import { SECTION_IDS, type SectionId } from "../../../lib/snap/sections";
import { STORAGE_KEY, type Locale } from "../../i18n";

export default function ApplySectionPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = use(params);
  const [locale, setLocale] = useState<Locale>("en");

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved === "en" || saved === "es") setLocale(saved);
    } catch {
      // ignore
    }
  }, []);

  if (!(SECTION_IDS as readonly string[]).includes(section)) {
    notFound();
  }

  return <ApplyWizard section={section as SectionId} locale={locale} />;
}
