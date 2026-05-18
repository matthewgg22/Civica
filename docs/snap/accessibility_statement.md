# Civica SNAP — Accessibility Conformance Statement

**Civica is committed to WCAG 2.1 Level AA conformance** across its iOS app and web applicant flow. This statement documents that commitment, the current state of conformance testing, known gaps, and how to report accessibility issues.

Effective: 2026-05-18. Reviewed: at every major release.

---

## Scope

This statement covers:

- **iOS app** — Civica SNAP (App Store distribution; iOS 26+).
- **Web applicant flow** — Next.js app at `civica.app` (sign-in, onboarding, questions, documents, inbox, packet, resources, consent, privacy).
- **Navigator dashboard** — `dashboard.civica.app` (Vercel-hosted Next.js).

It does NOT cover:

- Third-party services Civica links to (BenefitsCal, DTA Connect, USDA SNAP State Directory) — those operate under their own accessibility programs.
- The Civica marketing site, when one exists.

---

## Standards

Civica targets **WCAG 2.1 Level AA**, which is also the floor required by:

- Section 508 of the U.S. Rehabilitation Act (federal procurement reference)
- California Government Code §11135 (state contractor reference)
- ADA Title II/III as interpreted by recent DOJ guidance

We do not currently claim AAA conformance for any surface.

---

## Conformance status

**Partially conformant** — the iOS app and web applicant flow meet most WCAG 2.1 AA requirements. Known exceptions are listed below. We continue to remediate as issues are identified.

### Automated testing coverage

| Surface | Tool | Frequency | Pass criteria |
|---|------|-----------|---------------|
| Web (sign-in, all 6 authenticated pages) | `@axe-core/playwright` in `e2e/a11y-authenticated.spec.ts` | Every PR touching `web/**` | Zero `serious` or `critical` violations |
| Web (mobile perf + a11y) | Lighthouse CI | Every PR touching `web/**` | Accessibility score ≥ 0.9 (mobile) |
| iOS | XCUI accessibility audit (planned) | Every PR | TBD — currently manual verification per release |
| Dashboard | Lighthouse CI (planned) | Every PR touching `apps/dashboard/**` | Accessibility score ≥ 0.9 (desktop) |

### Manual testing coverage

We test major flows with:
- VoiceOver (iOS) on every release.
- macOS VoiceOver on the web flow during sprint reviews.
- Keyboard-only navigation on the web flow.
- Dynamic Type / iOS text-size scaling up to AX5 on the iOS app.
- Reduced Motion preference honored in both apps.

---

## Known issues (as of 2026-05-18)

These are exceptions the team is aware of and working on. We list them publicly so users with assistive technology can plan around them.

1. **iOS — Voice intake flow (InterviewCoach):** Speech-to-text microphone capture is the primary input. Users unable to use voice can fall back to the typed question flow, which is fully accessible. Switching is one tap away on every voice screen.
2. **iOS — Document camera capture:** Camera viewfinder lacks a screen-reader-described "frame the document" hint. Falls back to file-picker, which is fully accessible.
3. **Web — Distress confirmation modal:** Modal focus management has an edge case on first paint when a screen reader is active; focus may land on the body briefly before moving to the modal. Functional, slightly disorienting.

Any issue not on this list either (a) we don't know about — please tell us, or (b) we believe is conformant and welcome counter-reports.

---

## How to report an accessibility issue

Email **accessibility@civica.app** with:

1. The surface (iOS app screen / web URL / dashboard URL)
2. The assistive technology you're using (VoiceOver, NVDA, JAWS, switch control, etc.)
3. What you tried to do
4. What happened (or what was missing)
5. A screenshot if possible

We respond within **5 business days** with an acknowledgment and a remediation plan. Critical issues (cannot use a core flow at all) are prioritized within the current sprint.

---

## Methodology

The conformance status above is based on:

- Engineering self-evaluation against the WCAG 2.1 AA success criteria.
- Automated test results from `axe-core` and Lighthouse, both run in CI.
- Manual verification on real assistive technology by the engineering team.

**This statement is not a third-party VPAT.** A formal VPAT 2.4 audit by an external accessibility consultancy is planned before any government contract execution requires one. Until that audit, this statement is engineering's best-faith disclosure of the app's conformance posture.

---

## How to publish

When the web app's privacy page goes live, this document should be linked from the footer alongside the privacy link. Add a route at `/[locale]/accessibility` rendering this content, parallel to `/[locale]/privacy`.

iOS-side, link from the in-app settings screen (when one exists) to a webview pointing at the public-facing version.
