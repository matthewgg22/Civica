import type { ReactNode } from "react";
import { LANG_TAG, isAnswerLang, type AnswerLang } from "@civica/demeter-engine/packs";
import { HtmlLang } from "./HtmlLang";

// Localized-subtree layout (/es, /vi, /zh). Its job is language, not chrome:
//   - the wrapper carries `lang` for the SSR content (WCAG 3.1.2, language of
//     parts) — display:contents so it adds no box and cannot affect layout;
//   - HtmlLang fixes <html lang> at runtime (WCAG 3.1.1), which the root layout
//     hardcodes to "en".
// A bad segment falls back to "en" rather than mislabeling the content.
export default async function LangLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const tag = isAnswerLang(lang) ? LANG_TAG[lang as AnswerLang] : "en";
  return (
    <div lang={tag} style={{ display: "contents" }}>
      <HtmlLang tag={tag} />
      {children}
    </div>
  );
}
