"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../lib/supabase";

type Mode = "signin" | "forgot" | "sent";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<Mode>("signin");
  const [forgotEmail, setForgotEmail] = useState("");

  // If middleware bounced us here for missing staff role, kill the lingering
  // applicant session so we don't loop back to /packets → /login.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (new URLSearchParams(window.location.search).get("error") !== "staff_only") return;
    setError("This account does not have navigator access.");
    void createClient().auth.signOut();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      router.push("/packets");
      router.refresh();
    }
  }

  function openForgotPassword() {
    setError(null);
    setForgotEmail(email);
    setMode("forgot");
  }

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!forgotEmail) return;
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    });
    setLoading(false);
    if (error) {
      setError(error.message);
    } else {
      setMode("sent");
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

  if (mode === "sent") {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="bg-surface p-8 rounded-[4px] border border-hairline shadow-md w-full max-w-md">
          {lockup}
          <div className="py-4 text-center">
            <p className="text-[15px] text-ink font-medium mb-1">Check your email</p>
            <p className="text-[13px] text-muted">We sent a password reset link to <strong>{forgotEmail}</strong>.</p>
            <button
              type="button"
              onClick={() => { setMode("signin"); setError(null); }}
              className="mt-5 text-[13px] text-pine hover:underline"
            >
              Back to sign in
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (mode === "forgot") {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="bg-surface p-8 rounded-[4px] border border-hairline shadow-md w-full max-w-md">
          {lockup}
          <h2 className="text-[24px] font-semibold tracking-tight text-ink mb-4">Reset your password</h2>
          <p className="text-[14px] text-muted mb-6">Enter your email and we'll send you a link to set a new password.</p>
          <form onSubmit={handleForgotPassword} className="space-y-5">
            <div>
              <label className="block text-[13px] font-medium text-graphite mb-1.5">Email</label>
              <input
                type="email"
                required
                autoFocus
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                className="w-full border border-input rounded-[3px] px-3 py-2.5 text-[15px] bg-paper focus:outline-none focus:border-pine focus:bg-white focus:ring-2 focus:ring-pine/30 transition-colors"
              />
            </div>
            {error && <p className="text-[13px] text-error">{error}</p>}
            <button
              type="submit"
              disabled={loading || !forgotEmail}
              className="w-full bg-pine text-white py-3 rounded-[3px] text-[15px] font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {loading ? "Sending…" : "Send reset link"}
            </button>
            <p className="text-center text-[14px] text-muted pt-1">
              <button
                type="button"
                onClick={() => { setMode("signin"); setError(null); }}
                className="text-pine hover:underline font-medium"
              >
                Back to sign in
              </button>
            </p>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="bg-surface p-8 rounded-[4px] border border-hairline shadow-md w-full max-w-md">
        {lockup}
        <h2 className="text-[24px] font-semibold tracking-tight text-ink mb-4">Welcome back</h2>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-[13px] font-medium text-graphite mb-1.5">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-input rounded-[3px] px-3 py-2.5 text-[15px] bg-paper focus:outline-none focus:border-pine focus:bg-white focus:ring-2 focus:ring-pine/30 transition-colors"
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-[13px] font-medium text-graphite">Password</label>
              <button
                type="button"
                onClick={openForgotPassword}
                className="text-[12px] text-pine hover:underline transition-opacity"
              >
                Forgot password?
              </button>
            </div>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-input rounded-[3px] px-3 py-2.5 text-[15px] bg-paper focus:outline-none focus:border-pine focus:bg-white focus:ring-2 focus:ring-pine/30 transition-colors"
            />
          </div>
          {error && <p className="text-[13px] text-error">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-pine text-white py-3 rounded-[3px] text-[15px] font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
          <p className="text-center text-[14px] text-muted pt-1">
            New to Civica?{" "}
            <a href="/sign-up" className="text-pine hover:underline font-medium">
              Request access
            </a>
          </p>
        </form>
      </div>
    </div>
  );
}
