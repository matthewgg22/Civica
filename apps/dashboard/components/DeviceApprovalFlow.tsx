"use client";

/**
 * DeviceApprovalFlow — the interactive client half of /extension/connect.
 *
 * OAuth 2.0 Device Authorization Grant approval (RFC 8628), issue #317 part 2.
 * Drives the consent state machine for connecting the Civica Submitter browser
 * extension to the signed-in assister's CBO org:
 *
 *   enter → looking_up → confirm → approving → approved
 *                                 ↘ denying  → denied
 *   (any) → error  (actionable: not_found | expired | already_used | no_org | network)
 *
 * Security:
 *   - The access token the extension eventually receives is scoped to the
 *     approver's org, resolved server-side from THEIR JWT (see oauth.ts
 *     /approve). We never send an org from the client — only the user_code.
 *   - The user_code is a short-lived, low-entropy consent code, but we still
 *     never log it (no console.* with the code or the JWT).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "../lib/supabase";
import { api } from "../lib/api";

// ---------------------------------------------------------------------------
// user_code handling — mirror the backend's normalizeUserCode (oauth.ts /
// device-token.ts): uppercase, strip everything but A-Z0-9. The server hashes
// the normalized form, so "abcd-2345", "ABCD2345" and " abcd 2345 " are equal.
// The alphabet excludes ambiguous glyphs (no I/L/O/0/1).
// ---------------------------------------------------------------------------

const USER_CODE_BARE_LEN = 8;

/** Strip to A-Z0-9, uppercased — the canonical form the backend compares. */
function normalizeUserCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** True once we have a full 8-char code worth looking up. */
function isCompleteCode(raw: string): boolean {
  return normalizeUserCode(raw).length === USER_CODE_BARE_LEN;
}

/** Pretty XXXX-XXXX for display/submit. The server strips the dash anyway. */
function formatUserCode(raw: string): string {
  const bare = normalizeUserCode(raw).slice(0, USER_CODE_BARE_LEN);
  return bare.length > 4 ? `${bare.slice(0, 4)}-${bare.slice(4)}` : bare;
}

// ---------------------------------------------------------------------------
// State machine
// ---------------------------------------------------------------------------

type Phase =
  | "enter"
  | "looking_up"
  | "confirm"
  | "approving"
  | "denying"
  | "approved"
  | "denied"
  | "error";

type ErrorKind = "not_found" | "expired" | "already_used" | "no_org" | "network";

interface LookupResult {
  status: string;
  client_label: string | null;
  expires_at: string;
}

interface Props {
  /** Prefilled code from verification_uri_complete (?user_code=). */
  initialUserCode: string | null;
  /** Signed-in staff email, for "you're approving as …" reassurance. */
  signedInEmail: string | null;
}

// ---------------------------------------------------------------------------
// API error → ErrorKind. apiFetch throws Error("API <status>: <body>").
// ---------------------------------------------------------------------------

function classifyError(err: unknown, context: "lookup" | "approve" | "deny"): ErrorKind {
  const msg = err instanceof Error ? err.message : String(err);
  const status = /^API (\d{3})/.exec(msg)?.[1];
  if (status === "410") return "expired"; // approve: row past expires_at
  if (status === "409") return "already_used"; // approve: already approved/consumed
  if (status === "403") return "no_org"; // approve: staff account has no org
  if (status === "404") {
    // lookup 404 = unknown / expired / no-longer-pending; we can't distinguish
    // expired-vs-unknown from the body without leaking, so present as not_found.
    // deny 404 = unknown or non-pending.
    return context === "approve" ? "already_used" : "not_found";
  }
  return "network";
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function DeviceApprovalFlow({ initialUserCode, signedInEmail }: Props) {
  const [phase, setPhase] = useState<Phase>("enter");
  const [code, setCode] = useState<string>(
    initialUserCode ? formatUserCode(initialUserCode) : "",
  );
  const [lookup, setLookup] = useState<LookupResult | null>(null);
  const [errorKind, setErrorKind] = useState<ErrorKind | null>(null);

  // Guards a double auto-lookup under React 18 StrictMode's double-invoke.
  const autoLookupDone = useRef(false);

  // -----------------------------------------------------------------------
  // Session helper — same pattern as BenefitsCalPanel / MissingItemRequestPanel.
  // -----------------------------------------------------------------------

  const getAccessToken = useCallback(async (): Promise<string> => {
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      // Middleware should have redirected an unauthenticated visitor to /login
      // long before here; this is a belt-and-suspenders guard.
      throw new Error("No active session");
    }
    return session.access_token;
  }, []);

  // -----------------------------------------------------------------------
  // Actions
  // -----------------------------------------------------------------------

  const runLookup = useCallback(
    async (rawCode: string) => {
      if (!isCompleteCode(rawCode)) return;
      setPhase("looking_up");
      setErrorKind(null);
      try {
        const jwt = await getAccessToken();
        const result = (await api.oauth.lookup(jwt, formatUserCode(rawCode))) as LookupResult;
        setLookup(result);
        setPhase("confirm");
      } catch (err) {
        setErrorKind(classifyError(err, "lookup"));
        setPhase("error");
      }
    },
    [getAccessToken],
  );

  const approve = useCallback(async () => {
    setPhase("approving");
    setErrorKind(null);
    try {
      const jwt = await getAccessToken();
      await api.oauth.approve(jwt, formatUserCode(code));
      setPhase("approved");
    } catch (err) {
      setErrorKind(classifyError(err, "approve"));
      setPhase("error");
    }
  }, [getAccessToken, code]);

  const deny = useCallback(async () => {
    setPhase("denying");
    setErrorKind(null);
    try {
      const jwt = await getAccessToken();
      await api.oauth.deny(jwt, formatUserCode(code));
      setPhase("denied");
    } catch (err) {
      setErrorKind(classifyError(err, "deny"));
      setPhase("error");
    }
  }, [getAccessToken, code]);

  /** Reset back to a fresh, empty code-entry state (after an error / retry). */
  const reset = useCallback(() => {
    setCode("");
    setLookup(null);
    setErrorKind(null);
    setPhase("enter");
  }, []);

  // -----------------------------------------------------------------------
  // Auto-lookup when deep-linked with ?user_code=XXXX-XXXX.
  // -----------------------------------------------------------------------

  useEffect(() => {
    if (autoLookupDone.current) return;
    if (initialUserCode && isCompleteCode(initialUserCode)) {
      autoLookupDone.current = true;
      void runLookup(initialUserCode);
    }
  }, [initialUserCode, runLookup]);

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <div className="w-full max-w-md">
      <Brand />

      <div className="bg-surface border border-hairline rounded-[4px] p-8">
        {phase === "enter" && (
          <EnterCode
            code={code}
            onChange={setCode}
            onSubmit={() => void runLookup(code)}
            signedInEmail={signedInEmail}
          />
        )}

        {phase === "looking_up" && <Busy label="Looking up this code…" />}

        {phase === "confirm" && lookup && (
          <Confirm
            lookup={lookup}
            code={formatUserCode(code)}
            signedInEmail={signedInEmail}
            onApprove={() => void approve()}
            onDeny={() => void deny()}
            onCancel={reset}
          />
        )}

        {phase === "approving" && <Busy label="Connecting this device…" />}
        {phase === "denying" && <Busy label="Rejecting this request…" />}

        {phase === "approved" && <Approved />}
        {phase === "denied" && <Denied onReset={reset} />}

        {phase === "error" && errorKind && (
          <ErrorState kind={errorKind} onRetry={reset} />
        )}
      </div>

      <p className="text-[12px] text-muted text-center mt-5 leading-relaxed">
        Connecting an extension lets it read your organization&rsquo;s packets and
        pre-fill the BenefitsCal application form. You always review and submit
        each application yourself — Civica never submits on its own.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Brand header (compact, matches login page mark + wordmark)
// ---------------------------------------------------------------------------

function Brand() {
  return (
    <div className="flex items-center gap-3 mb-6">
      <div className="w-10 h-10 rounded-[8px] overflow-hidden ring-1 ring-black/5 shrink-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/civica-mark.svg"
          alt="Civica"
          width={40}
          height={40}
          className="w-full h-full object-cover"
        />
      </div>
      <div>
        <h1 className="text-[20px] font-semibold tracking-tight text-ink leading-tight">
          Connect a device
        </h1>
        <p className="text-[12px] text-muted mt-0.5">Civica Submitter extension</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Phase: enter code
// ---------------------------------------------------------------------------

function EnterCode({
  code,
  onChange,
  onSubmit,
  signedInEmail,
}: {
  code: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  signedInEmail: string | null;
}) {
  const complete = isCompleteCode(code);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (complete) onSubmit();
      }}
    >
      <p className="eyebrow mb-2">Enter code</p>
      <h2 className="text-[18px] font-semibold tracking-tight text-ink mb-2">
        Enter the code from your browser
      </h2>
      <p className="text-[13px] text-graphite mb-5 leading-relaxed">
        The Civica Submitter extension shows an 8-character code. Type it below
        to connect that browser to your Civica account.
      </p>

      <label htmlFor="device-user-code" className="block text-[13px] font-medium text-graphite mb-1.5">
        Connection code
      </label>
      <input
        id="device-user-code"
        name="user_code"
        type="text"
        inputMode="text"
        autoComplete="one-time-code"
        autoCapitalize="characters"
        spellCheck={false}
        autoFocus
        placeholder="XXXX-XXXX"
        aria-label="Connection code"
        value={code}
        // Format-on-type to XXXX-XXXX (uppercased, dash inserted). The server
        // strips the dash before hashing, so either form is accepted.
        onChange={(e) => onChange(formatUserCode(e.target.value))}
        className="w-full border border-hairline rounded-[3px] px-3 py-2.5 text-[18px] font-mono tracking-[0.25em] uppercase bg-paper focus:outline-none focus:border-pine focus:bg-white focus:ring-2 focus:ring-pine/30 transition-colors"
      />

      <button
        type="submit"
        disabled={!complete}
        className="w-full mt-5 bg-pine text-white py-3 rounded-[3px] text-[15px] font-medium hover:bg-pine-pressed disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        Continue
      </button>

      {signedInEmail && (
        <p className="text-[12px] text-muted mt-4 text-center">
          Signed in as <span className="text-graphite font-medium">{signedInEmail}</span>
        </p>
      )}
    </form>
  );
}

// ---------------------------------------------------------------------------
// Phase: busy (looking up / approving / denying)
// ---------------------------------------------------------------------------

function Busy({ label }: { label: string }) {
  return (
    <div className="py-6 flex flex-col items-center text-center" role="status" aria-live="polite">
      <Spinner />
      <p className="text-[14px] text-graphite mt-4">{label}</p>
    </div>
  );
}

function Spinner() {
  return (
    <span
      className="inline-block w-6 h-6 rounded-full border-2 border-hairline border-t-pine animate-spin motion-reduce:animate-none"
      aria-hidden="true"
    />
  );
}

// ---------------------------------------------------------------------------
// Phase: confirm — consent screen with the stakes spelled out
// ---------------------------------------------------------------------------

function Confirm({
  lookup,
  code,
  signedInEmail,
  onApprove,
  onDeny,
  onCancel,
}: {
  lookup: LookupResult;
  code: string;
  signedInEmail: string | null;
  onApprove: () => void;
  onDeny: () => void;
  onCancel: () => void;
}) {
  return (
    <div>
      <p className="eyebrow mb-2">Confirm</p>
      <h2 className="text-[18px] font-semibold tracking-tight text-ink mb-3">
        Connect this browser extension?
      </h2>

      {/* What's connecting */}
      <dl className="bg-surface-secondary border border-hairline rounded-[3px] p-4 mb-4 space-y-2 text-[13px]">
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-muted shrink-0">Code</dt>
          <dd className="text-ink font-mono tabular-nums">{code}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-muted shrink-0">Device</dt>
          <dd className="text-ink text-right break-words">
            {lookup.client_label?.trim() || "Civica Submitter extension"}
          </dd>
        </div>
        {signedInEmail && (
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-muted shrink-0">Your account</dt>
            <dd className="text-ink text-right break-words">{signedInEmail}</dd>
          </div>
        )}
      </dl>

      {/* Stakes — what the extension will be able to do once approved. */}
      <p className="text-[13px] font-semibold text-ink mb-2">
        Once connected, this extension will be able to:
      </p>
      <ul className="space-y-2 mb-5">
        <Capability>Read the SNAP packets that belong to your organization.</Capability>
        <Capability>
          Pre-fill the BenefitsCal application form in this browser from that
          packet&rsquo;s data.
        </Capability>
        <Capability tone="reassure">
          It cannot submit anything on its own — you review every form and click
          submit yourself.
        </Capability>
      </ul>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onApprove}
          className="flex-1 bg-pine text-white py-3 rounded-[3px] text-[15px] font-medium hover:bg-pine-pressed transition-colors"
        >
          Approve &amp; connect
        </button>
        <button
          type="button"
          onClick={onDeny}
          className="px-5 py-3 rounded-[3px] text-[15px] font-medium text-warning border border-warning/40 hover:bg-warning/10 transition-colors"
        >
          Deny
        </button>
      </div>

      <button
        type="button"
        onClick={onCancel}
        className="w-full mt-3 text-[12px] text-muted hover:text-graphite transition-colors"
      >
        Use a different code
      </button>
    </div>
  );
}

function Capability({
  children,
  tone = "default",
}: {
  children: React.ReactNode;
  tone?: "default" | "reassure";
}) {
  const dot = tone === "reassure" ? "bg-pine" : "bg-graphite/40";
  return (
    <li className="flex gap-2.5 text-[13px] text-graphite leading-relaxed">
      <span className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${dot}`} aria-hidden="true" />
      <span>{children}</span>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Phase: approved (terminal success)
// ---------------------------------------------------------------------------

function Approved() {
  return (
    <div className="py-4 text-center" role="status" aria-live="polite">
      <Badge tone="success" glyph="✓" label="Connected" />
      <h2 className="text-[18px] font-semibold tracking-tight text-ink mt-4 mb-2">
        This device is now connected
      </h2>
      <p className="text-[13px] text-graphite leading-relaxed">
        You can return to the Civica Submitter extension in your browser — it
        will finish connecting in a few seconds. You can close this tab.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Phase: denied (terminal)
// ---------------------------------------------------------------------------

function Denied({ onReset }: { onReset: () => void }) {
  return (
    <div className="py-4 text-center" role="status" aria-live="polite">
      <Badge tone="neutral" glyph="×" label="Rejected" />
      <h2 className="text-[18px] font-semibold tracking-tight text-ink mt-4 mb-2">
        Connection request rejected
      </h2>
      <p className="text-[13px] text-graphite leading-relaxed mb-5">
        This device was not connected to your account. The extension will not be
        able to read your packets. If this was a mistake, start a new connection
        from the extension.
      </p>
      <button
        type="button"
        onClick={onReset}
        className="text-[13px] font-medium text-pine hover:text-pine-pressed transition-colors"
      >
        Enter a different code
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Phase: error — actionable per kind, using --color-warning for problems.
// ---------------------------------------------------------------------------

const ERROR_COPY: Record<ErrorKind, { title: string; body: string; retryLabel: string }> = {
  not_found: {
    title: "We couldn’t find that code",
    body: "Double-check the 8-character code shown in the extension. It may have a typo, or it may have already expired — codes are only valid for a short time.",
    retryLabel: "Try another code",
  },
  expired: {
    title: "That code has expired",
    body: "Connection codes are only valid for a few minutes. Go back to the Civica Submitter extension and start a new connection to get a fresh code.",
    retryLabel: "Enter a new code",
  },
  already_used: {
    title: "That code was already used",
    body: "This connection code has already been approved or rejected. If you still need to connect a device, start a new connection from the extension.",
    retryLabel: "Enter a new code",
  },
  no_org: {
    title: "Your account isn’t linked to an organization",
    body: "Connecting a device binds it to your CBO so the extension can read that organization’s packets. Your account has no organization assigned — contact your Civica administrator before connecting a device.",
    retryLabel: "Start over",
  },
  network: {
    title: "Something went wrong",
    body: "We couldn’t reach Civica to process that. Check your connection and try again.",
    retryLabel: "Try again",
  },
};

function ErrorState({ kind, onRetry }: { kind: ErrorKind; onRetry: () => void }) {
  const copy = ERROR_COPY[kind];
  return (
    <div className="py-2" role="alert">
      <div className="flex items-start gap-3">
        <span
          className="mt-0.5 w-7 h-7 rounded-full bg-warning/15 text-warning flex items-center justify-center text-[15px] font-semibold shrink-0"
          role="img"
          aria-label="Warning"
        >
          !
        </span>
        <div>
          <h2 className="text-[16px] font-semibold tracking-tight text-ink mb-1.5">
            {copy.title}
          </h2>
          <p className="text-[13px] text-graphite leading-relaxed">{copy.body}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={onRetry}
        className="w-full mt-5 bg-pine text-white py-2.5 rounded-[3px] text-[14px] font-medium hover:bg-pine-pressed transition-colors"
      >
        {copy.retryLabel}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Terminal-state badge — circle glyph + text label (color is never the only
// signal, per DESIGN.md §6.4).
// ---------------------------------------------------------------------------

function Badge({
  tone,
  glyph,
  label,
}: {
  tone: "success" | "neutral";
  glyph: string;
  label: string;
}) {
  const cls =
    tone === "success" ? "bg-pine-surface text-pine" : "bg-surface-secondary text-graphite";
  return (
    <div className="flex flex-col items-center gap-2">
      <span
        className={`w-12 h-12 rounded-full flex items-center justify-center text-[22px] font-semibold ${cls}`}
        role="img"
        aria-label={label}
      >
        <span aria-hidden="true">{glyph}</span>
      </span>
      <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-graphite">
        {label}
      </span>
    </div>
  );
}
