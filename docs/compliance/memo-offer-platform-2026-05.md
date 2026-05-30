# Counsel Memo: Offer Platform Compliance Under 7 CFR §272.1(c), §277.4(b)(5), CCPA/CPRA, and FTC §5

**To:** Civica outside counsel (compliance / regulatory / privacy)
**From:** Matthew Greer, Civica
**Date:** 2026-05-29
**Re:** Civica's newly-shipped retailer offer platform — applying SNAP, FTC, and California privacy law to the live design surfaces, and asking a focused set of questions whose answers will lock the v1 build before public rollout

---

## Purpose

Civica merged its first retailer-offer platform on **2026-05-27** (PR #272, `partner_offers` schema + `/me/offers` resolver) and wired offer cards into the iOS EBT dashboard the same day. The platform is not yet customer-facing — the rollout gate requires either one signed retailer or eight Civica-seeded community offers — but the schema, the resolver, the consent surfaces, and the user-facing UI exist in code today and are the subject of this memo.

This memo applies the cross-cutting analysis in Civica's internal compliance file (`civica_app_features_compliance.md`, Scenario 1b and the cross-cutting data-firewall principle) to the actual codebase as it stands, identifies the design choices that need to be locked before the rollout gate opens, and asks counsel a small set of specific questions whose answers will close v1.

The load-bearing privacy rule — that personal data collected for SNAP enrollment or recertification may not be repurposed to advertise to the user — is captured separately in [docs/findings/2026-05-29-data-firewall-principle.md](../findings/2026-05-29-data-firewall-principle.md). This memo treats the *advertising-side* rules; the finding treats the *data-side* rules. Together they form one obligation.

---

## Section 1 — Regulatory framing

### 1.1 7 CFR §277.4(b)(5)(ii) — recruitment-and-persuasion carve-outs

Section 277.4 governs federal financial participation in State agency administrative expenses for SNAP outreach. Paragraph (b)(5) lists categories of activity that are **not** permitted to be funded as outreach because they are deemed to "recruit" or "persuade" persons to apply for SNAP. Subparagraph (b)(5)(ii) carves out from this prohibition the **dissemination of factual information about retail locations that accept SNAP benefits** — i.e., the federal rule itself names retailer-identification as outside the recruitment/persuasion zone. Two operative consequences for Civica:

- A **factual map of SNAP-accepting retailers** ("Scenario 1a" in Civica's internal analysis) is the cleanest possible feature under the SNAP advertising framework. The only obligation is **accuracy** — every store shown as EBT-accepting must in fact be EBT-accepting at the time of display.
- A **post-enrollment discount feed** ("Scenario 1b") sits outside §277.4(b)(5) entirely because the user is already enrolled; the recruitment/persuasion concern attaches to *applicants*, not *recipients*. The feed is therefore not a federal-SNAP outreach question; it is an FTC advertising and CCPA privacy question.

Counsel should confirm both readings, particularly the boundary between (a) the §277.4(b)(5)(ii) retailer-identification carve-out and (b) the line where surfacing a retailer-paid discount becomes "advertising" outside that carve-out.

### 1.2 7 CFR §272.1(c) — use and disclosure of applicant/recipient information

Section 272.1(c) restricts State agency use and disclosure of information about SNAP applicants and recipients to purposes directly connected with SNAP administration (plus a narrow set of enumerated exceptions). Civica is not a State agency, but two facts pull §272.1(c) into the analysis:

- Civica handles applicant and recipient information that flows back and forth with State systems (BenefitsCal, county SNAP offices). Counsel should confirm whether the obligations of §272.1(c) attach to Civica directly, by contract through its CBO-of-record posture (the VoteNow Advocacy Foundation registration), or only indirectly.
- Independent of §272.1(c)'s direct reach, the analytical principle it embodies — that SNAP enrollment information is collected for benefit-administration purposes and is not free-floating personal data — informs CCPA/CPRA purpose-limitation analysis below.

The operative question for the offer platform: **can data collected during the enrollment or recertification flow be used to target, rank, or restrict retailer offers?** Civica's working answer is *no* — see Section 4 below — and we want counsel to confirm the conclusion and the reasoning.

### 1.3 CCPA / CPRA — purpose limitation, sensitive PI, and cross-context behavioral advertising

The California Consumer Privacy Act, as amended by CPRA, treats (a) purpose limitation as a substantive obligation: personal information may not be used for purposes incompatible with the disclosed purpose of collection without additional notice/consent, and (b) "sensitive personal information" (SPI) as a higher-protection category with separate opt-out / "limit use" rights. Two implications:

- SNAP enrollment status is a strong proxy for low income. Counsel should opine on whether, in California, this proxy itself triggers SPI treatment, or whether SPI treatment attaches only when the data is used in a way that reveals or acts on the proxy.
- Using offer-side data for "cross-context behavioral advertising" triggers a "do not share" opt-out under CPRA. Civica's working design (Section 4) is that retailer revenue is flat (per-listing / per-impression / per-click) and there is no cross-context profile built; counsel should confirm that this model stays outside the "share" definition.

### 1.4 FTC Act §5 (15 U.S.C. §45) and the .com Disclosures / Endorsement Guides

Section 5 prohibits unfair or deceptive acts or practices. The FTC's modern interpretation, expressed in the *.com Disclosures* guidance and the Endorsement Guides, requires (a) **clear and conspicuous disclosure** that paid placements are paid, and (b) **format-neutrality** — a paid placement that looks like a neutral recommendation is deceptive regardless of fine-print labeling. For Civica's offer platform, the rule structure cashes out as three concrete obligations:

- If any offer placement is **retailer-paid** (a tier-one placement, a sponsored slot, anything where retailer payment influences the surface), the placement must carry a clear and conspicuous "Ad" or "Sponsored" label visible in the same viewport.
- If the placement is **Civica-seeded** (factual aggregation of public discounts, no retailer payment), no advertising label is required — but the line between "aggregated public deal" and "retailer-paid placement" must be schema-enforced, not editorial.
- Every claim about a discount (percentage off, validity period, store location, "accepts EBT") must be **substantiated and current**. Stale discounts are deceptive even if they were accurate when posted.

### 1.5 16 CFR Part 461 — government impersonation

Cited for completeness. 16 CFR Part 461, finalized by the FTC in 2024, makes it an unfair or deceptive practice to misrepresent affiliation with a government agency. Civica's enrollment surface already carries non-governmental framing; the offer surface must do the same. A "deals near you that accept your EBT" banner that visually echoes a CalFresh or USDA mark would trigger Part 461 even if the underlying offer is factual.

---

## Section 2 — Civica's offer platform as it stands today

### 2.1 Schema

The catalog is defined across two migrations:

- [supabase/migrations/20260579_partner_offers_catalog.sql](../../supabase/migrations/20260579_partner_offers_catalog.sql) — base `snap_enrollment.partner_offers` table. Fields include `category` (TEXT), `county_fips_list` (CHAR(5)[]), `expected_revenue_cents`, `expected_savings_cents`, and the standard active/effective-date columns.
- [supabase/migrations/20260587_partner_offers_tier_state_category.sql](../../supabase/migrations/20260587_partner_offers_tier_state_category.sql) — extension adding `tier` (enum: `top` / `standard` / `none`), `state_code` (CHAR(2), CHECK CA/MA), `category_tags` (`ebt_transaction_category[]`), `merchant_id`, and `merchant_name_normalized`.

The `tier` enum is the **paid-placement axis**. `top` is documented in the migration as "real-time push eligible" — i.e., the placement model where retailer payment is most likely to determine surfacing. Critically, **no `ad_label`, `sponsored`, `paid_placement`, or similar disclosure field exists in the schema today** ([supabase/migrations/20260587_partner_offers_tier_state_category.sql:32](../../supabase/migrations/20260587_partner_offers_tier_state_category.sql)). The tier system is, at the schema level, indistinguishable to the resolver from an editorial-priority field.

`category_tags` references the `ebt_transaction_category` enum defined at [supabase/migrations/20260574_ebt_phase1.sql:53](../../supabase/migrations/20260574_ebt_phase1.sql), whose values are `groceries`, `farmers_market`, `restaurant`, `atm_withdrawal`, `refund`, `adjustment`, `other`. **There is no granularity below "groceries" today** — the schema cannot, as it stands, distinguish between SNAP-eligible food items and SNAP-ineligible items that a "grocery" retailer also sells (alcohol, tobacco, hot prepared foods, household supplies). This is a v1 concern, not because the resolver is currently surfacing alcohol discounts, but because the schema makes it *possible* to do so without any structural check.

### 2.2 Resolver behavior

`resolveOffers` ([apps/enrollment-api/src/routes/me-offers.ts:83](../../apps/enrollment-api/src/routes/me-offers.ts)) keys on three signals:

1. **Distress suppression.** If the user has an active `distress_flags` row, the resolver returns `free_resources` instead of offers. This is privacy-protective — benefits-side state is used to *withhold* commercial content, not to target it — but counsel should confirm that "withholding" use of §272.1(c) data, when characterized as protective, falls within an acceptable framing.
2. **County matching.** The resolver accepts two county-FIPS inputs: `packetCountyFips` (parsed from a `packet_county` query parameter at [apps/enrollment-api/src/routes/me-offers.ts:75](../../apps/enrollment-api/src/routes/me-offers.ts) — sourced from the enrollment packet) and `currentCountyFips` (sourced from device CL location via [Civica/Features/.../CivicaLocationManager.swift:26](../../Civica/Features/SNAP/EBTBalance/CivicaLocationManager.swift)). The two are OR-matched against `county_fips_list`, with a `STATEWIDE` sentinel as fallback. The resolver also logs a `county_mismatch` flag when the two diverge ([apps/enrollment-api/src/routes/me-offers.ts:96](../../apps/enrollment-api/src/routes/me-offers.ts)). **The packet-county path is the most directly cross-cutting fact in the current build:** offer surfacing is, in part, driven by data drawn from the enrollment packet.
3. **Transaction-category overlap.** Recent (60-day) EBT-transaction categories from the user's transaction history are matched against the offer's `category_tags` for ranking. This is benefits-side data (EBT transaction history) influencing offer targeting. Counsel should opine on whether transaction-category overlap is a permitted use under §272.1(c) and CCPA, given that EBT transactions are arguably more sensitive than packet metadata.

### 2.3 User-facing surface (iOS)

Offers render as `perksOfferRow()` inside `perksSection` on the post-enrollment EBT Balance dashboard ([Civica/Features/SNAP/EBTBalance/Views/EBTBalanceDashboardView.swift](../../Civica/Features/SNAP/EBTBalance/Views/EBTBalanceDashboardView.swift), search `perksSection` / `perksOfferRow`). Card layout: tag icon, offer name, description, partner name. **No "Ad" or "Sponsored" badge is rendered, including for `tier='top'` placements.** The card style is visually indistinguishable from the free-resources card style that the distress-suppression path serves in the same slot.

### 2.4 Consent posture today

There is one enrollment-time consent surface. There is no separate offer-side opt-in. Device location is gated by the standard iOS `requestWhenInUseAuthorization` flow ([Civica/Features/.../CivicaLocationManager.swift:47](../../Civica/Features/SNAP/EBTBalance/CivicaLocationManager.swift)), but the offer surface is not currently structured around a discrete "show me deals near me" consent — offers are served by default to enrolled users whose packet has a county FIPS.

---

## Section 3 — The four design questions for counsel

Each question carries Civica's working answer; we are asking counsel to confirm or correct.

### Question 1 — Is the packet-county path a §272.1(c) and/or CCPA problem?

**Civica's working answer:** Yes, soft-form. The county FIPS is technically not the most sensitive packet field, but its *source* is the enrollment dataset, and any use of enrollment-sourced data to drive a commercial recommendation surface is the cross-use pattern the data-firewall finding is meant to prevent. We propose to migrate offer-county sourcing to (a) device CL location and (b) an explicit user-set "city/zip for deals" preference, retiring the `packet_county` query parameter.

**Confirm or correct:** (a) whether the packet-county flow as currently coded is a present violation, a present near-miss, or compliant; (b) whether the proposed migration is sufficient or whether additional structural separation (e.g., a separate offer-side consent record) is required.

### Question 2 — What disclosure does `tier='top'` require?

**Civica's working answer:** Any `tier='top'` placement carries an FTC labeling obligation regardless of how the payment is structured, because the tier itself is documented as the paid-placement / real-time-push axis. The fix is a schema column (`ad_label` or `placement_basis`) plus a UI badge rendered in the same viewport as the offer card; "in the same viewport" not "in fine print on a settings screen."

**Confirm or correct:** (a) whether the working answer is correct in the abstract; (b) whether the answer changes for the v1 case where the only `tier='top'` slots are filled by Civica-seeded community offers with no retailer payment (i.e., does the `tier='top'` tag itself trigger labeling, or only retailer payment?); (c) whether the labeling rule reaches `tier='standard'` if the standard-tier slot is also subject to retailer influence (e.g., a retailer pays for catalog inclusion but not for top placement).

### Question 3 — What is Civica's obligation around SNAP-ineligible items?

**Civica's working answer:** Civica should not surface discounts on SNAP-ineligible items (alcohol, tobacco, hot prepared foods, household paper goods, etc.) inside a surface that is positioned to EBT recipients as money-saving for their EBT spend. The current schema cannot enforce this because `ebt_transaction_category` stops at `groceries` / `restaurant`. The fix is either (a) a denylist of merchant categories at the offer-catalog level, (b) a per-offer eligibility tag, or (c) restricting offers to merchant types where SNAP-ineligible items are not the dominant product (farmers markets, EBT-only farmer's market apps, etc.).

**Confirm or correct:** (a) whether the working answer is required by §5 / state UDAP law, by USDA SNAP rules, or by both; (b) whether "EBT recipient surface" is the right scoping (does the same rule reach a Civica surface that is shown to enrolled users but doesn't position itself as EBT-specific?); (c) what the appropriate evidentiary standard is for declaring an offer "SNAP-eligible" — retailer attestation, merchant-category code, item-level data, or some combination.

### Question 4 — Retailer revenue model

**Civica's working answer:** Retailer revenue stays flat — per-listing fees, per-impression, or per-click only. **No revenue share on SNAP dollars spent, ever** — the appearance of Civica profiting from the size of a recipient's SNAP benefit is a trust violation independent of legality. No retailer pays for targeting against specific user profiles. The retailer relationship is, at most, "you pay to be in the catalog; ranking is determined by Civica."

**Confirm or correct:** (a) whether this revenue model keeps Civica outside the CCPA/CPRA "share for cross-context behavioral advertising" definition (and therefore outside the "do not share" opt-out requirement); (b) whether per-impression and per-click pricing differ materially in the analysis; (c) whether any structure short of a flat per-listing fee creates risk we have not surfaced.

---

## Section 4 — Recommended v1 design (pending counsel)

Subject to counsel's answers to Section 3, Civica's working v1 design is:

1. **Migrate offer-county sourcing.** Remove `packet_county` from the `/me/offers` resolver inputs. Offer-county comes from device CL location only, with an optional user-set "city/zip for deals" preference for users who decline location. Implementation lands in a follow-up PR before the rollout gate opens.
2. **Add a placement-basis schema column** (`partner_offers.placement_basis ∈ {civica_seeded, retailer_paid_inclusion, retailer_paid_placement}`) and render an "Ad" / "Sponsored" badge for any value other than `civica_seeded`. Badge lives in the offer-card component, not in a settings disclosure.
3. **Add a `snap_eligibility` schema column** (`partner_offers.snap_eligibility ∈ {snap_eligible_only, mixed_attested, unattested}`) and restrict the v1 catalog to `snap_eligible_only` until the substantiation standard is set with counsel.
4. **Encode the data firewall structurally.** A separate Postgres role (`offers_resolver`) is granted access only to `partner_offers*` and offer-side consent tables; the role is *revoked* from `applicants*`, `packets*`, and `ebt_*`. Resolver attempts to join across the line fail at the database, not at code review.
5. **Lock retailer revenue at flat / per-listing for v1.** Per-impression and per-click pricing are deferred pending counsel's answer to Question 4.
6. **Keep distress-suppression as-is.** The path uses benefits-side state to withhold commercial content; we believe this is protective and permitted, but we are not relying on it without counsel's confirmation (Question 1).

The five engineering items (1–5) ship before the rollout gate opens; counsel's answers determine whether item 6 needs additional structure.

---

## Section 5 — Out of scope

- **The map of SNAP-accepting retailers** ("Scenario 1a") is a separate feature on the Track 1 demo plan. Its only material compliance obligation is accuracy (§277.4(b)(5)(ii) carve-out is on its face permissive). Will be covered in a separate memo if/when the map ships as a customer-facing product.
- **EBT credential and balance handling** is covered by [docs/snap/ebt-credential-posture-2026-05.md](../snap/ebt-credential-posture-2026-05.md). The two memos co-fire on Civica's overall data posture but each is self-contained.
- **Payroll-verification compliance** (Argyle, Canvas, Work Number) is covered by [docs/compliance/memo-payroll-verification-2026-05-27.md](memo-payroll-verification-2026-05-27.md).
- **Caseworker-mode data handling** is covered by the caseworker-mode design memo (see auto-memory `project_caseworker_mode_design`).

---

## Section 6 — Companion documents and source-of-record

- Internal compliance analysis (source): `~/Desktop/Civica USDA data/analysis/civica_app_features_compliance.md` (Scenario 1, Scenario 2, and the cross-cutting data-firewall principle).
- Master compliance source (counsel-prior): `deliverables/civica_snap_obbba_compliance_master.docx` (rules R-1 through R-15).
- Cross-cutting privacy rule (engineering-facing): [docs/findings/2026-05-29-data-firewall-principle.md](../findings/2026-05-29-data-firewall-principle.md).
- Pull request introducing the surface analyzed here: [Civica#272](https://github.com/matthewg22/Civica/pull/272), merged 2026-05-27.
- Code surfaces cited:
  - [apps/enrollment-api/src/routes/me-offers.ts:75](../../apps/enrollment-api/src/routes/me-offers.ts)
  - [supabase/migrations/20260579_partner_offers_catalog.sql](../../supabase/migrations/20260579_partner_offers_catalog.sql)
  - [supabase/migrations/20260587_partner_offers_tier_state_category.sql](../../supabase/migrations/20260587_partner_offers_tier_state_category.sql)
  - [supabase/migrations/20260574_ebt_phase1.sql:53](../../supabase/migrations/20260574_ebt_phase1.sql) (`ebt_transaction_category` enum)
  - `Civica/Features/SNAP/EBTBalance/Views/EBTBalanceDashboardView.swift` (`perksSection` / `perksOfferRow`)

---

**Not legal advice.** Internal working analysis for counsel review. Civica is early-stage and the offer platform has not yet been rolled out to a general user population; the questions in Section 3 should be answered before the rollout gate opens.
