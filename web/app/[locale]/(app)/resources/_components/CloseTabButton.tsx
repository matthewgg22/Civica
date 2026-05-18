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
      className="w-full rounded-xl border border-hairline bg-surface py-3 text-sm font-medium text-ink hover:bg-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brick focus-visible:ring-offset-2"
    >
      {label}
    </button>
  );
}
