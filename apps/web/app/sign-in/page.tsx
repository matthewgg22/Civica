// /sign-in — server shell. The interactive page lives in signin-form.tsx
// ("use client"); this module exists so the route can export metadata, which
// a client module cannot. Without it every visit wore the root layout's
// "Civica — Apply for SNAP food benefits" tab title — including a Demeter
// user mid-save, in whatever language (#698).

import type { Metadata } from "next";
import SignInClient from "./signin-form";

/** Same branch test as the client form (kept in lockstep by the framing
 *  tests): locale-tolerant detection of BOTH conversation routes, Demeter
 *  by default.
 *
 *  /chat was added 2026-08-22. #898 P1-5 called it "not a real route" and
 *  that was true then; the whole chat surface moved there afterwards and
 *  this test was never widened, so every sign-in from the live chat wore
 *  the Civica apply-flow card. Screenshot-confirmed on the preview. */
const FOR_CONVERSATION = /^\/(?:(?:es|vi|zh)\/)?(?:screen|chat)(?:\/|$|\?)/;

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}): Promise<Metadata> {
  const { next } = await searchParams;
  const forConversation = FOR_CONVERSATION.test(next ?? "/screen/ask");
  return forConversation
    ? {
        title: "Sign in: Demeter",
        description: "Sign in to save your SNAP conversation and come back to it any time.",
        robots: { index: false, follow: true },
      }
    : {
        title: "Sign in: Civica",
        description: "Sign in to save your SNAP application.",
        robots: { index: false, follow: true },
      };
}

export default function SignInPage() {
  return <SignInClient />;
}
