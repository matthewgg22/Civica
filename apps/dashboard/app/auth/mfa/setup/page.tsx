"use client";

// Optional 2FA enrollment. Accessible from the nav — not forced, but once
// enrolled the middleware requires it on every login session.

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../../../lib/supabase";

type Stage = "loading" | "qr" | "verifying" | "success" | "error";

export default function MFASetupPage() {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("loading");
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.mfa.enroll({ factorType: "totp", issuer: "Civica Navigator" }).then(({ data, error: err }) => {
      if (err || !data) {
        setStage("error");
        return;
      }
      setQrCode(data.totp.qr_code);
      setSecret(data.totp.secret);
      setFactorId(data.id);
      setStage("qr");
    });
  }, []);

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!factorId) return;
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { data: challenge, error: cErr } = await supabase.auth.mfa.challenge({ factorId });
    if (cErr || !challenge) {
      setError("Could not start verification. Try again.");
      setLoading(false);
      return;
    }
    const { error: vErr } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.id,
      code: code.replace(/\s/g, ""),
    });
    if (vErr) {
      setError("Invalid code. Make sure your phone clock is accurate and try again.");
      setLoading(false);
    } else {
      setStage("success");
    }
  }

  const lockup = (
    <div className="flex items-center gap-4 mb-6">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/civica-wheat-mark.png" alt="Civica" width={68} height={68} className="w-[68px] h-[68px] object-contain shrink-0" />
      <div className="flex flex-col justify-center">
        <h1 className="text-[24px] font-semibold tracking-tight text-ink leading-none">Civica Navigator</h1>
        <p className="text-[13px] text-muted mt-1.5 leading-none">Set up two-factor authentication</p>
      </div>
    </div>
  );

  if (stage === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="bg-surface p-8 rounded-[4px] border border-hairline shadow-md w-full max-w-md">
          {lockup}
          <p className="text-[14px] text-muted">Generating your setup code…</p>
        </div>
      </div>
    );
  }

  if (stage === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="bg-surface p-8 rounded-[4px] border border-hairline shadow-md w-full max-w-md">
          {lockup}
          <p className="text-[14px] text-error">Could not start 2FA setup. You may already have it configured.</p>
          <a href="/packets" className="mt-4 inline-block text-[13px] text-pine hover:underline">Back to dashboard</a>
        </div>
      </div>
    );
  }

  if (stage === "success") {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="bg-surface p-8 rounded-[4px] border border-hairline shadow-md w-full max-w-md text-center">
          {lockup}
          <p className="text-[15px] text-ink font-medium mb-2">Two-factor authentication is on</p>
          <p className="text-[14px] text-muted leading-relaxed mb-5">
            You'll be asked for a code from your authenticator app each time you sign in.
          </p>
          <button
            onClick={() => { router.push("/packets"); router.refresh(); }}
            className="bg-pine text-white px-6 py-2.5 rounded-[3px] text-[14px] font-medium hover:opacity-90 transition-opacity"
          >
            Go to dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="bg-surface p-8 rounded-[4px] border border-hairline shadow-md w-full max-w-md">
        {lockup}
        <h2 className="text-[24px] font-semibold tracking-tight text-ink mb-2">Set up authenticator app</h2>
        <ol className="text-[14px] text-muted space-y-1 mb-5 leading-relaxed list-decimal list-inside">
          <li>Install Google Authenticator, Authy, or 1Password on your phone.</li>
          <li>Tap "Add account" and scan the QR code below.</li>
          <li>Enter the 6-digit code to confirm.</li>
        </ol>

        {qrCode && (
          <div className="flex justify-center mb-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrCode} alt="Scan this QR code with your authenticator app" className="w-44 h-44 border border-hairline rounded-[3px] p-1" />
          </div>
        )}

        {secret && (
          <details className="mb-5">
            <summary className="text-[12px] text-muted cursor-pointer select-none hover:text-graphite">
              Can't scan? Enter this code manually
            </summary>
            <code className="mt-2 block text-[12px] font-mono text-graphite bg-paper border border-hairline rounded-[3px] px-3 py-2 tracking-wider break-all">
              {secret}
            </code>
          </details>
        )}

        <form onSubmit={handleVerify} className="space-y-4">
          <div>
            <label className="block text-[13px] font-medium text-graphite mb-1.5">Enter the 6-digit code</label>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="000000"
              className="w-full border border-input rounded-[3px] px-3 py-2.5 text-[15px] tracking-widest bg-paper focus:outline-none focus:border-pine focus:bg-white focus:ring-2 focus:ring-pine/30 transition-colors"
            />
          </div>
          {error && <p className="text-[13px] text-error">{error}</p>}
          <button
            type="submit"
            disabled={loading || code.length < 6}
            className="w-full bg-pine text-white py-3 rounded-[3px] text-[15px] font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {loading ? "Confirming…" : "Confirm and enable 2FA"}
          </button>
        </form>
      </div>
    </div>
  );
}
