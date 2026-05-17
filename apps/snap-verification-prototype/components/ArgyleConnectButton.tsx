"use client";

// Argyle Link widget integration.
//
// Real flow:
//   1. Backend mints a user_token via /api/argyle/link-token
//   2. Frontend loads the Argyle Link.js CDN script
//   3. Opens the widget with the user_token
//   4. On itemConnected, backend fetches earnings for the linked account
//
// Without ARGYLE_API_KEY configured the backend returns a fixture user_token
// (starts with "argyle-sandbox-"). We detect that and skip the real widget,
// simulating a successful connection directly.

import { useCallback, useEffect, useRef, useState } from "react";

export interface ArgyleConnectResult {
  userId: string;
  accountId: string;
  employerName: string;
}

interface Props {
  applicantName: string;
  label?: string;
  onSuccess: (result: ArgyleConnectResult) => void;
  onError?: (err: string) => void;
  disabled?: boolean;
}

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Argyle?: any;
  }
}

const ARGYLE_CDN = "https://plugin.argyle.com/argyle.web.v5.js";

function loadArgyleScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${ARGYLE_CDN}"]`)) {
      resolve();
      return;
    }
    const s = document.createElement("script");
    s.src = ARGYLE_CDN;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Failed to load Argyle script"));
    document.head.appendChild(s);
  });
}

export default function ArgyleConnectButton({
  applicantName,
  label,
  onSuccess,
  onError,
  disabled,
}: Props) {
  const [userToken, setUserToken] = useState<string | null>(null);
  const [isFixture, setIsFixture] = useState(false);
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [fetching, setFetching] = useState(false);
  const instanceRef = useRef<unknown>(null);

  useEffect(() => {
    setFetching(true);
    fetch("/api/argyle/link-token", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ applicantName }),
    })
      .then((r) => r.json())
      .then((d) => {
        setUserToken(d.user_token);
        const fixture = /^argyle-sandbox-[a-z0-9]+$/.test(d.user_token ?? "");
        setIsFixture(fixture);
        if (!fixture) {
          loadArgyleScript()
            .then(() => setScriptLoaded(true))
            .catch(() => onError?.("Failed to load Argyle widget script"));
        }
      })
      .catch(() => onError?.("Failed to get Argyle user token"))
      .finally(() => setFetching(false));
  }, [applicantName]); // eslint-disable-line react-hooks/exhaustive-deps

  const openWidget = useCallback(() => {
    if (!window.Argyle || !userToken) return;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const link = window.Argyle.create({
      userToken,
      sandbox: true,
      onAccountConnected: ({ accountId, userId, employerName }: ArgyleConnectResult) => {
        onSuccess({ accountId, userId, employerName: employerName ?? "Unknown" });
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        (link as { close: () => void }).close();
      },
      onClose: () => {/* user dismissed */},
      onError: (err: { message: string }) => onError?.(err.message),
    });
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    (link as { open: () => void }).open();
    instanceRef.current = link;
  }, [userToken, onSuccess, onError]);

  const handleFixture = useCallback(() => {
    onSuccess({
      userId: `usr_fixture_${applicantName.replace(/\s+/g, "_").toLowerCase()}`,
      accountId: "acct_fixture",
      employerName: "Sandbox Employer",
    });
  }, [applicantName, onSuccess]);

  if (fetching || !userToken) {
    return <button disabled className="btn">Preparing Argyle Link…</button>;
  }

  if (isFixture) {
    return (
      <div>
        <button disabled={disabled} onClick={handleFixture} className="btn">
          {label ?? "Connect employer / platform (sandbox fixture)"}
        </button>
        <span style={{ fontSize: 12, color: "var(--muted)", marginLeft: 10 }}>
          No credentials configured — using fixture data.{" "}
          <a href="https://argyle.com/docs" target="_blank" rel="noreferrer">
            Add ARGYLE_API_KEY + ARGYLE_API_SECRET for real Argyle sandbox.
          </a>
        </span>
      </div>
    );
  }

  return (
    <button disabled={disabled || !scriptLoaded} onClick={openWidget} className="btn">
      {label ?? "Connect employer / platform with Argyle"}
    </button>
  );
}
