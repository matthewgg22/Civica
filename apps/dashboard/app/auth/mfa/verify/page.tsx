"use client";

// Shown when a navigator has TOTP enrolled but hasn't verified this session.
// Middleware redirects here when currentLevel=aal1 but nextLevel=aal2.
//
// #512: middleware now ALSO redirects here on an indeterminate AAL check
// (error, or still erroring after one retry) — a fail-closed response to a
// Supabase blip, not just the normal "enrolled but unverified" case. That
// means a visitor who lands here might not actually have a TOTP factor at
// all (a non-enrolled staff member hit the same transient error). The old
// version handled that silently: listFactors() found nothing, factorId/
// challengeId stayed null, and the Verify button just sat permanently
// disabled with no explanation — effectively locking that person out with
// no way forward. checkState below makes that an explicit, actionable
// branch instead of a mystery-disabled form.

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../../../lib/supabase";

type CheckState = "checking" | "ready" | "no_factor" | "check_failed";

export default function MFAVerifyPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [factorId, setFactorId] = useState<string | null>(null);
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkState, setCheckState] = useState<CheckState>("checking");

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.mfa
      .listFactors()
      .then(({ data, error: listErr }) => {
        if (listErr) {
          setCheckState("check_failed");
          return;
        }
        const totp = data?.totp?.[0];
        if (!totp) {
          // Genuinely not enrolled — nothing to verify. Middleware only
          // sends non-enrolled staff here on a failed AAL check (fail-
          // closed), not as a normal flow, so this is the recovery path
          // for that case rather than an error in itself.
          setCheckState("no_factor");
          return;
        }
        setFactorId(totp.id);
        supabase.auth.mfa.challenge({ factorId: totp.id }).then(({ data: c, error: challengeErr }) => {
          if (challengeErr || !c) {
            setCheckState("check_failed");
            return;
          }
          setChallengeId(c.id);
          setCheckState("ready");
        });
      })
      .catch(() => setCheckState("check_failed"));
  }, []);

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!factorId || !challengeId) return;
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error: err } = await supabase.auth.mfa.verify({
      factorId,
      challengeId,
      code: code.replace(/\s/g, ""),
    });
    if (err) {
      setError("Invalid code. Check your authenticator app and try again.");
      setLoading(false);
    } else {
      router.replace("/packets");
      router.refresh();
    }
  }

  const lockup = (
    <div className="flex items-center gap-4 mb-6">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/civica-wheat-mark.png" alt="Civica" width={68} height={68} className="w-[68px] h-[68px] object-contain shrink-0" />
      <div className="flex flex-col justify-center">
        <h1 className="text-[24px] font-semibold tracking-tight text-ink leading-none">Civica Navigator</h1>
        <p className="text-[13px] text-muted mt-1.5 leading-none">Two-factor verification</p>
      </div>
    </div>
  );

  // #512: no_factor / check_failed both land here on a fail-closed
  // redirect, not the normal "enrolled but unverified" flow — the actual
  // fix in both cases is usually just retrying (the AAL check that sent
  // them here was itself transient), so lead with that rather than a dead
  // end.
  if (checkState === "no_factor" || checkState === "check_failed") {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="bg-surface p-8 rounded-[4px] border border-hairline shadow-md w-full max-w-md">
          {lockup}
          <h2 className="text-[24px] font-semibold tracking-tight text-ink mb-2">
            {checkState === "no_factor" ? "No two-factor method found" : "Couldn't verify two-factor status"}
          </h2>
          <p className="text-[14px] text-muted mb-6 leading-relaxed">
            {checkState === "no_factor"
              ? "We couldn't confirm your account's two-factor status, and no authenticator is set up on it. This is usually a temporary connection issue — try again."
              : "We couldn't reach the two-factor verification service. This is usually temporary — try again."}
          </p>
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="w-full bg-pine text-white py-3 rounded-[3px] text-[15px] font-medium hover:opacity-90 transition-opacity"
            >
              Try again
            </button>
            <form action="/auth/signout" method="post">
              <button
                type="submit"
                className="w-full border border-hairline text-graphite py-3 rounded-[3px] text-[15px] font-medium hover:bg-paper transition-colors"
              >
                Sign out
              </button>
            </form>
          </div>
          <p className="text-[12px] text-muted mt-5 leading-relaxed">
            Still stuck after a few tries? Contact your administrator.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="bg-surface p-8 rounded-[4px] border border-hairline shadow-md w-full max-w-md">
        {lockup}
        <h2 className="text-[24px] font-semibold tracking-tight text-ink mb-2">Check your authenticator</h2>
        <p className="text-[14px] text-muted mb-6 leading-relaxed">
          Open your authenticator app and enter the 6-digit code for Civica.
        </p>
        <form onSubmit={handleVerify} className="space-y-5">
          <div>
            <label htmlFor="mfa-code" className="block text-[13px] font-medium text-graphite mb-1.5">6-digit code</label>
            <input
              id="mfa-code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="000000"
              className="w-full border border-input rounded-[3px] px-3 py-2.5 text-[15px] tracking-widest bg-paper focus:outline-none focus:border-pine focus:bg-white focus:ring-2 focus:ring-pine/30 transition-colors"
            />
          </div>
          {error && <p className="text-[13px] text-error">{error}</p>}
          <button
            type="submit"
            disabled={loading || code.length < 6 || !challengeId || checkState !== "ready"}
            className="w-full bg-pine text-white py-3 rounded-[3px] text-[15px] font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {loading ? "Verifying…" : checkState === "checking" ? "Checking…" : "Verify"}
          </button>
        </form>
      </div>
    </div>
  );
}
