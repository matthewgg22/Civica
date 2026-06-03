---
id: 2026-06-03-resilience-audit-outcomes
date: 2026-06-03
scope: [observability, resilience, audit, web, ios, ci]
confidence: high
status: active
supersedes: []
superseded_by: []
evidence:
  - kind: pr
    ref: "#435"
    note: "iOS Sentry wire-up (SPM dep + CivicaSentry init + PII scrubber + tests)"
  - kind: pr
    ref: "#437"
    note: "apps/web error.tsx + global-error.tsx + not-found.tsx (bilingual EN/ES)"
  - kind: pr
    ref: "#438"
    note: "Sentry-Cocoa SentryRequest API hotfix (build break from #435)"
  - kind: pr
    ref: "#439"
    note: "snap-rules /server subpath split — unblocked Vercel dashboard build"
  - kind: pr
    ref: "#440"
    note: "apps/web @sentry/nextjs wire-up — closes last Sentry blind spot"
  - kind: pr
    ref: "#451"
    note: "LeadCaptureForm localStorage autosave + bilingual restore notice"
  - kind: pr
    ref: "#452"
    note: "Dashboard onRequestError hook — quiets Sentry build warning"
  - kind: pr
    ref: "#453"
    note: "Lychee link checker on docs/findings/ (PR + weekly cron + issue-on-rot)"
  - kind: file
    ref: "Civica/App/Observability/CivicaSentry.swift"
    line: 1
    note: "iOS Sentry init with PII scrubber lives here; covered by 12 unit tests in Civica Tests/Observability/"
  - kind: file
    ref: "apps/web/sentry.client.config.ts"
    line: 1
    note: "apps/web browser Sentry config; mirrors apps/dashboard exactly"
  - kind: file
    ref: "apps/web/components/LeadCaptureForm.tsx"
    line: 18
    note: "localStorage draft persistence with versioned schema key (civica-web.lead-draft-v1)"
  - kind: file
    ref: ".github/workflows/findings-link-check.yml"
    line: 1
    note: "lychee workflow ships in #453; PR + weekly Monday 06:00 PT cron"
  - kind: external
    ref: "chat-session-2026-06-03-resilience-audit"
    note: "Original audit question covered 5 areas: error boundaries, reset buttons, loading/empty states, form persistence, Sentry, dead links. Findings + remediation in this same session."
---

## What we found

A five-axis resilience audit (chat, 2026-06-03) of Civica's three user-facing surfaces — iOS, the staff dashboard, and the B2C marketing site — turned up the same shape of gap on each: **good per-feature recovery patterns where they exist, but no defaults at the surface level**. Sentry on every service *except* iOS and `apps/web`. Form persistence on iOS *but not* on the web pre-screener. Error boundaries on the dashboard *but not* on `apps/web`. The same gap pattern repeats: where someone wrote a thoughtful pattern locally, it stops at the file boundary.

Eight PRs (#435, #437, #438, #439, #440, #451, #452, #453) shipped during the same session closed all eight code-level remediations. Two operator activations remain.

## Why it matters

Civica is becoming the load-bearing artifact in a high-stakes pitch — CBO partnerships, county engagements, an OBBBA-aware compliance posture — and the audit gap shape implies that **every new user-facing surface starts at zero resilience** unless someone explicitly invests. Defaults beat discipline. Closing these gaps now means:

- **iOS crashes are no longer invisible.** Prior to #435 + #438, any on-device crash, eligibility-evaluation failure, or Keychain glitch never reached operators. The Civica audience is 100% mobile-onboarded; this was the single biggest blind spot.
- **`apps/web` is no longer first-impression-fragile.** A wrong URL surfaced raw Next.js 404 chrome; a render error fell through to the framework default. Marketing surfaces eat the brand cost of every unhandled state.
- **The B2C form no longer punishes tab-close.** A user filling out the CalFresh pre-screener on mobile transit who got interrupted lost everything. With #451 they keep what they typed.
- **Vercel CI is unblocked.** The `civica-api` Vercel project (which builds `apps/dashboard`) had been failing on every PR since at least #435, masked by CI's own webpack tree-shaking the same code path. #439 fixed it; main is green for the first time in weeks.
- **The findings ledger has a watchdog.** This very file relies on 120+ primary-source URLs. #453 catches rot on PR and weekly.

## What changes

**Activated this session:**

| Surface | Sentry wired | DSN set | Receiving |
| --- | --- | --- | --- |
| `civica-dashboard` | pre-existing | yes | yes (1.4K errors counted) |
| `civica-enrollment-api` | pre-existing | yes | yes |
| `civica-api` (Workers) | pre-existing | yes | yes |
| `apps/web` | #440 | **pending operator** | pending |
| iOS (`apple-ios`) | #435 + #438 | yes (set 2026-06-03) | pending first real event |

**Patterns extracted for future surfaces:**

- **iOS**: `CivicaSentry.startIfConfigured()` is the single call site; `Secrets.xcconfig` + `Info.plist` substitution carries the DSN; empty DSN = no-op init; the PII scrubber (`beforeSend`) is the only line of defense between an in-memory crash report and Sentry — covered by 12 unit tests against the real Sentry-Cocoa 8.x `Event` API.
- **Next surfaces** (`apps/web` + `apps/dashboard`): `sentry.client.config.ts` + `sentry.server.config.ts` + `sentry.edge.config.ts` + `instrumentation.ts` with `onRequestError` export + `withSentryConfig` wrap in `next.config.ts`. PII discipline is identical: strip request body / cookies / non-content-type headers; reduce user to id; no replay.
- **Form persistence**: versioned localStorage key (`<surface>.<form>-draft-v<N>`), schema-validated on load, persisted on every change, cleared on submit success. `hydrated` ref guards the persist effect from clobbering. A subtle "we saved what you started" notice that dismisses on first interaction.
- **Error pages**: route-level `error.tsx` with reset button + reference (digest), layout-level `global-error.tsx` with inline styles only (so a `globals.css` failure doesn't recurse), `not-found.tsx` with home + product CTA. Bilingual EN/ES via existing locale machinery.
- **Server-only packaging boundary**: `@civica/snap-rules/server` subpath holds anything that imports `node:*`. Client consumers import the bare barrel. This is the prescription for any future workspace package that has mixed runtime needs.
- **Documentation hygiene CI**: lychee runs on PRs touching `docs/findings/`, weekly on a cron, files a GitHub issue on cron failure so rot in merged files surfaces in the next session.

**Deferred / out of scope:**

- **`Sentry.captureMessage` from `apps/web`** — wired in #440 across all three error pages; events start flowing once the operator sets `NEXT_PUBLIC_SENTRY_DSN` + `SENTRY_DSN` on the `civica-web` Vercel project (Production + Preview).
- **iOS dSYM upload before TestFlight** — required for symbolicated crash reports. Separate PR; tracked.
- **`sentry.client.config.ts` → `instrumentation-client.ts` migration** — Sentry's deprecation warning; affects both Next surfaces when Turbopack becomes the default build. Future migration.
- **Per-host allowlist for lychee** — defer until we know which hosts produce real noise.

## Open questions

- **Does the iOS Sentry init actually fire end-to-end?** Smoke test deferred at operator's choice; first real crash will validate it.
- **Is the dashboard's 1.4K-error count signal or noise?** Not investigated in this session. Worth a Sentry triage pass.
- **Are there more workspace packages with the snap-rules-style mixed-runtime leak?** Audit not run beyond snap-rules. Candidate next-step: a CI step that grep-fails any client component importing a package that has `node:*` reachable from its barrel.
- **Does `apps/web` need autosave on any other field, or is `LeadCaptureForm` the only long-form input?** Today, yes. Future SNAP intake surfaces would need the same pattern.
