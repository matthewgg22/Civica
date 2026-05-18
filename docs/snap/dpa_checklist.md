# Data Processing Addendum (DPA) Inventory

Every third-party vendor that processes Civica user data is a "data processor" under CCPA and GDPR. DPAs must be in place **before** any PII touches the vendor's systems. CA state contracts and most B2G procurements also require a signed DPA per vendor.

This checklist is engineering's snapshot of which vendors are in play, where their DPAs live, and whether each is signed. Matthew (or counsel-on-contract) executes the signing; this doc is the tracker.

Last reviewed: 2026-05-18.

---

## Vendor inventory

| # | Vendor | Service | PII risk | DPA URL | Signed? | Signed by | Date | Re-sign cadence | Notes |
|---|--------|---------|----------|---------|---------|-----------|------|-----------------|-------|
| 1 | **Supabase** | Postgres, Auth, Storage, Edge Functions | 🔴 **High** — primary store for applicant_id, packets, encrypted PII, audit log | https://supabase.com/privacy | ❓ Verify | — | — | Re-sign on plan upgrade or T&C update | Required before any prod user. Stores `*_ciphertext` columns, encrypted with `SNAP_FERNET_KEY`. |
| 2 | **Cloudflare** | Workers (`civica-enrollment-api`), DNS, CDN, R2 (if used) | 🔴 **High** — every applicant request transits Workers; HTTP context includes headers and IP | https://www.cloudflare.com/cloudflare-customer-dpa/ | ❓ Verify | — | — | Re-sign on plan upgrade | Workers tail logs are scrubbed by the PII logger (apps/enrollment-api/src/lib/logger.ts) before emission, but the DPA is still required because Cloudflare sees the requests in transit. |
| 3 | **Fly.io** | Hosting `civica-api`, `civica-snap-api`, `civica-snap-engine` | 🔴 **High** — full HTTP request bodies traverse Fly machines | Check current Fly terms: https://fly.io/legal/ (DPA may be linked under "Data Protection") | ❓ Verify | — | — | Re-sign on T&C update | Confirm whether Fly offers a standalone DPA or whether it's incorporated into the Master Services Agreement. |
| 4 | **OpenAI** | LLM API for SNAP question extraction, document OCR fallback | 🔴 **High** — applicant answers and document content go to OpenAI for processing | https://openai.com/policies/data-processing-addendum | ❓ Verify | — | — | Annual | Zero-retention enterprise tier strongly preferred — confirm Civica is on a tier that does not retain prompts beyond 30 days. Anthropic also used in some paths; see #5. |
| 5 | **Anthropic** | LLM API (if used in any non-Apple-on-device path) | 🟡 **Medium** — prompts may contain household composition, income; less PII surface than OpenAI but still in scope | https://www.anthropic.com/legal/dpa (verify current URL) | ❓ Verify | — | — | Annual | Verify whether Civica's iOS InterviewCoach actually calls Anthropic in production or only Apple on-device FoundationModels. If on-device only, this row is N/A — strike. |
| 6 | **Sentry** | Error tracking (all 4 services + dashboard) | 🟡 **Medium** — error events may contain dict context with PII before scrubbing; `beforeSend` redacts known keys but unknown new fields could leak | https://sentry.io/legal/dpa/ | ❓ Verify | — | — | Annual | Scrubber: apps/api, apps/enrollment-api, apps/dashboard, backend/civic_api all have `beforeSend` filtering against `PII_KEYS`. Coverage is high but not perfect — DPA closes the residual risk. |
| 7 | **Vercel** | Hosting `web/` (Next.js applicant app) | 🟡 **Medium** — request handling for the web applicant flow | https://vercel.com/legal/dpa | ❓ Verify | — | — | Re-sign on plan change | Required before web app goes live. Verify which Vercel project actually serves production (per reference_vercel_civica_app.md, civica-app is misconfigured — confirm the LIVE project). |
| 8 | **Twilio** | SMS for magic-link OTP delivery | 🟡 **Medium** — phone numbers in transit | https://www.twilio.com/legal/data-protection-addendum | ❓ Verify | — | — | Annual | If Supabase Auth handles SMS internally via its own provider, this may be N/A; verify the SMS path. |
| 9 | **GitHub** | Source hosting, CI runners, GH Actions | 🟢 **Low** — code only; no production PII | https://github.com/customer-terms/github-data-protection-agreement | ❓ Verify | — | — | Re-sign on org plan change | Required by some procurement reviews; trivial to sign. |
| 10 | **Apple** | App Store, TestFlight, FoundationModels (on-device) | 🟢 **Low** — App Store privacy labels disclose data collection, but on-device FoundationModels processing keeps PII off Apple servers | Apple's standard DPA is incorporated in the Apple Developer Program License Agreement | ✅ Signed (DPLA) | Matthew | (DPLA acceptance date) | On DPLA update | iOS app store distribution implicitly accepts the DPLA, which includes data protection terms. Confirm acceptance date is on file. |

**Legend:**
- 🔴 High = vendor sees PII in clear or encrypted at rest with operational access
- 🟡 Medium = vendor sees PII in transit or in error context, mostly scrubbed
- 🟢 Low = no production PII

---

## Pre-launch checklist

Before any CA beta user touches production:

- [ ] Confirm DPAs signed for vendors 1-7 (rows above marked ❓).
- [ ] Strike row 5 (Anthropic) if InterviewCoach is iOS-on-device only.
- [ ] Strike row 8 (Twilio) if Supabase Auth SMS uses its own bundled provider not requiring a separate Civica-vendor DPA.
- [ ] File signed DPAs in `<wherever Civica keeps contracts — counsel to specify>`. Update this doc with file references.
- [ ] Update `docs/snap/launch-readiness.md` to mark "DPA trail" as complete.

## Annual re-sign

Most vendors require re-signing on plan upgrades, T&C updates, or after a defined renewal window (typically annual). Set a calendar reminder for Jan 1 each year to scan this list against current vendor terms.

The `fy-rules-refresh-reminder.yml` workflow (PR claude/snap-fy27-refresh-reminder) is annual, but it covers rules-engine refresh — not vendor DPAs. Consider adding a parallel workflow if you want automation for the DPA cycle too.

---

## What's NOT covered by this checklist

- **Subprocessors of the listed vendors.** Each vendor's DPA enumerates their own subprocessors (e.g., Supabase uses AWS; Cloudflare's edge network spans many regions). Civica accepts the subprocessor list by accepting the DPA — no separate signature needed per subprocessor, but the list should be reviewed for compliance with state contract requirements (e.g., data-residency clauses).
- **Internal employee access.** Civica's own staff with prod access (Matthew + future hires) need their own access agreements; that's an employment-side document, not a vendor DPA.
- **Open-source dependencies.** npm/pip packages are not "data processors" — they don't see runtime data.
