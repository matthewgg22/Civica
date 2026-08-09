"use client";

// /screen/sign-in — work email + password (mockup frame 02).
//
// A SEPARATE auth surface from /sign-in (Google OAuth, the B2C /apply
// flow) — deliberately not unified. Org membership is Supabase
// email+password here; supabaseBrowser()'s signInWithPassword() writes the
// session cookie itself (via @supabase/ssr), which resolveOrgIdentity()
// then reads server-side on the next request. No server action needed for
// the sign-in call itself.
//
// "Continue with your organization's SSO" is a visible but disabled stub —
// no real SAML/OIDC wired up yet. Shipping the button now (rather than
// omitting it) matches the mockup and signals the roadmap without
// overbuilding infrastructure nobody's asked to configure yet.

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "../../../lib/supabase-browser";
import { DemeterMark } from "../../../components/DemeterMark";

export default function ScreeningSignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password || busy) return;
    setBusy(true);
    setError(null);
    try {
      const { error: authError } = await supabaseBrowser().auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (authError) {
        setError("Couldn't sign in with that email and password. Please try again.");
        return;
      }
      router.push("/screen/session");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="screen-auth">
      <header className="screen-landing__head">
        <div className="screen-landing__brand">
          <DemeterMark size={32} />
          <span className="screen-landing__brand-name">Demeter</span>
        </div>
      </header>

      <main className="screen-auth__main">
        <div className="screen-auth__card">
          <h1 className="screen-auth__title">Sign in</h1>
          <p className="screen-auth__subtitle">Sign in with your organization&apos;s account.</p>

          <form className="screen-auth__form" onSubmit={onSubmit}>
            <label className="screen-auth__label" htmlFor="screen-signin-email">
              Work email
            </label>
            <input
              id="screen-signin-email"
              className="screen-auth__input"
              type="email"
              autoComplete="email"
              value={email}
              disabled={busy}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <label className="screen-auth__label" htmlFor="screen-signin-password">
              Password
            </label>
            <input
              id="screen-signin-password"
              className="screen-auth__input"
              type="password"
              autoComplete="current-password"
              value={password}
              disabled={busy}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            {error && (
              <div className="screen-auth__error" role="alert">
                {error}
              </div>
            )}

            <button type="submit" className="screen-auth__submit" disabled={busy}>
              {busy ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <button
            type="button"
            className="screen-auth__sso"
            disabled
            title="Organization SSO is coming soon — sign in with your work email and password for now."
          >
            Continue with your organization&apos;s SSO
          </button>

          <div className="screen-auth__links">
            <a href="mailto:hello@demeter.ai?subject=Request%20access%20to%20Demeter%20screening">
              Request access
            </a>
            <a href="/screen/session">Continue as a guest →</a>
          </div>
        </div>
      </main>
    </div>
  );
}
