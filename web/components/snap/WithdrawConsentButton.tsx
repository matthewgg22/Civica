"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { withdrawConsent } from "@/lib/api/actions";

type Props = {
  packetId: string;
};

export function WithdrawConsentButton({ packetId }: Props) {
  const t = useTranslations("consent");
  const tc = useTranslations("common");
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      const result = await withdrawConsent(packetId);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        {t("withdraw")}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogTitle>{t("withdraw")}</DialogTitle>
          <p className="text-sm text-graphite">{t("withdrawConfirm")}</p>
          {error && (
            <p role="alert" className="text-sm text-red-600">
              {tc("error")}
            </p>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={isPending}>
              {tc("cancel")}
            </Button>
            <Button variant="destructive" onClick={handleConfirm} disabled={isPending}>
              {isPending ? tc("loading") : t("withdraw")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
