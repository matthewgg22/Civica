// /feedback — general product/site feedback. Reachable from every Demeter
// surface's footer, and the destination /supporters now redirects to.
//
// THE GAP THIS CLOSES: the only feedback mechanism anywhere on the product
// was a thumbs up/down on one specific chat answer, buried inside an active
// conversation. Someone with a suggestion, a bug report, or "please add my
// state" had nowhere to say so at all — direct user feedback, 2026-08-15.

import type { Metadata } from "next";
import { BackToChat } from "../../components/BackToChat";
import { DemeterFooter } from "../../components/DemeterFooter";
import { SiteFeedbackForm } from "../../components/SiteFeedbackForm";

export const metadata: Metadata = {
  title: "Feedback: Demeter",
  description:
    "Tell Demeter what's working, what's broken, or what's missing. Read by the team that builds it.",
};

export default function FeedbackPage() {
  return (
    <>
      <main className="vpage fbpage">
        <header className="vpage__head">
          {/* INSIDE the container, not before it. Outside, this rendered at
              the document edge — 267px adrift of the title it belongs to. */}
          <BackToChat />
          <h1 className="vpage__title">Feedback</h1>
          <p className="vpage__lede vpage__lede--lead">
            Tell us what&apos;s working, what&apos;s broken, or what&apos;s missing. A
            real person reads every message. This isn&apos;t a rating on one answer, it&apos;s
            anything else you want to say about the product.
          </p>
        </header>
        {/* ABOVE the form. This tells someone reporting a specific wrong
            answer that they are on the wrong page — useless underneath a form
            they have already filled in. */}
        <p className="fbpage__reroute">
          Reporting a specific wrong answer? The thumbs up/down under any answer in{" "}
          <a href="/chat">the chat</a> reaches the same team, with the actual question and
          answer attached. Faster than describing it here from memory.
        </p>
        <SiteFeedbackForm />
      </main>
      <DemeterFooter />
    </>
  );
}
