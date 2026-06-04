"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "../../../lib/supabase";

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <ResetPasswordForm />
    </Suspense>
  );
}

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  type Stage = "exchanging" | "invalid" | "form" | "submitting" | "success" | "error";
  const [stage, setStage] = useState<Stage>("exchanging");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const code = searchParams.get("code");
    if (!code) {
      setStage("invalid");
      return;
    }
    const supabase = createClient();
    supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
      if (error) {
        setStage("invalid");
      } else {
        setStage("form");
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setStage("submitting");
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setError(error.message);
      setStage("error");
    } else {
      setStage("success");
      setTimeout(() => router.push("/login"), 2000);
    }
  }

  const lockup = (
    <div className="flex items-center gap-4 mb-6">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/civica-wheat-mark.png" alt="Civica" width={68} height={68} className="w-[68px] h-[68px] object-contain shrink-0" />
      <div className="flex flex-col justify-center">
        <h1 className="text-[24px] font-semibold tracking-tight text-ink leading-none">Civica Navigator</h1>
        <p className="text-[13px] text-muted mt-1.5 leading-none">SNAP Enrollment</p>
      </div>
    </div>
  );

  if (stage === "exchanging") {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="bg-surface p-8 rounded-[4px] border border-hairline shadow-md w-full max-w-md">
          {lockup}
          <p className="text-[14px] text-muted">Verifying your reset link…</p>
        </div>
      </div>
    );
  }

  if (stage === "invalid") {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="bg-surface p-8 rounded-[4px] border border-hairline shadow-md w-full max-w-md">
          {lockup}
          <p className="text-[15px] text-ink font-medium mb-2">Invalid or expired link</p>
          <p className="text-[14px] text-muted mb-6">This password reset link has expired or already been used. Request a new one from the sign-in page.</p>
          <a
            href="/login"
            className="inline-block w-full text-center bg-pine text-white py-3 rounded-[3px] text-[15px] font-medium hover:opacity-90 transition-opacity"
          >
            Back to sign in
          </a>
        </div>
      </div>
    );
  }

  if (stage === "success") {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="bg-surface p-8 rounded-[4px] border border-hairline shadow-md w-full max-w-md text-center">
          {lockup}
          <p className="text-[15px] text-ink font-medium mb-1">Password updated</p>
          <p className="text-[13px] text-muted">Redirecting you to sign in…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="bg-surface p-8 rounded-[4px] border border-hairline shadow-md w-full max-w-md">
        {lockup}
        <h2 className="text-[24px] font-semibold tracking-tight text-ink mb-2">Set a new password</h2>
        <p className="text-[14px] text-muted mb-6">Choose a strong password for your Civica account.</p>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="rp-password" className="block text-[13px] font-medium text-graphite mb-1.5">New password</label>
            <input
              id="rp-password"
              type="password"
              required
              autoFocus
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-input rounded-[3px] px-3 py-2.5 text-[15px] bg-paper focus:outline-none focus:border-pine focus:bg-white focus:ring-2 focus:ring-pine/30 transition-colors"
            />
          </div>
          <div>
            <label htmlFor="rp-confirm" className="block text-[13px] font-medium text-graphite mb-1.5">Confirm password</label>
            <input
              id="rp-confirm"
              type="password"
              required
              minLength={8}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full border border-input rounded-[3px] px-3 py-2.5 text-[15px] bg-paper focus:outline-none focus:border-pine focus:bg-white focus:ring-2 focus:ring-pine/30 transition-colors"
            />
          </div>
          {error && <p className="text-[13px] text-error">{error}</p>}
          <button
            type="submit"
            disabled={stage === "submitting"}
            className="w-full bg-pine text-white py-3 rounded-[3px] text-[15px] font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {stage === "submitting" ? "Saving…" : "Set password"}
          </button>
        </form>
      </div>
    </div>
  );
}
