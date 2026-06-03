"use client";

import { useEffect, useRef, useState } from "react";
import type { Copy } from "../app/i18n";
import { CAMPUSES } from "../app/campuses";

type Status =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "success" }
  | { kind: "error"; message: string };

// Form is long-ish for a marketing surface (email + phone + campus) and the
// modal of users hitting it on mobile means tab-close / device-sleep mid-fill
// is common. We persist every field change to localStorage and rehydrate on
// mount, so a user who comes back to the page in the same browser keeps what
// they typed. Drafts are cleared on successful submission.
//
// Storage key is versioned (`v: 1`) so a future field addition can invalidate
// drafts cleanly via schema check rather than hand-coded migrations.
const DRAFT_STORAGE_KEY = "civica-web.lead-draft-v1";

interface LeadDraft {
  v: 1;
  email: string;
  phone: string;
  campus: string;
}

function loadDraft(): LeadDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      (parsed as LeadDraft).v === 1 &&
      typeof (parsed as LeadDraft).email === "string" &&
      typeof (parsed as LeadDraft).phone === "string" &&
      typeof (parsed as LeadDraft).campus === "string"
    ) {
      return parsed as LeadDraft;
    }
    return null;
  } catch {
    return null;
  }
}

function saveDraft(draft: LeadDraft): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
  } catch {
    // localStorage disabled / quota exceeded — silently drop. Form still works.
  }
}

function clearDraft(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(DRAFT_STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function LeadCaptureForm({ copy }: { copy: Copy }) {
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [campus, setCampus] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [showRestoreNotice, setShowRestoreNotice] = useState(false);

  // Hydration is one-shot on mount. We track whether we've completed the
  // initial restore so the persist effect doesn't write the initial empty
  // state over a valid draft before hydration runs.
  const hydrated = useRef(false);

  useEffect(() => {
    const draft = loadDraft();
    if (
      draft &&
      (draft.email.length > 0 ||
        draft.phone.length > 0 ||
        draft.campus.length > 0)
    ) {
      setEmail(draft.email);
      setPhone(draft.phone);
      setCampus(draft.campus);
      setShowRestoreNotice(true);
    }
    hydrated.current = true;
  }, []);

  // Persist on every field change. Skip until hydration completes (otherwise
  // the initial empty-state effect would clobber a stored draft). Also skip
  // writes for fully-empty forms — a deliberate clear should not resurrect
  // itself as a "draft" on the next mount.
  useEffect(() => {
    if (!hydrated.current) return;
    const trimmed = {
      email: email.trim(),
      phone: phone.trim(),
      campus: campus.trim(),
    };
    if (!trimmed.email && !trimmed.phone && !trimmed.campus) {
      clearDraft();
      return;
    }
    saveDraft({ v: 1, email, phone, campus });
  }, [email, phone, campus]);

  // Dismiss the "draft restored" notice as soon as the user interacts.
  // Less chatty than a setTimeout and clears the moment the message has
  // served its purpose.
  const dismissRestoreNotice = () => {
    if (showRestoreNotice) setShowRestoreNotice(false);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setStatus({ kind: "error", message: copy.formValidationError });
      return;
    }
    if (phone.trim().length > 0 && phone.trim().length < 7) {
      setStatus({ kind: "error", message: copy.formValidationErrorPhone });
      return;
    }
    // Campus is required by the API (pilot_leads CHECK constraint enforces
    // it for source='student-lpie-web').
    if (!campus.trim()) {
      setStatus({ kind: "error", message: copy.formCampusRequired });
      return;
    }

    setStatus({ kind: "submitting" });
    try {
      const res = await fetch("/api/lead-capture", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email,
          phone: phone || undefined,
          campus,
        }),
      });
      if (res.status === 201 || res.status === 503) {
        // In dev (503 = not configured), still show success so the form
        // can be exercised without Supabase credentials.
        setStatus({ kind: "success" });
        setEmail("");
        setPhone("");
        setCampus("");
        clearDraft();
        setShowRestoreNotice(false);
        return;
      }
      const errorMessage =
        res.status === 429 ? copy.formErrorRateLimit : copy.formError;
      setStatus({ kind: "error", message: errorMessage });
    } catch {
      setStatus({ kind: "error", message: copy.formError });
    }
  };

  return (
    <form className="lead-form" onSubmit={submit} noValidate>
      {showRestoreNotice && (
        <p
          className="lead-form__status lead-form__status--info"
          role="status"
        >
          {copy.formDraftRestored}
        </p>
      )}

      <div className="lead-form__field">
        <label className="lead-form__label" htmlFor="email">
          {copy.fieldEmail}
        </label>
        <input
          className="lead-form__input"
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            dismissRestoreNotice();
          }}
        />
      </div>

      <div className="lead-form__field">
        <label className="lead-form__label" htmlFor="phone">
          {copy.fieldPhone}
        </label>
        <input
          className="lead-form__input"
          id="phone"
          name="phone"
          type="tel"
          autoComplete="tel"
          value={phone}
          onChange={(e) => {
            setPhone(e.target.value);
            dismissRestoreNotice();
          }}
        />
      </div>

      <div className="lead-form__field">
        <label className="lead-form__label" htmlFor="campus">
          {copy.fieldCampus}
        </label>
        <select
          className="lead-form__select"
          id="campus"
          name="campus"
          value={campus}
          onChange={(e) => {
            setCampus(e.target.value);
            dismissRestoreNotice();
          }}
        >
          <option value="">{copy.fieldCampusPlaceholder}</option>
          {CAMPUSES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      <button
        className="btn btn--primary"
        type="submit"
        disabled={status.kind === "submitting"}
      >
        {status.kind === "submitting" ? copy.formSubmitting : copy.formSubmit}
      </button>

      {status.kind === "success" && (
        <p
          className="lead-form__status lead-form__status--success"
          role="status"
        >
          {copy.formSuccess}
        </p>
      )}
      {status.kind === "error" && (
        <p className="lead-form__status lead-form__status--error" role="alert">
          {status.message}
        </p>
      )}
    </form>
  );
}
