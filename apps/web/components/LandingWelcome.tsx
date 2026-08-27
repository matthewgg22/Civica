"use client";

// The first-visit card on the LANDING page (owner, 2026-08-26).
//
// WHY IT BELONGS HERE MORE THAN ON /chat. The bare domain redirects to
// /screen/ask, so this is the door almost everyone comes through — and the
// card only existed on /chat, the smaller door. Someone arriving at the front
// of the product was the one person who never met the definition of SNAP or
// the line saying this is not the government.
//
// IT IS THE SAME CARD AND THE SAME KEY. lib/welcome-seen is shared with
// DemeterChat, so dismissing it on either surface dismisses it on both.
// Being introduced twice, once per door, is precisely what a "first visit"
// card must not do.
//
// SIGN-IN RETURNS THEM HERE, not to the chat: they were reading the
// explainer, and sending someone somewhere else as the reward for making an
// account is its own small betrayal.

import { useCallback, useEffect, useState } from "react";
import { DemeterWelcome } from "./DemeterWelcome";
import { welcomeSeen, markWelcomeSeen } from "../lib/welcome-seen";
import { T } from "../lib/i18n/demeter-chat-copy";
import { askPath } from "../lib/i18n/routes";
import type { AnswerLang } from "@civica/demeter-engine/packs";

export function LandingWelcome({ lang }: { lang: AnswerLang }) {
  const [show, setShow] = useState(false);
  const t = T[lang];

  useEffect(() => {
    if (!welcomeSeen()) setShow(true);
  }, []);

  const dismiss = useCallback(() => {
    setShow(false);
    markWelcomeSeen();
  }, []);

  if (!show) return null;
  return (
    <DemeterWelcome
      copy={t.welcome}
      onDismiss={dismiss}
      signInHref={`/sign-in?next=${encodeURIComponent(askPath(lang))}&lang=${lang}`}
    />
  );
}
