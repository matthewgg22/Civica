"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

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

  async function handleForgotPassword() {
    if (!email) {
      setError("Enter your email above, then click Forgot password.");
      return;
    }
    setResetLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    });
    setResetLoading(false);
    if (error) {
      setError(error.message);
    } else {
      setResetSent(true);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="bg-surface p-10 rounded-[4px] border border-hairline w-full max-w-md">
        {/* Lockup: disc + wordmark, vertically centered against each other */}
        <div className="flex items-center gap-4 mb-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/civica-wheat-mark.png" alt="Civica" width={68} height={68} className="w-[68px] h-[68px] object-contain shrink-0" />
          <div className="flex flex-col justify-center">
            <h1 className="text-[22px] font-semibold tracking-tight text-ink leading-none">Civica Navigator</h1>
            <p className="text-[13px] text-muted mt-1.5 leading-none">SNAP Enrollment</p>
          </div>
        </div>

        <p className="eyebrow mb-2">Sign In</p>
        <h2 className="text-[24px] font-semibold tracking-tight text-ink mb-8">Welcome back</h2>

        {resetSent ? (
          <div className="py-4 text-center">
            <p className="text-[15px] text-ink font-medium mb-1">Check your email</p>
            <p className="text-[13px] text-muted">We sent a password reset link to <strong>{email}</strong>.</p>
            <button
              type="button"
              onClick={() => setResetSent(false)}
              className="mt-5 text-[13px] text-pine hover:underline"
            >
              Back to sign in
            </button>
          </div>
        ) : (
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
                  disabled={resetLoading}
                  onClick={handleForgotPassword}
                  className="text-[12px] text-pine hover:underline disabled:opacity-50 transition-opacity"
                >
                  {resetLoading ? "Sending…" : "Forgot password?"}
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
            <p className="text-center text-[12px] text-muted pt-1">
              New to Civica?{" "}
              <a href="/sign-up" className="text-pine hover:underline font-medium">
                Request access
              </a>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
