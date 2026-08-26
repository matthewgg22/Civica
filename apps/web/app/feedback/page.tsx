// /feedback — general product/site feedback. Reachable from every Demeter
// surface's footer, same as /verify and /supporters.
//
// THE GAP THIS CLOSES: the only feedback mechanism anywhere on the product
// was a thumbs up/down on one specific chat answer, buried inside an active
// conversation. Someone with a suggestion, a bug report, or "please add my
// state" had nowhere to say so at all — direct user feedback, 2026-08-15.

import type { Metadata } from "next";
import { DemeterNav } from "../../components/DemeterNav";
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
      <DemeterNav path="/feedback" />
      <main className="vpage fbpage">
        <header className="vpage__head">
          <h1 className="vpage__title">Feedback</h1>
          <p className="vpage__lede vpage__lede--lead">
            Tell us what&apos;s working, what&apos;s broken, or what&apos;s missing. A
            real person reads every message, this isn&apos;t a rating on one answer, it&apos;s
            anything else you want to say about the product.
          </p>
        </header>
        <SiteFeedbackForm />
        <section className="vpage__foot">
          <p>
            Reporting a specific wrong answer? The thumbs up/down under any answer in{" "}
            <a href="/chat">the chat</a> reaches the same team, with the actual question and
            answer attached. Faster than describing it here from memory.
          </p>
        </section>
      </main>
      <DemeterFooter />
    </>
  );
}
