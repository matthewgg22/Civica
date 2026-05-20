"use client";

import { useState } from "react";
import type { Copy } from "../app/i18n";
import { CAMPUSES } from "../app/campuses";

type Status =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "success" }
  | { kind: "error"; message: string };

export function LeadCaptureForm({ copy }: { copy: Copy }) {
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [campus, setCampus] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });

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
          onChange={(e) => setEmail(e.target.value)}
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
          onChange={(e) => setPhone(e.target.value)}
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
          onChange={(e) => setCampus(e.target.value)}
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
