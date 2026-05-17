"use client";

import { useCallback, useEffect, useState } from "react";
import { usePlaidLink } from "react-plaid-link";

export interface PlaidLinkResult {
  public_token: string;
  access_token: string;
  institution_name: string;
}

interface Props {
  userId: string;
  label?: string;
  onSuccess: (result: PlaidLinkResult) => void;
  onError?: (err: string) => void;
  disabled?: boolean;
}

export default function PlaidLinkButton({ userId, label, onSuccess, onError, disabled }: Props) {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [fetching, setFetching] = useState(false);
  const [isFixture, setIsFixture] = useState(false);

  useEffect(() => {
    setFetching(true);
    fetch("/api/plaid/link-token", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId }),
    })
      .then((r) => r.json())
      .then((d) => {
        setLinkToken(d.link_token);
        // Tokens that start with "link-sandbox-" but contain our fixture marker
        // are synthetic — we skip the real widget and simulate success.
        setIsFixture(/^link-sandbox-.+-[a-z0-9]{8}$/.test(d.link_token ?? ""));
      })
      .catch(() => onError?.("Failed to get Plaid link token"))
      .finally(() => setFetching(false));
  }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  const exchangeToken = useCallback(
    async (publicToken: string, institutionName: string) => {
      const { access_token } = await fetch("/api/plaid/exchange", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ public_token: publicToken }),
      }).then((r) => r.json());
      onSuccess({ public_token: publicToken, access_token, institution_name: institutionName });
    },
    [onSuccess]
  );

  const { open, ready } = usePlaidLink({
    token: linkToken ?? "",
    onSuccess: (publicToken, metadata) => {
      exchangeToken(publicToken, metadata.institution?.name ?? "Bank");
    },
    onExit: (err) => {
      if (err) onError?.(err.display_message ?? "Plaid Link closed with error");
    },
  });

  const handleFixtureConnect = useCallback(() => {
    exchangeToken("public-sandbox-fixture-token", "Sandbox Bank");
  }, [exchangeToken]);

  if (fetching || !linkToken) {
    return (
      <button disabled className="btn">
        Preparing Plaid Link…
      </button>
    );
  }

  if (isFixture) {
    return (
      <div>
        <button disabled={disabled} onClick={handleFixtureConnect} className="btn">
          {label ?? "Connect bank with Plaid (sandbox fixture)"}
        </button>
        <span style={{ fontSize: 12, color: "var(--muted)", marginLeft: 10 }}>
          No credentials configured — using fixture data.{" "}
          <a
            href="https://plaid.com/docs/quickstart/"
            target="_blank"
            rel="noreferrer"
          >
            Add PLAID_CLIENT_ID + PLAID_SECRET to use real Plaid sandbox.
          </a>
        </span>
      </div>
    );
  }

  return (
    <button disabled={disabled || !ready} onClick={() => open()} className="btn">
      {label ?? "Connect bank with Plaid Link"}
    </button>
  );
}
