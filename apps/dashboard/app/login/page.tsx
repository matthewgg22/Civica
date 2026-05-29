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

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="bg-surface p-10 rounded-[4px] border border-hairline w-full max-w-md">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-[8px] overflow-hidden ring-1 ring-black/5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/civica-mark.svg" alt="Civica" width={40} height={40} className="w-full h-full object-cover" />
          </div>
          <div>
            <h1 className="text-[20px] font-semibold tracking-tight text-ink leading-tight">Civica Navigator</h1>
            <p className="text-[12px] text-muted mt-0.5">SNAP Enrollment</p>
          </div>
        </div>
        <p className="eyebrow mb-2">Sign In</p>
        <h2 className="text-[24px] font-semibold tracking-tight text-ink mb-8">Welcome back</h2>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-[13px] font-medium text-graphite mb-1.5">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-hairline rounded-[3px] px-3 py-2.5 text-[15px] bg-paper focus:outline-none focus:border-pine focus:bg-white focus:ring-2 focus:ring-pine/30 transition-colors"
            />
          </div>
          <div>
            <label className="block text-[13px] font-medium text-graphite mb-1.5">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-hairline rounded-[3px] px-3 py-2.5 text-[15px] bg-paper focus:outline-none focus:border-pine focus:bg-white focus:ring-2 focus:ring-pine/30 transition-colors"
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
        </form>
      </div>
    </div>
  );
}
