"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { STORAGE_KEY, type Locale } from "../../i18n";
import { snapT } from "../../../lib/i18n/snap-copy";

// useSearchParams() bails out of static rendering — without a Suspense
// boundary, Next 16 fails the static-page generation pass. Wrapping the
// inner component lets the shell pre-render while the search-param read
// happens client-side after hydration.
export default function NextStepsPage() {
  return (
    <Suspense fallback={<div className="next-steps">…</div>}>
      <NextStepsContent />
    </Suspense>
  );
}

function NextStepsContent() {
  const search = useSearchParams();
  const packetId = search.get("packet") ?? "";
  const [locale, setLocale] = useState<Locale>("en");

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved === "en" || saved === "es") setLocale(saved);
    } catch { /* ignore */ }
  }, []);

  return (
    <div className="next-steps">
      <h1 className="next-steps__title">{snapT(locale, "next_steps_title")}</h1>
      <p className="next-steps__body">{snapT(locale, "next_steps_body")}</p>
      {packetId && (
        <p className="next-steps__packet-id">
          {snapT(locale, "confirmation_packet_id")}: <code>{packetId}</code>
        </p>
      )}
      <div className="next-steps__ctas">
        {packetId && (
          <Link href={`/documents/${encodeURIComponent(packetId)}`} className="wizard__continue">
            {snapT(locale, "upload_title")}
          </Link>
        )}
        <Link href="/status" className="wizard__back">
          {snapT(locale, "confirmation_view_status")}
        </Link>
      </div>
    </div>
  );
}
