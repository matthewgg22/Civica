"use client";

// Returning-user status dashboard. The applicant's view of their own
// application journey — status hero, progress timeline, action items,
// documents, and summary. Mirrors the iOS returning-user home
// (SNAPEnrollmentInboxSection + ReEntryCardView), NOT the navigator queue:
// this is one person's journey, not a queue of many people.
//
// Demo mode: /status?demo=1 renders rich sample data with no auth, so the
// applicant experience is product-demo-able without a phone-OTP login.

import { useEffect, useState } from "react";
import Link from "next/link";
import AppNav from "../../components/AppNav";
import { LanguagePicker } from "../../components/LanguagePicker";
import { STORAGE_KEY, LOCALES, type Locale } from "../i18n";
import { snapT, type SnapStringKey } from "../../lib/i18n/snap-copy";
import type {
  EnrollmentPacket,
  EnrollmentInboxItem,
  PacketStatus,
} from "../../lib/enrollment-api/types";
import { isActionableStatus } from "../../lib/enrollment-api/types";

// ─── Applicant-friendly journey stages ──────────────────────────────────────
// The 8 safe packet statuses collapse into 4 plain-language stages the
// applicant understands. We never surface "approved"/"denied" — that's the
// county's determination, not ours.
const JOURNEY_STAGES = [
  { key: "submitted", label: "Submitted",        sub: "You sent your application" },
  { key: "review",    label: "Navigator review",  sub: "Civica is checking it for errors" },
  { key: "handoff",   label: "Sent to county",    sub: "Forwarded to the state agency" },
  { key: "decision",  label: "County decision",   sub: "The county reviews and decides" },
] as const;

function stageIndexForStatus(status: PacketStatus): number {
  switch (status) {
    case "Draft":
    case "Submitted for Review":
      return 0;
    case "Needs Documents":
    case "Needs Applicant Clarification":
    case "In Navigator Review":
      return 1;
    case "Ready for Handoff":
      return 1;
    case "Handed Off":
      return 2;
    case "Closed":
      return 3;
    default:
      return 0;
  }
}

function statusHeadline(status: PacketStatus): { title: string; tone: "neutral" | "action" | "positive" } {
  switch (status) {
    case "Needs Documents":
      return { title: "We need a document from you", tone: "action" };
    case "Needs Applicant Clarification":
      return { title: "Your navigator has a question", tone: "action" };
    case "In Navigator Review":
      return { title: "Your application is in review", tone: "neutral" };
    case "Submitted for Review":
      return { title: "Your application was received", tone: "neutral" };
    case "Ready for Handoff":
      return { title: "Ready to send to the county", tone: "positive" };
    case "Handed Off":
      return { title: "Sent to the county", tone: "positive" };
    case "Closed":
      return { title: "This application is closed", tone: "neutral" };
    default:
      return { title: "Application in progress", tone: "neutral" };
  }
}

// ─── Demo data ────────────────────────────────────────────────────────────────
const DEMO_PACKET: EnrollmentPacket = {
  id: "demo-pkt-0xA1B2C3",
  status: "Needs Documents",
  state_code: "CA",
  created_at: "2026-05-31T14:22:00Z",
  updated_at: "2026-06-03T09:10:00Z",
  submitted_at: "2026-05-31T14:40:00Z",
  notes_for_applicant:
    "Your navigator is reviewing your household income. Once we have your most recent pay stub, we can finish the review. Estimated monthly benefit if approved: about $740.",
};

const DEMO_INBOX: EnrollmentInboxItem[] = [
  {
    id: "demo-inbox-1",
    packet_id: "demo-pkt-0xA1B2C3",
    prompt: "Upload your most recent pay stub so we can verify your income.",
  } as EnrollmentInboxItem,
];

const DEMO_DOCS = [
  { kind: "Photo ID",          status: "confirmed" as const },
  { kind: "Utility bill",      status: "confirmed" as const },
  { kind: "Most recent pay stub", status: "needed" as const },
];

const DEMO_SUMMARY = [
  { label: "County",          value: "Los Angeles, CA" },
  { label: "Household size",  value: "3 people" },
  { label: "Submitted",       value: "May 31, 2026" },
  { label: "Language",        value: "English" },
];

export default function StatusPage() {
  const [locale, setLocale] = useState<Locale>("en");
  const [demo, setDemo] = useState(false);
  const [packets, setPackets] = useState<EnrollmentPacket[] | null>(null);
  const [inbox, setInbox] = useState<EnrollmentInboxItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Single mount effect: read locale + demo flag synchronously, THEN decide
  // whether to fetch. Reading demo first prevents a stale gateway fetch from
  // racing the demo path and clobbering the sample data.
  useEffect(() => {
    let savedLocale: Locale = "en";
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved && (LOCALES as string[]).includes(saved)) savedLocale = saved as Locale;
    } catch { /* ignore */ }
    setLocale(savedLocale);

    let isDemo = false;
    try {
      isDemo = new URLSearchParams(window.location.search).get("demo") === "1";
    } catch { /* ignore */ }
    setDemo(isDemo);

    if (isDemo) {
      setPackets([DEMO_PACKET]);
      setInbox(DEMO_INBOX);
      return;
    }

    let ignore = false;
    (async () => {
      try {
        const res = await fetch("/api/enrollment/me", { cache: "no-store" });
        if (ignore) return;
        if (!res.ok) {
          setError(res.status === 401
            ? snapT(savedLocale, "error_session_expired")
            : snapT(savedLocale, "error_gateway_unreachable"));
          setPackets([]);
          return;
        }
        const body = (await res.json()) as {
          packets: EnrollmentPacket[];
          inbox: EnrollmentInboxItem[];
        };
        if (ignore) return;
        setPackets(body.packets);
        setInbox(body.inbox);
      } catch {
        if (!ignore) {
          setError(snapT(savedLocale, "error_gateway_unreachable"));
          setPackets([]);
        }
      }
    })();
    return () => { ignore = true; };
  }, []);

  const t = (k: SnapStringKey) => snapT(locale, k);

  function changeLocale(next: Locale) {
    setLocale(next);
    try { window.localStorage.setItem(STORAGE_KEY, next); } catch { /* ignore */ }
  }

  // Primary packet = most recent. The hero + timeline track this one.
  const primary = packets && packets.length > 0 ? packets[0] : null;

  return (
    <>
    <AppNav
      demo={demo}
      logoHref={demo ? "/welcome" : "/status"}
      rightSlot={<LanguagePicker locale={locale} onChange={changeLocale} ariaLabel="Choose language" />}
      tabs={[
        { label: "My Application", href: demo ? "/status?demo=1" : "/status", active: true },
        { label: "Start New", href: "/apply" },
      ]}
    />
    <div className="status-dash">
      <header className="status-dash__head">
        <h1 className="status-dash__title">{t("status_title")}</h1>
        <Link href="/apply" className="status-dash__new">{t("status_start_new")} →</Link>
      </header>

      {error && <p className="status-dash__error" role="alert">{error}</p>}

      {packets === null ? (
        <div className="status-dash__loading">…</div>
      ) : primary === null ? (
        <EmptyState t={t} demo={demo} />
      ) : (
        <>
          <StatusHero packet={primary} />
          <ProgressTimeline packet={primary} />

          {/* Action items */}
          <section className="status-dash__card">
            <h2 className="status-dash__card-title">{t("status_inbox_title")}</h2>
            {inbox.length === 0 ? (
              <p className="status-dash__empty">{t("status_inbox_empty")}</p>
            ) : (
              <ul className="status-dash__actions">
                {inbox.map((item) => (
                  <li key={item.id} className="status-dash__action">
                    <span className="status-dash__action-dot" aria-hidden />
                    <span className="status-dash__action-text">{item.prompt}</span>
                    <Link
                      href={demo ? "#" : `/documents/${encodeURIComponent(item.packet_id)}`}
                      className="status-dash__action-link"
                    >
                      {t("upload_title")} →
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Documents — demo only (real path lives on /documents/[packetId]) */}
          {demo && (
            <section className="status-dash__card">
              <h2 className="status-dash__card-title">Your documents</h2>
              <ul className="status-dash__docs">
                {DEMO_DOCS.map((d) => (
                  <li key={d.kind} className="status-dash__doc">
                    <span className="status-dash__doc-name">{d.kind}</span>
                    <span className="status-dash__doc-status" data-status={d.status}>
                      {d.status === "confirmed" ? "Confirmed" : "Needed"}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Summary — demo only */}
          {demo && (
            <section className="status-dash__card">
              <h2 className="status-dash__card-title">Application summary</h2>
              <dl className="status-dash__summary">
                {DEMO_SUMMARY.map((row) => (
                  <div key={row.label} className="status-dash__summary-row">
                    <dt>{row.label}</dt>
                    <dd>{row.value}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}
        </>
      )}

      <footer className="status-dash__footer">
        {demo ? (
          <Link href="/sign-in" className="status-dash__signin-link">Sign in to see your real application →</Link>
        ) : (
          <button
            type="button"
            className="status-dash__signout"
            onClick={async () => {
              await fetch("/api/auth/sign-out", { method: "POST" });
              window.location.href = "/";
            }}
          >
            Sign out
          </button>
        )}
      </footer>
    </div>
    </>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function StatusHero({ packet }: { packet: EnrollmentPacket }) {
  const { title, tone } = statusHeadline(packet.status);
  return (
    <section className={`status-hero status-hero--${tone}`}>
      <p className="status-hero__eyebrow">Current status</p>
      <h2 className="status-hero__title">{title}</h2>
      <p className="status-hero__status-pill" data-status={packet.status}>{packet.status}</p>
      {packet.notes_for_applicant && (
        <p className="status-hero__note">{packet.notes_for_applicant}</p>
      )}
    </section>
  );
}

function ProgressTimeline({ packet }: { packet: EnrollmentPacket }) {
  const current = stageIndexForStatus(packet.status);
  const needsAction = isActionableStatus(packet.status);
  return (
    <section className="status-dash__card" aria-label="Application progress">
      <h2 className="status-dash__card-title">Your application journey</h2>
      <ol className="timeline">
        {JOURNEY_STAGES.map((stage, i) => {
          const state = i < current ? "done" : i === current ? "current" : "upcoming";
          return (
            <li key={stage.key} className={`timeline__step timeline__step--${state}`}>
              <span className="timeline__marker" aria-hidden>
                {state === "done" ? "✓" : i + 1}
              </span>
              <div className="timeline__content">
                <p className="timeline__label">
                  {stage.label}
                  {state === "current" && (
                    <span className="timeline__now">{needsAction ? "Action needed" : "In progress"}</span>
                  )}
                </p>
                <p className="timeline__sub">{stage.sub}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function EmptyState({ t, demo }: { t: (k: SnapStringKey) => string; demo: boolean }) {
  return (
    <section className="status-dash__card status-dash__card--empty">
      <p className="status-dash__empty">{t("status_empty")}</p>
      <Link href="/apply" className="status-dash__empty-cta">{t("status_start_new")} →</Link>
      {!demo && (
        <p className="status-dash__empty-demo">
          Want to see how it looks? <Link href="/status?demo=1">View a sample dashboard</Link>
        </p>
      )}
    </section>
  );
}
