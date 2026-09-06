"use client";

import { useEffect } from "react";

// Sets the authoritative document language for the localized (/es, /vi, /zh)
// subtree. The root layout renders <html lang="en"> and only that element can
// carry the page language attribute in the App Router, so a Spanish page
// otherwise tells every screen reader it is English (WCAG 3.1.1). This corrects
// it at runtime and restores the previous value on navigation away.
export function HtmlLang({ tag }: { tag: string }) {
  useEffect(() => {
    const prev = document.documentElement.lang;
    document.documentElement.lang = tag;
    return () => {
      document.documentElement.lang = prev;
    };
  }, [tag]);
  return null;
}
