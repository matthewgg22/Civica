# RecertCompanion rollout runbook

## Status

- Date: 2026-05-30
- Feature flag: `RecertCompanionFeatureFlag.isEnabled` ([Civica/Features/RecertificationCompanion/RecertCompanionFeatureFlag.swift](../../Civica/Features/RecertificationCompanion/RecertCompanionFeatureFlag.swift))
  - Backed by `UserDefaults` key `co.civica.recertCompanion.enabled`
  - Default-off in production
  - Flipped per-device by QA / pilot ops via direct UserDefaults write or `RecertCompanionFeatureFlag.setEnabled(true)`; no user-facing toggle and no debug menu yet
- Current state: gated (legacy `SNAPRecertificationView` + `SNAPDecisionDeniedView` are the production paths for `.recertDue` and `.decisionDenied`)
- Pilot cohort active: NO — this runbook is the gate

## Pilot cohort

- **Geography:** California users only (Civica's launch state per `project_launch_state_ca` memory; same gate as the rest of the SNAP product surface)
- **Eligibility:** `SNAPApplicationStatusStore.status` is one of
  - `.recertDue` (recert window ≤ 60 days out, per Phantom Recert trigger), OR
  - `.decisionDenied` within the last 60 days (so Procedural Appeal is timely)
- **Cohort assignment mechanism:** TBD — *the current flag is per-device boolean only. A percentage- or user-ID-based rollout primitive does not exist on iOS today (no remote config, no server-driven gate). Either (a) add a remote check that wraps `isEnabled`, or (b) hash the device-stable user ID into buckets on first launch and persist. Resolving this is a prerequisite for the phased rollout below.*
- **Sample size target:** 250 cases (rough power target for ±5pp on a binary completion-rate outcome at 80% power, baseline TBD)
- **Pilot duration:** 90 days
- **Decision date:** 2026-08-29 (per UD-5 of [docs/audits/civica-ios-product-audit-2026-05-29.md](../audits/civica-ios-product-audit-2026-05-29.md))

## What companion changes vs legacy

Both legacy paths remain in-tree and intact for instant rollback (see "What lives outside this module" in [Civica/Features/RecertificationCompanion/README.md](../../Civica/Features/RecertificationCompanion/README.md)).

- **Denial path (`status == .decisionDenied`):**
  - Legacy: `SNAPDecisionDeniedView` (static next-step cards)
  - Companion: `RecertCompanionRoot` dashboard with `AppealEntryView` as primary action — AI-drafted procedural-appeal letter (denial-letter parse via Apple Intelligence on iOS 26+, manual entry fallback, deterministic templated render, PDF export + portal deep-link)
- **Recert path (`status == .recertDue`):**
  - Legacy: `SNAPRecertificationView`
  - Companion: `RecertCompanionRoot` with
    - `PhantomRecertEntryView` (dry-run a recert against a cloned draft, surface diffs + a prep checklist)
    - `ExpirationCalendarView` (document expiration forecast against state rules)
    - `RecertNotificationService` (just-in-time reminders, soft-prompted)
    - `AppealEntryView` (available pre-emptively in case of denial)
- **Entry tile (`CivicaEntryView`):** flag-gated companion tile appears as an additional entry point

## Success metrics

| # | Metric | Target | Source |
|---|---|---|---|
| 1 | Recert completion rate | ≥ 85% | Backend (BenefitsCal / state portal completion confirmation); iOS-side proxy = `phantom_recert_completed` ÷ `phantom_recert_started` |
| 2 | Appeal initiation rate (denial cohort) | No worse than -10pp vs legacy baseline | `appeal_initiated` events ÷ count of `.decisionDenied` cohort entries (baseline TBD — legacy denial view has no equivalent event today; *prerequisite: instrument legacy view with a parallel "denial_view_opened" event before pilot starts, or accept that the first 30 days of the pilot establish the baseline*) |
| 3 | Phantom-recert engagement | ≥ 40% of recert-due users fire `phantom_recert_started` before recert deadline | `phantom_recert_started` ÷ count of cohort entries with `status == .recertDue` |
| 4 | Companion crash-free rate | ≥ 99.5% | Firebase Crashlytics, filtered to traces touching `Civica/Features/RecertificationCompanion/*` (per-module crash bucket TBD — *resolving this needs either a custom Crashlytics key set on RecertCompanionRoot mount or a release-tagged build that only enables the companion for the cohort*) |

**Analytics caveat:** `RecertCompanionAnalytics` enforces a 4-key allowlist (`step_name`, `step_index`, `document_type`, `state_code`) — no `cohort_id`, no `treatment_arm`, no recert dates. Cohort attribution at analysis time must use `state_code == "CA"` + the build/version identifying the pilot release as proxy. Do not extend the allowlist for pilot tracking; that crosses the privacy boundary documented in [Civica/Features/RecertificationCompanion/RecertCompanionAnalytics.swift](../../Civica/Features/RecertificationCompanion/RecertCompanionAnalytics.swift).

## Abort criteria

Trip any one — flip the flag back off immediately:

- Completion rate (metric #1) drops below 70%
- Appeal initiation rate (metric #2) drops more than 20pp vs the legacy baseline
- Companion crash rate exceeds 0.5% (i.e., crash-free rate < 99.5%)
- Negative qualitative signal from any CBO partner (Project Bread for MA expansion, AltCap, or similar) — single-source veto, no quorum required
- Legal flags an appeal template as out-of-compliance — pause appeal-path entry only (`AppealEntryView`), not the whole companion, while a fixed template ships

Abort = revert all pilot devices via the rollback procedure below + write a one-page postmortem at `docs/findings/<date>-recert-companion-pilot-abort.md` citing which criterion tripped and the underlying evidence.

## Phased rollout (after pilot succeeds)

**Blocked on:** the cohort-assignment primitive called out above. Until that ships, "25%" cannot be expressed; the phased steps assume that work is done.

- **Week 1:** 25% of CA users with `.recertDue` or recent `.decisionDenied`. Re-measure at day 7. Abort if any criterion fails; hold at 25% if any metric is within 5pp of an abort line.
- **Week 2:** 50% (assuming week 1 clean). Re-measure at day 7.
- **Week 3–4:** 100% of CA cohort.
- **Week 5+:** expand to additional launch states as they come online (see `SNAPAgencyDirectory.supportedStateCodes`). Each new state requires its own pre-launch checklist run from [Civica/Features/RecertificationCompanion/README.md](../../Civica/Features/RecertificationCompanion/README.md#pre-launch-review-checklist) (state appeal templates, document-expiration rules, native-language review, OCR accuracy testing on ≥20 letters).

## Rollback plan

1. Set `RecertCompanionFeatureFlag.isEnabled = false` on pilot devices.
   - With per-device flags only (today): coordinated push to QA/ops contacts to write `false` to the UserDefaults key, or ship a hotfix build that hardcodes `false`.
   - With a remote primitive (when it ships): flip the remote gate; effect is near-immediate on next app foreground.
2. Both legacy paths (`SNAPRecertificationView`, `SNAPDecisionDeniedView`) remain in-tree and continue to handle `.recertDue` / `.decisionDenied` once the flag is off (verified by audit doc's "What lives outside this module" preservation note).
3. In-flight phantom drafts (`co.civica.applicationDraft.phantom`) and in-flight appeal drafts are NOT auto-cleaned on rollback. Document for support: "If a user reports a stuck phantom draft after rollback, clear with `UserDefaults.standard.removeObject(forKey: ...)` — exact keys per `SNAPApplicationDraftStore` keyed init."
4. File a finding at `docs/findings/<date>-recert-companion-rollback.md` with abort criterion + evidence + next-attempt prerequisites.

## References

- Audit: [docs/audits/civica-ios-product-audit-2026-05-29.md](../audits/civica-ios-product-audit-2026-05-29.md) (Pass 7 — UD-5; related: JR-8)
- Module code: [Civica/Features/RecertificationCompanion/](../../Civica/Features/RecertificationCompanion/)
- Module README (extension points, privacy boundary, pre-launch checklist): [Civica/Features/RecertificationCompanion/README.md](../../Civica/Features/RecertificationCompanion/README.md)
- Flag: [Civica/Features/RecertificationCompanion/RecertCompanionFeatureFlag.swift](../../Civica/Features/RecertificationCompanion/RecertCompanionFeatureFlag.swift)
- Analytics + privacy boundary: [Civica/Features/RecertificationCompanion/RecertCompanionAnalytics.swift](../../Civica/Features/RecertificationCompanion/RecertCompanionAnalytics.swift)
- Status enum: [Civica/Features/SNAP/Application/SNAPApplicationStatus.swift](../../Civica/Features/SNAP/Application/SNAPApplicationStatus.swift) (`.recertDue`, `.decisionDenied`)
