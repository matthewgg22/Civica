# Methodology Log

> **Repo-canonical copy** as of 2026-05-18 (T10). Productized from
> `~/Desktop/Civica USDA data/METHODOLOGY.md`. Future entries append here.

A running record of every analytical assumption, computation, and decision made building Civica's data and deliverables. Append-only. Every entry dated.

---

## 2026-05-12 · §10105 state liability calculator

**Question answered.** What is each state's projected federal cost-share liability under OBBBA §10105 once the law takes effect in FY2028?

**Statute parsed.** §10105 (codified at 7 USC §2013(a)(2)) sets the state share of SNAP benefit costs by payment error rate (PER) band:

| PER band       | State share | Federal share |
|----------------|-------------|---------------|
| < 6%           | 0%          | 100%          |
| 6% to < 8%     | 5%          | 95%           |
| 8% to < 10%    | 10%         | 90%           |
| ≥ 10%          | 15%         | 85%           |

Effective FY2028. For FY2028, the state may elect FY2025 or FY2026 PER. For FY2029+, the Secretary uses PER from three fiscal years prior.

**Delayed-implementation clause (§10105(B)(iii)).** If a state's FY2025 PER × 1.5 ≥ 20% (i.e., PER ≥ 13.33%), the state's implementation is delayed to FY2029. Same logic for FY2026 → FY2030. This is the cliff we surfaced as Civica's pitch wedge.

**FY24 PER as forward proxy.** The statute uses FY25 or FY26 PER; FY24 is the latest published. We use FY24 PER as the proxy throughout, with a clearly flagged assumption: liability numbers represent "what happens if FY25/FY26 mirror FY24." Every deliverable flags this. Update path: when FNS publishes FY25 PER (expected June 2026), re-run the calculator.

**Federal benefit denominator.** FY24 federal SNAP benefit dollars by state, sourced from FNS via National Grocers Association compilation (July 2025). DC's benefit total was back-derived from Savor Snap's published $48M H.R. 1 cost-share at 15% tier → $320M. Total denominator across 51 jurisdictions: $93.66B (matches FNS national reported ~$93.7B for benefits).

**Coverage.** 50 states + District of Columbia = 51 jurisdictions. Excluded: Guam and U.S. Virgin Islands (outside §10105 statutory scope per current reading). Puerto Rico is on the Nutrition Assistance Program, not SNAP, so not in §10105 at all.

**Out of scope of this calculation.** OBBBA §10101 (Thrifty Food Plan adjustments) and §10102 (ABAWD changes) both reduce FY28 benefit totals through reduced participation and per-household benefit. CBO's August 2025 supplemental estimates 2.4M participation reduction and $14/month TFP erosion. We have NOT yet folded those into the FY28 benefit denominator — so the absolute dollar liability figures are over-stated in real-dollar terms (the tier structure is correct; the volume isn't). Flagged for future work.

**Output.** `data/state_liability_fy24.csv` and `deliverables/civica_10105_fy29_cliff.pdf` + `.docx` + `.html`.

---

## 2026-05-12 · Payment error rate decomposition (over vs under)

**Question answered.** What share of SNAP payment error is over-payment vs under-payment, and what does it mean for Civica's positioning?

**Source.** USDA FNS, SNAP Payment Error Rates FY2024, dated June 30, 2025. The PDF reports each state's PER as the sum of an over-payment rate (dollars issued in excess of entitlement) and an under-payment rate (dollars eligible households were short-paid).

**National FY24 split.** 9.26% over + 1.67% under = 10.93% total. ~85% of error is over-payment by dollar weight.

**State-level pattern.** High-PER states are even more lopsided toward over-payment: Massachusetts is 92% over (13.03 / 1.07), Alaska 91%, New York 90%. The Maryland outlier (8.85 over / 4.79 under = 65% over / 35% under) is the most notable exception in the country.

**§10105 implication.** The statute counts BOTH directions toward the tier threshold. So technically, under-payment alone could push a state into a higher cost-share tier — but in practice, virtually all of the error is over-payment, so the cost-share story is functionally an over-payment story.

**Civica positioning implication.** Over-payment language for state CFOs and procurement (dollar-out-the-door framing); under-payment language for human-services commissioners and CBO partners (equity / families-shorted framing). Same product, two audiences, no contradiction.

---

## 2026-05-12 · 7 CFR Part 273 rule-citation index

**Question answered.** What does the regulatory substrate Civica's evidence packets need actually look like, citation-by-citation?

**Sections indexed.** §273.9 (Income and deductions) and §273.10 (Determining household eligibility and benefit levels). 138 rows from §273.9, 85 from §273.10, 223 total.

**Granularity rule.** Each row is a useful citation in an income evidence packet — typically section, subsection, and one level down (§273.9, §273.9(b), §273.9(b)(2)). Itemized lists of inclusions/exclusions/deductions got their own rows since each item is independently citable. Excessively granular sub-subsections that contain only procedural detail (forms to file, FNS notification mechanics) were rolled up.

**Relevance grading.** HIGH = directly governs income forms Civica's packets must cite (e.g., self-employment income definition, 12-month averaging rule). MEDIUM = general earned-income rule. LOW = procedural/administrative. Counts: 81 / 73 / 69.

**State-option join keys.** 17 specific clauses in §273.9 and §273.10 explicitly defer to state choice. These are the columns to extract from the State Options Report when correlating policy variation to error outcomes. Listed in `rules/cfr_273_index_notes.md`.

**Interpretive gaps surfaced.** Eight specific places where the regulation itself is silent or ambiguous — most importantly the undefined "reasonable certainty" standard at §273.10(c)(1)(i), and the unenumerated "cost of producing self-employment income" at §273.9(c)(9). These are the gaps where Civica's evidence packets have legal room to operate.

**Output.** `rules/cfr_273_rule_index.csv` (223 rows × 8 cols) and `rules/cfr_273_index_notes.md`.

---

---

## 2026-05-12 · OBBBA-adjusted FY28 benefit denominator

**Question answered.** Our §10105 liability figures used FY24 federal benefit totals as the FY28 denominator. OBBBA itself reduces FY28 federal SNAP spending through §§10101–10108. What do the corrected numbers say?

**Approach.** Build a multi-scenario adjustment model. Apply FY28 adjustment factor = (1 − participation reduction) × (1 − per-HH benefit reduction) × (1 + FY24→FY28 COLA growth) to each state's FY24 federal benefit total. Recompute §10105 liability against the adjusted denominator. Hold PER and tier classifications constant (the dollar denominator changes; the rate doesn't).

**Three scenarios.**
- **Conservative** (multiplier 1.013): 6% participation drop, 2% per-HH benefit drop, 10% COLA — produces slight increase from baseline because COLA exceeds cuts.
- **Mid** (multiplier 0.945): 10.8% participation drop (CBO central), 3.7% per-HH benefit drop, 10% COLA.
- **Aggressive** (multiplier 0.872): 15% participation drop, 5% per-HH benefit drop, 8% COLA — assumes states drop BBCE en masse.

**Mid-case outputs.**
- Total FY29+ annualized state liability: **$10.91B** (down from $11.55B baseline, −5.5%)
- 10-state FY29 cliff: **$3.75B** (down from $3.97B, defensible range $3.5B–$4.0B)
- Total FY28 federal benefits: $88.5B (down from $93.66B, −5.5%)

**Sources used.** CBO 10-year reduction figures from CBO's August 11, 2025 supplemental ($186.7B total; $165B benefit-side), via AEI's August 7, 2025 cross-reference table — used because the CBO PDF returned empty content via web_fetch this session. Cross-validated against CBO's May 22, 2025 Klobuchar-Craig letter (per-provision participation effects).

**Major limitation flagged.** Uniform national adjustment factor — actual state-level adjustments will vary based on state's ABAWD share, BBCE policy, internet deduction usage. Modeling state-specific factors is queued; requires QC microdata and State Options Report (both OS-locked).

**Self-correction wrinkle flagged.** §10102's removal of 3M ABAWDs may mechanically lower state PER, since ABAWD cases are statistically harder to verify. Not modeled here (PER held at FY24 levels) but flagged in the analysis write-up as a real and pitch-relevant second-order effect. Some cliff jurisdictions may exit the cliff before §10105 catches up, just from §10102 population removal.

**§10106 admin cost-share NOT included.** Separate state liability bucket (50%→75% admin share). Will eventually need to be folded into a "total state SNAP fiscal exposure" headline. Magnitude per state: roughly $50M–$300M annually based on FY23 SAR.

**Outputs.** `data/state_liability_fy28_adjusted.csv`, `data/obbba_rollup.json`, `analysis/obbba_adjusted_10105.md`.

---

---

## 2026-05-12 · Sample income evidence packet (Maria Lopez illustrative case)

**Question answered.** What does Civica's actual product output look like — a rule-cited, state-reviewable income evidence packet for a SNAP eligibility worker?

**Case design.** Fictional but grounded: 34-year-old single mother in Brockton MA, household of 2 (self + 8-year-old daughter), self-employed via Uber + DoorDash. Annual gross 1099 receipts $30,000; 12-month documented earnings showing seasonal variation ($1,980 low – $3,420 high). Cost of producing self-employment income $7,800/yr: 10,000 business miles × $0.67 IRS standard rate, business-portion cell plan, commercial-use auto insurance rider. Net SE income $1,850/mo. MA-specific shelter (rent $1,650 + MA HCSUA $651 = $2,301/mo).

**Deliberate teaching design.** The case is engineered so the §273.9(c)(9) cost-of-production deduction is decisive — without it, gross 1099 receipts of $2,500/mo fail the $2,137 HH-2 gross income test and the applicant is denied. With it correctly applied, net SE income of $1,850/mo passes the gross test, all other deductions follow, and the applicant receives $352/mo. The packet's value to the system is captured in that one calculation.

**Rule citations in the packet (cross-referenced to `rules/cfr_273_rule_index.csv`).**
- §273.9(a)(1) gross income test
- §273.9(a)(2) net income test
- §273.9(b)(1)(ii) self-employment income definition
- §273.9(c)(9) cost of producing self-employment income
- §273.9(d)(1) standard deduction
- §273.9(d)(6) excess shelter deduction
- §273.9(d)(6)(ii) shelter cap for non-elderly HH
- §273.10(c)(1)(i) reasonable certainty
- §273.10(c)(3)(ii) 12-month averaging
- §273.10(d) order of deductions
- §273.10(e)(1)(i)(B) 20% earned income deduction
- §273.10(e)(2) allotment calculation
- §273.11 computation methodology

**Math verification.** All values reconcile end-to-end: gross $30,000 → $2,500/mo → less $650/mo cost-of-production → $1,850/mo net SE → passes gross test ($1,850 < $2,137) → less $370 EID → $1,480 → less $198 standard deduction → $1,282 adjusted → less $672 capped excess shelter → $610 net income → passes net test ($610 < $1,644) → final allotment $535 max − $183 (30% of net) = **$352/mo**.

**FY24 SNAP parameters used.** Gross limit HH 2 $2,137/mo; net limit HH 2 $1,644/mo; max allotment HH 2 $535/mo; standard deduction $198/mo; excess shelter cap $672/mo; MA HCSUA $651/mo. All publicly published; would need re-baselining when FY25/FY26 COLAs take effect.

**Limitations of this packet as a template.**
- Single-state (Massachusetts) — MA's SUA and policy choices baked in; other states require state-options join from §273.11 and §273.9(d)(6).
- Self-employment income only — no W-2 income, no SSI, no TANF interactions.
- Standard mileage rate used; actual-expense method (also allowed under §273.11) requires receipts-by-receipts.
- "Reasonable certainty" justification assumes no anticipated platform/vehicle/hours change — real cases require applicant-specific documentation.
- No earned-income-credit interaction, no asset test (categorical eligibility assumed).

**Outputs.** `deliverables/civica_sample_packet.docx` and `civica_sample_packet.pdf`.

---

## Known assumptions to revisit

- **FY24 PER as forward proxy.** Hard-baked into the §10105 liability table. Will be wrong as soon as FY25 PER is published (June 2026).
- **FY24 benefit denominator.** Used as the FY28 denominator. OBBBA itself will reduce this — by how much we don't yet know precisely.
- **Tier 3 = single flat 15%.** The statute says "≥10%," so a state at 10.01% pays the same rate as a state at 24.66%. No marginal cost-share — pure step function. Implications: states near tier boundaries have outsize incentive; states already deep in Tier 3 have less marginal incentive to reduce PER unless they can drop fully under 10%.
- **Two-year cliff window.** Delayed states get one year reprieve in FY28 only; the same delay can re-trigger in FY29 only if FY26 PER × 1.5 ≥ 20%. So a state can defer at most one additional year. We've modeled the FY28 delay; FY29 re-trigger needs FY26 PER, which we don't have.

---

## 2026-05-13 · CA-tuned v_SUA / v_Expense packet (Move B)

**Question answered.** What does the flagship CA operational artifact look like at the applicant-CBO interface for the §10103 cohort?

**Cohort targeted.** Non-elderly, non-disabled CalFresh households who, under OBBBA §10103 (codified into California via CDSS ACL 25-68, effective Oct 1, 2025), can no longer claim the Standard Utility Allowance through automatic State Utility Assistance Subsidy conferral. They must now *directly verify* utility expenses to claim the SUA. LAO estimates ≈525K California households fall into this new verification-required cohort. CDSS in ACL 25-68 retained CalFresh's permissive verification stance ("verbal statement sufficient unless questionable"), but cases later flagged questionable, IEVS mismatched, or sampled for federal Quality Control under FNS Handbook 310 (Jan 13, 2026) can have the SUA disallowed if undocumented.

**Illustrative case.** Maria Hernandez, age 38, Pico-Union neighborhood of Los Angeles County. Single mother of two minor children (12 and 8). Hourly retail worker at Target Corp., $14.50/hr × 28 hrs/wk = $1,759/mo gross. Section 8 voucher tenant; household rent share $510/mo. Separate utility bills: SCE electric $90/mo, SoCalGas $35/mo, T-Mobile postpaid $40/mo. Spectrum internet at $60/mo is documented in the source inventory but *excluded from the SUA calculation per OBBBA §10104* (codified via CDSS ACL 25-50 / 25-68).

**Calculation inputs (primary source: CDSS ACIN I-46-25, FY26 COLAs).** Standard deduction (HH 1–3) $209; SUA $663; max allotment HH 3 $785; excess shelter cap (non-elderly) $744; gross income test 130% FPL HH 3 = $2,694; net income test 100% FPL HH 3 = $2,072. Calculation flow per 7 CFR §273.10(e)(2): gross $1,759 → less 20% EID ($352) → less standard deduction ($209) → adjusted $1,198 → shelter costs ($510 rent + $663 SUA = $1,173) → half adjusted income $599 → excess shelter ($574, under $744 cap) → applied excess shelter ($574) → net income $624 → 30% × net = $187 → max allotment $785 − $187 = **$598/mo**. Net income test passes.

**Counterfactual (without packet, verbal-only, later flagged questionable).** SUA disallowed. Shelter = rent only $510. Half adjusted income $599 still exceeds shelter, so the excess shelter deduction collapses to zero. Net income jumps to $1,198. 30% × $1,198 = $359. Allotment = $785 − $359 = **$426/mo**. **Delta = $172/mo, $2,064/year.**

This delta is the documented value of the v_SUA packet for the applicant — and the documented payment-error exposure averted for the county (CalFresh QC dollar-attributable to ELEMENT 363 / 364 if disallowance hits the QC sample). It is the operational expression of Civica's pitch.

**Citation order.** Every regulatory chain in the packet reads **CalSAWS page → CDSS ACL or ACIN → MPP § → 7 CFR §**. This is the order a California county welfare worker (DPSS in LA's case) actually consults sources: the CalSAWS procedure page they're inside of, then the ACL that drove the procedure change, then the MPP regulation section the ACL implements, then the federal CFR anchor. Reversing it (CFR-first) is the *researcher's* order, not the *worker's* order. Civica's product is built to the worker's order.

**Positioning vis-à-vis ACL 25-68.** Because California's verification stance is permissive, Civica is not a "verification escalation" — it is a *voluntary, structured, applicant-elective upgrade* the household elects to provide *if they want* the audit-grade documentary record. This is the framing that distinguishes Civica in CA from how it would have been framed in MA (where OLGT 2026-13 made documentary verification mandatory for self-declared income — making MA-Civica a compliance solution; CA-Civica is an applicant-protective product).

**Packet structure.** Seven sections: (1) Household composition + purchase-and-prepare designation per 7 CFR §273.1(a); (2) Earned income + W-2 wages with 12 weeks of pay stubs anchoring the reasonable-certainty standard per 7 CFR §273.10(c)(1); (3) Shelter expenses (rent share + Section 8 voucher documentation); (4) Utility expenses — the §10103 flagship section — with SCE, SoCalGas, T-Mobile separately documented and Spectrum internet explicitly *excluded* and called out per §10104; (5) Full FY26 CalFresh calculation with line-by-line citation chain; (6) Rule citation index in CA order; (7) Source documents inventory (13 items).

**Build pipeline.** `outputs/build_packet_CA.js` (docx-js script, 624 lines) → `civica_sample_packet_CA_v_SUA.docx` → soffice headless PDF conversion → `civica_sample_packet_CA_v_SUA.pdf` (5 pages, 178 KB). Both filed under `deliverables/`. Validates clean against docx skill validator (253 paragraphs, all checks passed).

**What this packet does NOT yet include.** A real applicant. A real CBO partner. Real DPSS reviewer feedback. The packet is a *product specification artifact* at this stage — the design proof for what the v_SUA / v_Expense intake looks like under CA's regulatory substrate. Conversion to an operating pilot requires Move C (LA County CBO outreach) and a real applicant cohort.

**Outputs.** `deliverables/civica_sample_packet_CA_v_SUA.pdf` and `.docx`.

---

## 2026-05-18 · QC category mapping (T7)

**Question answered.** Where do Civica's product controls actually map against the published federal QC error categories that drive OBBBA §10105 state liability, and where are the gaps?

**Category source.** USDA FNS SNAP Quality Control Public-Use File FY2023 (`qc_pub_fy2023.csv`, 43,776 cases × 854 variables), weighted by `FYWGT`. The `ELEMENT1..ELEMENT9` columns map to the federal QC standardized error-element coding scheme. Every state (CDSS included) reports against this scheme — "CDSS QC error categories" in product language are the federal ELEMENT codes, by California. Ranking and weighting taken from `~/Desktop/Civica USDA data/data/qc_profile/qc_fy2023_error_attribution.csv`. Companion analysis at `~/Desktop/Civica USDA data/analysis/qc_fy2023_profile.md`.

**Coverage scope.** Top 10 ELEMENT codes by weighted error share (cumulative ~115% — error rows can carry multiple ELEMENT codes) plus ELEMENT 211 (bank accounts) since Civica has a built control surface for it. Total 11 categories.

**Documented vs hypothesized decision rule.**
- `documented` — at least one `civica_controls[*].evidence_link` resolves to a real path in this repo as of the YAML's `source_pulled_at`. Path checked via `git ls-files`.
- `hypothesized` — Civica has a named product surface for the category but no code yet. The `evidence_link` carries a `(no <dir>/ yet)` annotation so it's distinguishable in coverage reports.
- `refuted` — investigated and intentionally out of scope. None currently.

**Dollar attribution methodology.** Per-category dollar attribution is computed as `share_of_errored_cases_pct × $10.24B` (FY24 national over-payment baseline: 10.93% PER × $93.66B federal benefit denominator). Numbers are point estimates for narrative use; not standard-error-bearing. Replicate weights (106 MB QC microdata file) needed for statistically-valid bands — flagged for follow-up, same as the 2026-05-13 entry.

**OBBBA section attribution.** Where a category has a direct OBBBA provision (§10101 TFP, §10102 ABAWD/unit composition, §10103 SUA, §10104 utilities sweep, §10108 noncitizen verification), the mapping cites it. Where the category rolls up only through §10105 PER tier exposure, that's stated. Categories with no OBBBA touch are marked `—`.

**Outputs.**
- `data-ops/derived/qc_category_mapping.yaml` — canonical (reviewer-editable).
- `data-ops/parquet/qc-mappings/v1/category_mapping.parquet` (+ `.provenance.json`) — analytics-queryable, uploaded to `civica-analytics/qc-mappings/v1/`.
- `data-ops/derived/civica_historical_baseline.md` — founder pitch artifact, regenerated by `pnpm data:report:baseline`.
- `analytics.qcMapping.byCategory / byCfrSection / coverage` — typed query surface.
- `apps/dashboard/components/QcCategoryCoverage.tsx` — stub render path; T5 plugs into state-audit dashboard.

**Known gaps + queued follow-ups.**
- Wage-only / mixed-wage-SE packet (ELEMENT 311) — `hypothesized`. Largest dollar opportunity outside shelter; v3 product target per `qc_fy2023_profile.md`.
- RSDI / SSI unearned-income packet (ELEMENT 331, 333) — `hypothesized`. Joint COLA-aware SSA-anchored flow.
- Child support packet (ELEMENT 350 + 366) — `hypothesized`. Joint received/paid flow.
- Medical expense packet (ELEMENT 365) — `hypothesized`. Elderly/disabled-only.
- State-by-state dollar allocation currently pro-rata by FY24 benefit share. When state-level QC microdata is folded in (`~/Desktop/Civica USDA data/USDA qualtiy control access data/qcfy2023_csv.zip`), refine per-state per-category attribution.
- Replicate-weight bands for all share-of-errored-cases figures (see 2026-05-13 entry).
