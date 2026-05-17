"use client";

import { useRouter } from "next/navigation";

type Props = { label: string; fallbackHref: string };

export function CloseTabButton({ label, fallbackHref }: Props) {
  const router = useRouter();

  function handleClick() {
    // If the tab was opened by window.open(), window.close() works.
    // Otherwise fall back to navigating to the application.
    if (window.opener) {
      window.close();
    } else {
      router.push(fallbackHref);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="w-full rounded-xl border border-slate-300 bg-white py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2"
    >
      {label}
    </button>
  );
}
