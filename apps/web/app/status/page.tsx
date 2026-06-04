"use client";

// Returning-user status page. Mirrors SNAPEnrollmentInboxSection +
// ReEntryCardView. Lists packets w/ status badges + navigator inbox.

import { useEffect, useState } from "react";
import Link from "next/link";
import { STORAGE_KEY, type Locale } from "../i18n";
import { snapT, type SnapStringKey } from "../../lib/i18n/snap-copy";
import type {
  EnrollmentPacket,
  EnrollmentInboxItem,
  PacketStatus,
} from "../../lib/enrollment-api/types";
import { isActionableStatus } from "../../lib/enrollment-api/types";

export default function StatusPage() {
  const [locale, setLocale] = useState<Locale>("en");
  const [packets, setPackets] = useState<EnrollmentPacket[] | null>(null);
  const [inbox, setInbox] = useState<EnrollmentInboxItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved === "en" || saved === "es") setLocale(saved);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/enrollment/me", { cache: "no-store" });
        if (!res.ok) {
          setError(res.status === 401
            ? snapT(locale, "error_session_expired")
            : snapT(locale, "error_gateway_unreachable"));
          setPackets([]);
          return;
        }
        const body = (await res.json()) as {
          packets: EnrollmentPacket[];
          inbox: EnrollmentInboxItem[];
        };
        setPackets(body.packets);
        setInbox(body.inbox);
      } catch {
        setError(snapT(locale, "error_gateway_unreachable"));
        setPackets([]);
      }
    })();
  }, [locale]);

  const t = (k: SnapStringKey) => snapT(locale, k);

  return (
    <div className="status-page">
      <header className="status-page__head">
        <h1 className="status-page__title">{t("status_title")}</h1>
        <Link href="/apply" className="status-page__new">
          {t("status_start_new")} →
        </Link>
      </header>

      {error && <p className="status-page__error" role="alert">{error}</p>}

      <section className="status-page__section">
        <h2 className="status-page__section-title">{t("status_inbox_title")}</h2>
        {inbox.length === 0 ? (
          <p className="status-page__empty">{t("status_inbox_empty")}</p>
        ) : (
          <ul className="status-page__inbox">
            {inbox.map((item) => (
              <li key={item.id} className="status-page__inbox-row">
                <span className="status-page__inbox-prompt">{item.prompt}</span>
                <Link
                  href={`/documents/${encodeURIComponent(item.packet_id)}`}
                  className="status-page__inbox-link"
                >
                  {t("upload_title")} →
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="status-page__section">
        <h2 className="status-page__section-title">{t("status_title")}</h2>
        {packets === null ? (
          <p className="status-page__empty">…</p>
        ) : packets.length === 0 ? (
          <p className="status-page__empty">{t("status_empty")}</p>
        ) : (
          <ul className="status-page__packets">
            {packets.map((p) => (
              <li key={p.id} className={`status-page__packet ${isActionableStatus(p.status as PacketStatus) ? "status-page__packet--actionable" : ""}`}>
                <div className="status-page__packet-head">
                  <code className="status-page__packet-id">{p.id.slice(0, 8)}…</code>
                  <span className="status-page__packet-badge" data-status={p.status}>
                    {p.status}
                  </span>
                </div>
                <div className="status-page__packet-meta">
                  {p.state_code} · created {new Date(p.created_at).toLocaleDateString(locale === "es" ? "es-US" : "en-US")}
                </div>
                {p.notes_for_applicant && (
                  <p className="status-page__packet-note">{p.notes_for_applicant}</p>
                )}
                <div className="status-page__packet-actions">
                  <Link
                    href={`/documents/${encodeURIComponent(p.id)}`}
                    className="status-page__packet-link"
                  >
                    {t("upload_title")} →
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <footer className="status-page__footer">
        <button
          type="button"
          className="status-page__signout"
          onClick={async () => {
            await fetch("/api/auth/sign-out", { method: "POST" });
            window.location.href = "/";
          }}
        >
          Sign out
        </button>
      </footer>
    </div>
  );
}
