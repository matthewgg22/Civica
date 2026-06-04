"use client";

// /apply entry — sends the user to the first incomplete section, or to
// the first section if the draft is empty. Mirrors the iOS flow where
// tapping "Continue application" on the home tile re-enters at the
// last-touched step.

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useDraft } from "../../lib/snap/draft-store";
import { SECTION_IDS } from "../../lib/snap/sections";
import { sectionCompletion } from "../../lib/snap/validation";

export default function ApplyEntryPage() {
  const router = useRouter();
  const [draft] = useDraft();

  useEffect(() => {
    const firstIncomplete = SECTION_IDS.find(
      (s) => sectionCompletion(s, draft) === "not_started"
        || sectionCompletion(s, draft) === "missing_required",
    );
    router.replace(`/apply/${firstIncomplete ?? "review"}`);
  }, [router, draft]);

  return <div className="apply-loading">…</div>;
}
