---
id: 2026-05-29-data-firewall-principle
date: 2026-05-29
scope: [compliance, offers, data-governance, privacy]
confidence: high
status: active
supersedes: []
superseded_by: []
evidence:
  - kind: external
    ref: "https://www.ecfr.gov/current/title-7/chapter-II/subchapter-C/part-272/section-272.1#p-272.1(c)"
    note: "7 CFR §272.1(c) — restrictions on use/disclosure of SNAP applicant and recipient information."
  - kind: external
    ref: "https://oag.ca.gov/privacy/ccpa"
    note: "CCPA/CPRA purpose-limitation + sensitive-personal-information rules; benefit-status proxies trigger opt-out + disclosure obligations."
  - kind: external
    ref: "https://www.ecfr.gov/current/title-7/chapter-II/subchapter-C/part-277/section-277.4#p-277.4(b)(5)(i)"
    note: "7 CFR §277.4(b)(5)(i) — recruitment-and-persuasion prohibition (master rule R-5) the firewall is the privacy-side dual of."
  - kind: external
    ref: "https://www.congress.gov/crs-product/R48552"
    note: "OBBBA §10105 — state benefit cost share keyed to payment-error rate (master rule R-2). The macro driver that makes Type-1-error reduction a B2G value: a documented §272.1(c) cross-use would torpedo precisely the sale this rule creates."
  - kind: file
    ref: "Desktop/Civica USDA data/deliverables/civica_snap_obbba_compliance_master.docx"
    note: "Master compliance registry — R-1 through R-15. R-2 (OBBBA §10105 cost share), R-5 (§277.4(b)(5)(i) recruitment ban), R-13 (16 CFR Part 461 government impersonation), R-14 (FTC §5), R-15 (USDA/FNS scam-alert environment) co-fire on the offer platform."
  - kind: file
    ref: apps/enrollment-api/src/routes/me-offers.ts
    line: 75
    note: "Resolver reads `packet_county` query param — packet metadata (county FIPS pulled from the enrollment packet) is a present input to offer selection. Soft cross-use of enrollment data."
  - kind: file
    ref: apps/enrollment-api/src/routes/me-offers.ts
    line: 96
    note: "Logs a `county_mismatch` boolean comparing packet-county to device-current-county — confirms both flows are wired through the resolver today."
  - kind: file
    ref: supabase/migrations/20260587_partner_offers_tier_state_category.sql
    line: 32
    note: "partner_offers table — no `targeting_uses_enrollment_data` flag, no `consent_basis` column; firewall is a code-path obligation, not a schema constraint."
  - kind: pr
    ref: "https://github.com/matthewg22/Civica/pull/272"
    note: "Offer platform merged 2026-05-27; first surface where a data-firewall violation could materialize in code."
  - kind: file
    ref: "Desktop/Civica USDA data/analysis/civica_app_features_compliance.md"
    line: 134
    note: "Source-of-record analysis: 'data collected to help a person get or keep benefits must not be repurposed to advertise to them.' Cross-cutting principle across both scenarios."
  - kind: memory
    ref: project_offer_platform_pr272
    note: "Offer platform live as of 2026-05-27; gate (≥1 signed partner OR ≥8 Civica-seeded community offers) is the rollout trigger."
  - kind: memory
    ref: project_ebt_offers_wiring
    note: "EBTOffersStore/Repository/APIClient stack + EBTRedeemConfirmSheet shipped 2026-05-27; offers render on the EBT dashboard post-enrollment."
---

## What we found

**Civica has one cross-cutting privacy rule, and the offer platform is the first surface where it can be broken in code.**

The rule: **personal data collected to help a person get or keep SNAP benefits — application income/household data, recertification data, EBT card data, BenefitsCal credentials, or any derivative (packet status, enrollment flag, benefit-level estimate) — must not be repurposed to drive offer targeting, ranking, or eligibility.** Offer surfaces run on a **separate, opt-in, location-based** dataset with its own consent, or they do not run.

This is the privacy-side dual of the recruitment-and-persuasion ban in 7 CFR §277.4(b)(5)(i) (master rule R-5): the counsel memo at [docs/compliance/memo-offer-platform-2026-05.md](../compliance/memo-offer-platform-2026-05.md) treats the *advertising* side; this finding treats the *data* side. Together they form one obligation.

Concretely, the firewall has three layers:

1. **Data source.** Offer targeting reads only (a) device-CL location the user explicitly opted in to, and (b) explicit "show me deals near me" preference state. It does **not** read packet metadata, enrollment status, recertification status, EBT balance, EBT transactions, BenefitsCal session state, or any join keyed off them.
2. **Consent surface.** The user grants offer-side consent in a UI distinct from the enrollment consent, with a separate revocation path. CCPA/CPRA "do not share for cross-context behavioral advertising" must work end-to-end and must not break enrollment.
3. **Schema enforcement.** The firewall is encoded — not assumed. Offer-side records carry a `consent_basis` field and resolver code rejects any join that would draw on benefits-side tables. Today neither exists ([supabase/migrations/20260587_partner_offers_tier_state_category.sql:32](supabase/migrations/20260587_partner_offers_tier_state_category.sql:32)); making the firewall a schema-level invariant is the durable fix.

## Why it matters

- **Live exposure.** PR #272 (offer platform) merged 2026-05-27 and [apps/enrollment-api/src/routes/me-offers.ts:75](apps/enrollment-api/src/routes/me-offers.ts:75) currently accepts a `packet_county` parameter — county FIPS derived from the enrollment packet — and feeds it into `resolveOffers`. That is the cleanest case of the soft cross-use the firewall is meant to block. The packet-county flow is justifiable by the "the user is in county X so show offers in county X" framing, but the *source* of that signal is the enrollment dataset, not device location or a separate opt-in. The legal exposure scales with how visibly enrollment data drives the offer surface.
- **Legal stack.** Two distinct rules co-fire whenever the firewall is breached:
  - 7 CFR §272.1(c) restricts use and disclosure of applicant/recipient information; using it to drive an advertising product is a textbook misuse, even if the surface looks like a money-saving feature.
  - CCPA/CPRA treats benefit status (and proxies for benefit status, including packet metadata) as a strong income proxy → sensitive personal information → opt-out + disclosure obligations the moment retailers pay.
- **Trust posture.** The combined product (enrollment + EBT + recert + offers) is, feature-for-feature, the silhouette USDA's scam-alert program warns about. The firewall is what keeps Civica visibly *not* that silhouette.
- **B2G blast radius.** A documented cross-use of §272.1(c) data, in code, would torpedo the caseworker-mode and B2G-contract paths ([[2026-05-28-argyle-evidentiary-standard]], [[2026-05-28-usda-advanced-automation-scope]]) far harder than a UX miss in the offer surface itself. The firewall protects the higher-value sale — which, under OBBBA §10105 (master rule R-2), is the sale where Type-1-error reduction and intake-QC become directly cost-share-relevant to the state. The cost-share-by-PER mechanic is what makes the higher-value sale a real number; the firewall is what keeps Civica eligible to make it.

## What changes

**Immediately (engineering):**
1. **Stop sourcing `packet_county` from the enrollment packet for offer resolution.** Migrate the offer resolver to take county only from device CL location ([CivicaLocationManager.swift:26](Civica/Features/.../CivicaLocationManager.swift)) or from an explicit user-set "city/zip for deals" preference. Remove `packet_county` from [apps/enrollment-api/src/routes/me-offers.ts:75](apps/enrollment-api/src/routes/me-offers.ts:75) once a replacement is wired.
2. **Add a `consent_basis` column** to `snap_enrollment.partner_offers` resolver inputs (not the catalog) and an offer-side consent record table; any resolver call without an offer-side consent rejects.
3. **Forbid joins from `partner_offers*` to any `snap_enrollment.packet*`, `applicants*`, or `ebt_*` table** at the resolver layer. Encode as a Postgres `REVOKE` on a dedicated `offers_resolver` role, not just code convention.

**Standing (every offer surface, forever):**
- New offer features get a §272.1(c)/CCPA pre-flight checklist in PR review. Any reviewer can block on "this targets off enrollment data."
- Retailer revenue model stays flat (per-listing, per-impression, per-click). **No revenue share on SNAP dollars spent**, ever.
- Distress-state suppression ([apps/enrollment-api/src/routes/.../distress.ts:23](apps/enrollment-api/src/routes/me-offers.ts)) stays as it is — that flow uses benefits-side state to *withhold*, not to *target*, and is privacy-protective on its face.

**Documentation:**
- This finding is the rule; [docs/compliance/memo-offer-platform-2026-05.md](../compliance/memo-offer-platform-2026-05.md) is the rule applied to the current offer-platform surface; [docs/plans/ebt-tracker-propel-parity.md:190](../plans/ebt-tracker-propel-parity.md) ("No display ads") gets a back-reference here so the principle is reachable from the EBT plan.

## Open questions

- **Is the device-location signal sufficient on its own to power useful offers?** If yes, the migration is clean. If user-set city/zip is needed as a fallback, that opt-in surface needs design and is not free.
- **Does the distress-suppression path count as "use" of §272.1(c) data even though it withholds rather than targets?** Counsel-flagged in [docs/compliance/memo-offer-platform-2026-05.md](../compliance/memo-offer-platform-2026-05.md) §3 Q1. Working assumption: protective use is permitted; this assumption needs to be confirmed before relying on it.
- **What is the legal status of `tier='top'` (paid placement) absent an "Ad" / "Sponsored" UI label?** Schema-side question handled in [docs/compliance/memo-offer-platform-2026-05.md](../compliance/memo-offer-platform-2026-05.md) §3 Q2; data-side reflection here is that the firewall and the FTC labeling rule co-fire — neither alone is sufficient.
- **Caseworker mode** ([[memory:project_caseworker_mode_design]]) introduces a county staff actor who can see applicant data. The firewall holds for *Civica's own product* surfaces; the staff-side data-handling rules are a separate question covered by the caseworker-mode design memo.
