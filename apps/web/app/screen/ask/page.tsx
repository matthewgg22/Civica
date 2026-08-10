// /screen/ask — the canonical English entry page, and the page the whole
// product is judged on. Structure:
//
//   lede  →  chat  →  depth  →  JSON-LD
//
// The lede explains SNAP before the page asks for input; the chat sits high
// enough to still be the product; the depth below carries the legitimacy and
// GEO weight. Everything except the chat is server-rendered, because content
// that only exists after hydration is content a generative search engine never
// sees — and being quotable BY those engines is an explicit goal here.
//
// English stays UN-PREFIXED. The localized pages live at /es|/vi|/zh/screen/ask
// (app/[lang]/screen/ask), and every page in the set carries the reciprocal
// hreflang annotations — a one-directional hreflang set is silently ignored.

import type { Metadata } from "next";
import { VERIFIED_STATES } from "@civica/demeter-engine/packs";
import { DemeterChat } from "../../../components/DemeterChat";
import { SnapLede, SnapDetail } from "../../../components/SnapOverview";
import { alternateLanguages, askUrl } from "../../../lib/i18n/routes";
import { askStructuredData, EN_TITLE, EN_DESCRIPTION } from "./structured-data";

export const metadata: Metadata = {
  title: EN_TITLE,
  description: EN_DESCRIPTION,
  alternates: { canonical: askUrl("en"), languages: alternateLanguages() },
  openGraph: { title: EN_TITLE, description: EN_DESCRIPTION, type: "website", locale: "en" },
};

export default async function ScreenAskPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string; q?: string }>;
}) {
  const { state, q } = await searchParams;
  const initialState =
    state && VERIFIED_STATES.some((s) => s.code === state.toUpperCase())
      ? state.toUpperCase()
      : null;

  return (
    <main className="dmpage">
      <div className="dmpage__inner">
        <SnapLede states={VERIFIED_STATES} />
        <div className="dmpage__chat">
          <DemeterChat
            states={VERIFIED_STATES}
            initialState={initialState}
            initialQuestion={q ?? null}
          />
        </div>
        <SnapDetail states={VERIFIED_STATES} />
      </div>
      <script
        type="application/ld+json"
        // Built from server-side literals — no user input reaches this, so
        // there is no injection surface.
        dangerouslySetInnerHTML={{
          __html: askStructuredData("en", "Demeter AI", EN_DESCRIPTION),
        }}
      />
    </main>
  );
}
