# CRA Artifact — Build Spec (final, post eng-review 2026-08-22)

Parent: [cra-benefits-access-pilot.md](cra-benefits-access-pilot.md) · Research: [cra-pilot-research-2026-08-22.md](../strategy/cra-pilot-research-2026-08-22.md)

## What this is
A local generator (`tools/cra-artifact/`, Python + pytest, **no deployed surface**) that produces per-bank 3-part PDF pitch artifacts for ≤5 CA banks. Distribution = email. The same HTML template can deploy as a page later if a bank asks for a live link.

## Decisions locked in eng review
1. **Reuse, don't rebuild:** county-grain everything, on top of `data-ops/analysis/track1-food-desert/` — `artifacts/county_metrics.csv` (58 counties: eligible_pop, non_enroll_rate) and `data-ops/reference/ca_counties.geojson`. NO new crosswalk, NO TIGER pull, NO geopandas, NO PUMA map. Two crosswalks in one repo = two numbers for one county = disqualifying.
2. **Headline metric = absolute unmet need** (computed 2026-08-22 from county_metrics.csv): eligible-but-unenrolled count + estimated annual benefit dollars in the bank's assessment area. Verified examples: Orange ~194K unenrolled; LA ~797K; Sacramento ~107K. The disproportionality ratio is DEMOTED to a secondary line, shown only where favorable AND CI-robust (Marin 1.23, Placer 1.21 qualify; Bank Irvine 1.12, Hanmi 0.97, Five Star 0.96 do NOT — omit it for them).
3. **Assessment areas come from each bank's public CRA performance evaluation PDF** (exact, manual read, ~1 hr for 5 banks) — not branch-footprint approximation. FDIC SOD is dropped from round one entirely. Verify current branch lists on each bank's website (Bank Irvine's PE is from 10/2024).
4. **Renderer: headless-Chrome print to PDF.** Not WeasyPrint.

## Inputs (each with .provenance.json, per data-ops convention)
- `county_metrics.csv` (existing; provenance notes: derived from ca-snap-gap **2023 ACS 1-Year PUMS** LightGBM model — NOT 5-year; CV AUC 0.80)
- `ca_counties.geojson` (existing)
- `assessment_areas.json` — hand-entered per bank from its PE PDF: CERT, bank name, AA counties, PE date/URL
- `funnel_assumptions.json` — versioned LOW/MID assumption set from the T3 funnel research (CPCs, stage rates, allotment); the mock report reads ONLY from this file
- Benefit math: unenrolled × participation-adjusted household factor × $351.49/mo (USDA FY2024) — factors in funnel_assumptions.json

## The three parts (per-bank HTML → PDF)
1. **Needs view:** county choropleth of the bank's AA (existing geojson; no-data counties gray, never zero), headline absolute unmet-need count + benefit-$ range with CI band, ratio line only where rule 2 allows.
2. **Proposal:** pilot shapes ($15K/$30K/$50K grant + $5–10K Community Sponsor fast lane), factual-ad framing, no-steering bright line, Google-Ad-Grants leverage note, measurement plan as the pilot's stated learning goal.
3. **Mock quarterly report (labeled PROJECTED / measurement plan to be validated):** submitted-basis ranges from funnel_assumptions.json only; dollar-traceability chain; never the HIGH case.

**Methodology footer (every PDF):** data vintages (2023 ACS 1-Year PUMS model; county_metrics build date; PE date per bank), the two README-documented upward biases (gross-income proxy; ACS under-reporting), AA source ("as delineated in [bank]'s [date] CRA performance evaluation"), CRA framing as suggested-not-asserted ("activities of this type are typically considered community development services/investments under the community-services prong" — final wording reviewed by Matthew).

## Verification
- Golden fixture: synthetic 2-county bank, hand-computable outputs, float tolerance 1e-9 relative.
- Oracle: independent spreadsheet hand-calc for Bank Irvine + 1–2 others from raw county_metrics.csv — exact agreement (within tolerance) gates any send.
- Pytest edge cases: unknown CERT/bank key in assessment_areas.json; AA county absent from county_metrics.csv → gray + listed in a data-gaps note (never zero); county in metrics missing from geojson → hard error; missing template field → build FAILS; funnel_assumptions.json schema-validated; benefit-$ math cross-checked against a fixture constant; PDF smoke (renders, <10MB, footer contains all vintages + both bias disclosures); choropleth gray-vs-low-need visually distinct (distinct fill values asserted in SVG).
- **Send archive:** every emailed PDF content-hashed + copied to `tools/cra-artifact/sent/{bank}-{date}-{hash8}.pdf` so any later data regeneration can reconstruct exactly what a bank saw.

## Document design (locked by /plan-design-review 2026-08-22)

**Approved visual reference:** `~/.gstack/projects/matthewgg22-Civica/designs/cra-pdf-page1-20260822/cra-page1-wireframe.png` (+ .html source — the T5c template starting point). Direction: giant serif statistic as the entire first impression; government-brief restraint; disclosure-forward.

1. **Page map — hard cap 5 pages, one job each:** p1 the need (approved wireframe) · p2 the program + THE ASK (2-line credibility beat: 501(c)(3) + determination year, one-sentence Demeter description, 50-state coverage number → pilot tiers → boxed unmissable CTA "The ask: a 30-minute conversation" + name/email/phone) · p3 sample quarterly report (PROJECTED mock, one page, table-first) · p4 how measurement works · p5 methodology & disclosures.
2. **Single-county AA rule:** never render a one-polygon choropleth. Single-county banks (Bank Irvine) get a regional-context map — AA county in accent against neighboring counties in the need ramp, captioned "…in regional context." One rule covers single- and multi-county AAs.
3. **Design tokens:** Source Serif 4 (voice: big number, headlines) + IBM Plex Sans (labels, data, tabular figures). Ink `#1a1f1c`, accent pine `#1d4d3b`. Need ramp: single-hue green ordered by lightness (must survive grayscale printing); no-data gray distinct in B/W.
4. **Print minimums (tested in the PDF smoke test):** body ≥10pt, footer ≥8pt, contrast ≥4.5:1; render checks at grayscale and phone-mail-preview width.
5. **PROJECTED visual system:** mock-report tables carry an accent tint band + repeated diagonal "PROJECTED" treatment — no cropped screenshot can pass as measured data. (Extends the DESIGN.md "estimate/likely" honesty convention to print.)
6. **Brand (T9 CLOSED):** Civica Torrey Inc carries the document (letterhead as wireframed); Demeter appears as the program's engine in the p2 credibility beat. Footer contact is email/phone only — no URL until a minimal Civica Torrey org page exists (P2 follow-up, never a send blocker).

## Out of round-one scope
FDIC SOD automation (returns only if the target list outgrows manual PE reading) · PUMA-grain map (TODO-58 tract/PUMA modeling) · deployed web page (template deploys later on demand) · gated index (TODO-55) · real attribution pipeline (TODO-56) · real benefit-$ methodology (TODO-57).
