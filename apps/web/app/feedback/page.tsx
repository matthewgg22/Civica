// /feedback — general product/site feedback. Reachable from every Demeter
// surface's footer, and the destination /supporters now redirects to.
//
// THE GAP THIS CLOSES: the only feedback mechanism anywhere on the product
// was a thumbs up/down on one specific chat answer, buried inside an active
// conversation. Someone with a suggestion, a bug report, or "please add my
// state" had nowhere to say so at all — direct user feedback, 2026-08-15.
//
// The body is shared with /[lang]/feedback; this route is just the English
// entry and its metadata.

import type { Metadata } from "next";
import { FeedbackPageBody } from "../../components/FeedbackPageBody";
import { FEEDBACK_COPY } from "../../lib/i18n/feedback-copy";

export const metadata: Metadata = {
  title: FEEDBACK_COPY.en.metaTitle,
  description: FEEDBACK_COPY.en.metaDescription,
};

export default function FeedbackPage() {
  return <FeedbackPageBody lang="en" />;
}
