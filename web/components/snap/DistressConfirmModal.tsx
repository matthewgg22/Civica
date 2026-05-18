"use client";

import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type Props = {
  open: boolean;
  onContinue: () => void;
  onResources: () => void;
};

export function DistressConfirmModal({ open, onContinue, onResources }: Props) {
  const t = useTranslations("questions");

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onContinue(); }}>
      <DialogContent
        className="mx-4"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{t("distressTitle")}</DialogTitle>
          <DialogDescription className="pt-2 text-base text-ink">
            {t("distressBody")}
          </DialogDescription>
        </DialogHeader>

        <div className="mt-6 flex flex-col gap-3">
          <Button className="w-full" size="lg" onClick={onContinue}>
            {t("distressContinue")}
          </Button>
          <Button variant="outline" className="w-full" size="lg" onClick={onResources}>
            {t("distressResources")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
