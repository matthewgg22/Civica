"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { InboxItemCard } from "@/components/snap/InboxItemCard";
import type { components } from "@/lib/api/types";

type InboxItem = components["schemas"]["InboxItem"];

type Props = { initialItems: InboxItem[] };

export function InboxList({ initialItems }: Props) {
  const t = useTranslations("inbox");
  const [items, setItems] = useState(initialItems);

  const open = items.filter((i) => !i.resolved);
  const resolved = items.filter((i) => i.resolved);

  function handleResolved(id: string) {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, resolved: true } : item))
    );
  }

  if (items.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="text-2xl" aria-hidden="true">✉️</p>
        <p className="mt-2 text-graphite">{t("empty")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {open.length > 0 && (
        <section aria-labelledby="inbox-open-heading">
          <h2 id="inbox-open-heading" className="mb-3 text-sm font-semibold uppercase tracking-wide text-graphite">
            {t("openSection", { count: open.length })}
          </h2>
          <ul className="space-y-3">
            {open.map((item) => (
              <InboxItemCard key={item.id} item={item} onResolved={handleResolved} />
            ))}
          </ul>
        </section>
      )}

      {resolved.length > 0 && (
        <section aria-labelledby="inbox-resolved-heading">
          <h2 id="inbox-resolved-heading" className="mb-3 text-sm font-semibold uppercase tracking-wide text-graphite">
            {t("resolvedSection", { count: resolved.length })}
          </h2>
          <ul className="space-y-3">
            {resolved.map((item) => (
              <InboxItemCard key={item.id} item={item} onResolved={handleResolved} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
