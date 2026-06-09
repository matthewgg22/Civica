"use client";

import { useEffect, useState } from "react";
import type { Locale } from "../app/i18n";
import { snapT } from "../lib/i18n/snap-copy";

type Req = { id: string; created_at: string };

// Applicant-facing consent gate: lists caseworker self-referrals awaiting this
// applicant's approval (status='pending') and lets them Approve/Decline. The
// gateway read is column-restricted, so we show a generic "a caseworker"
// label rather than a name. Renders nothing when there are no pending requests.
export default function BuddyRequests({ locale }: { locale: Locale }) {
  const [reqs, setReqs] = useState<Req[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        const res = await fetch("/api/enrollment/buddy-requests", { cache: "no-store" });
        if (ignore) return;
        if (!res.ok) {
          setReqs([]);
          return;
        }
        const data = (await res.json()) as Req[];
        if (!ignore) setReqs(Array.isArray(data) ? data : []);
      } catch {
        if (!ignore) setReqs([]);
      }
    })();
    return () => {
      ignore = true;
    };
  }, []);

  async function act(id: string, action: "approve" | "decline") {
    setBusy(id);
    try {
      await fetch(`/api/enrollment/buddy-requests/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      setReqs((r) => (r ?? []).filter((x) => x.id !== id));
    } finally {
      setBusy(null);
    }
  }

  if (!reqs || reqs.length === 0) return null;

  return (
    <section className="status-dash__card">
      <h2 className="status-dash__card-title">{snapT(locale, "buddy_req_title")}</h2>
      <p className="buddy-req__lead">{snapT(locale, "buddy_req_lead")}</p>
      <ul className="buddy-req__list">
        {reqs.map((r) => (
          <li key={r.id} className="buddy-req__item">
            <span className="buddy-req__who">{snapT(locale, "buddy_req_who")}</span>
            <div className="buddy-req__actions">
              <button
                type="button"
                disabled={busy === r.id}
                onClick={() => void act(r.id, "approve")}
                className="buddy-req__approve"
              >
                {snapT(locale, "buddy_req_approve")}
              </button>
              <button
                type="button"
                disabled={busy === r.id}
                onClick={() => void act(r.id, "decline")}
                className="buddy-req__decline"
              >
                {snapT(locale, "buddy_req_decline")}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
