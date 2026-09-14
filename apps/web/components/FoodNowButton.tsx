"use client";

// The "Need food this week?" control, as one component for both surfaces.
//
// It started inline in DemeterChat. Putting a second copy on /screen/ask would
// have meant two buttons, two pieces of dialog state and two aria contracts
// that agree only until someone edits one of them — and the thing they would
// drift on is the crisis path. One component, mounted twice.
//
// The button's styles are NOT scoped to .dmchat any more for the same reason:
// /screen/ask has no .dmchat ancestor, so a scoped rule would have rendered an
// unstyled button on the front door.

import { useState } from "react";
import type { AnswerLang } from "@civica/demeter-engine/packs";
import { DemeterFoodNow } from "./DemeterFoodNow";
import { FOODNOW_T } from "../lib/i18n/demeter-foodnow-copy";

export function FoodNowButton({ lang }: { lang: AnswerLang }) {
  const [open, setOpen] = useState(false);
  const c = FOODNOW_T[lang];

  return (
    <>
      <button
        type="button"
        className="demeter__foodnow"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-label={c.label}
      >
        {/* Full sentence where there is room, the short one where there is not.
            The aria-label carries the full one either way. */}
        <span className="demeter__foodnow-full">{c.label}</span>
        <span className="demeter__foodnow-short">{c.labelShort}</span>
      </button>
      {open && <DemeterFoodNow lang={lang} onClose={() => setOpen(false)} />}
    </>
  );
}
