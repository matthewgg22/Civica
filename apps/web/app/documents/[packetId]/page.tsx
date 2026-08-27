"use client";

// Document upload page. Mirrors SNAPDocumentUploadView — drag/drop or
// click-to-browse, classify by EnrollmentDocumentKind, show processing
// status per row. Multipart upload goes through /api/enrollment/documents/[id]
// so the access token stays HttpOnly.

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { STORAGE_KEY, type Locale } from "../../i18n";
import { snapT, type SnapStringKey } from "../../../lib/i18n/snap-copy";
import {
  DOCUMENT_KIND,
  DOCUMENT_KIND_ORDER,
  type DocumentKind,
  type EnrollmentDocument,
  type DocumentProcessingStatus,
} from "../../../lib/enrollment-api/types";

const ACCEPT = "image/jpeg,image/png,image/heic,application/pdf";

export default function DocumentUploadPage({
  params,
}: {
  params: Promise<{ packetId: string }>;
}) {
  const { packetId } = use(params);
  const [locale, setLocale] = useState<Locale>("en");
  const [docs, setDocs] = useState<EnrollmentDocument[]>([]);
  const [kind, setKind] = useState<DocumentKind>(DOCUMENT_KIND.photoId);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved === "en" || saved === "es") setLocale(saved);
    } catch { /* ignore */ }
  }, []);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/enrollment/documents/${encodeURIComponent(packetId)}`, {
        cache: "no-store",
      });
      if (res.ok) {
        const list = (await res.json()) as EnrollmentDocument[];
        setDocs(list);
      }
    } catch {
      // ignore - shown via inline state
    }
  }, [packetId]);

  useEffect(() => { void refresh(); }, [refresh]);

  // Memoized on `locale` because `upload` depends on it: a fresh `t` every
  // render made `upload`'s useCallback recompute every render, which quietly
  // turned a memoized handler into an unmemoized one.
  const t = useCallback((k: SnapStringKey) => snapT(locale, k), [locale]);

  const upload = useCallback(async (file: File) => {
    setUploading(true);
    setError(null);
    setSuccess(null);
    try {
      const form = new FormData();
      form.append("file", file, file.name);
      form.append("document_kind", kind);
      form.append("on_device_quality_passed", "true");
      const res = await fetch(`/api/enrollment/documents/${encodeURIComponent(packetId)}`, {
        method: "POST",
        body: form,
      });
      if (!res.ok) { setError(t("upload_error")); return; }
      setSuccess(t("upload_success"));
      await refresh();
    } catch {
      setError(t("upload_error"));
    } finally {
      setUploading(false);
    }
  }, [kind, packetId, refresh, t]);

  const onDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) void upload(file);
  }, [upload]);

  const onFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void upload(file);
  }, [upload]);

  return (
    <div className="docs-page">
      <header className="docs-page__head">
        <h1 className="docs-page__title">{t("upload_title")}</h1>
        <p className="docs-page__subtitle">{t("upload_subtitle")}</p>
      </header>

      <div className="docs-page__upload">
        <label className="docs-page__field">
          <span className="field__label">{t("upload_select_kind")}</span>
          <select
            className="field__input"
            value={kind}
            onChange={(e) => setKind(e.target.value as DocumentKind)}
          >
            {DOCUMENT_KIND_ORDER.map((k) => (
              <option key={k} value={k}>{t(`kind_${kindToKey(k)}` as SnapStringKey)}</option>
            ))}
          </select>
        </label>

        <div
          className="docs-page__dropzone"
          onDragOver={(e) => e.preventDefault()}
          onDrop={onDrop}
        >
          <input
            type="file"
            accept={ACCEPT}
            className="docs-page__file-input"
            id="doc-file"
            onChange={onFileInput}
            disabled={uploading}
          />
          <label htmlFor="doc-file" className="docs-page__dropzone-label">
            {uploading ? t("upload_uploading") : t("upload_drop_zone")}
          </label>
        </div>

        {error && <p className="docs-page__error" role="alert">{error}</p>}
        {success && <p className="docs-page__success" role="status">{success}</p>}
      </div>

      <ul className="docs-page__list">
        {docs.map((d) => (
          <li key={d.document_id} className="docs-page__row">
            <span className="docs-page__row-name">
              {d.original_filename ?? "document"}
            </span>
            <span className="docs-page__row-kind">
              {d.document_kind ? t(`kind_${kindToKey(d.document_kind)}` as SnapStringKey) : ", "}
            </span>
            <span
              className="docs-page__row-status"
              data-status={d.processing_status}
            >
              {statusLabel(d.processing_status, t)}
            </span>
          </li>
        ))}
      </ul>

      <div className="docs-page__footer">
        <Link href="/status" className="wizard__continue">
          {t("confirmation_view_status")}
        </Link>
      </div>
    </div>
  );
}

function kindToKey(k: DocumentKind): string {
  switch (k) {
    case "photo_id": return "photo_id";
    case "paystub": return "paystub";
    case "utility_bill": return "utility_bill";
    case "lease": return "lease";
    case "bank_statement": return "bank_statement";
    case "tax_return": return "tax_return";
    case "benefit_letter": return "benefit_letter";
    case "other": return "other";
  }
}

function statusLabel(
  s: DocumentProcessingStatus,
  t: (k: SnapStringKey) => string,
): string {
  switch (s) {
    case "uploaded": return t("upload_status_uploaded");
    case "classifying": return t("upload_status_classifying");
    case "extracting": return t("upload_status_extracting");
    case "awaiting_confirmation": return t("upload_status_awaiting");
    case "confirmed": return t("upload_status_confirmed");
    case "rejected": return t("upload_status_rejected");
  }
}
