# cra-artifact — per-bank CRA pitch PDF generator

Spec: [docs/designs/cra-artifact-build-spec.md](../../docs/designs/cra-artifact-build-spec.md) · Strategy: [docs/designs/cra-benefits-access-pilot.md](../../docs/designs/cra-benefits-access-pilot.md) · Research: [docs/strategy/cra-pilot-research-2026-08-22.md](../../docs/strategy/cra-pilot-research-2026-08-22.md)

Generates a 5-page US-Letter PDF (need → program + ask → PROJECTED sample report → measurement plan → methodology) for one bank at a time. County-grain, built on `data-ops/analysis/track1-food-desert/artifacts/county_metrics.csv` + `data-ops/reference/ca_counties.geojson`. Stdlib-only Python; renders via headless Chrome.

```bash
python3 -m src.generate --bank bank_irvine            # out/bank_irvine.{html,pdf} + oracle numbers
python3 -m src.memo --bank bank_irvine --amount 15000 --date 2026-10-01   # qualification memo
python3 -m src.memo --bank helm_bank --specimen       # unsigned sample memo for the pitch packet
python3 -m src.generate --bank bank_irvine --send     # + content-hash copy in sent/ (refuses verified:false)
python3 -m pytest tests/ -q                           # 19 tests: golden fixture + edge cases + PDF smoke
```

## Adding a bank
1. Read the bank's public CRA Performance Evaluation (FFIEC/regulator site); find its assessment-area counties.
2. Add an entry to `inputs/assessment_areas.json` (CERT, counties, PE date/URL, ask). Leave `verified: false` until Matthew re-reads the PE — `--send` enforces this.
3. Run the generator. If an AA county has no metrics coverage it renders gray and is excluded from figures (listed in the p1 footer); if NO county is covered, the build fails.

## Invariants the tests enforce
- Score math matches a hand-computable golden fixture (tolerance 1e-9); the CLI prints ORACLE CHECK numbers for the independent spreadsheet verification that gates any send (T5e).
- Ratio renders only at ≥ `ratio_display_threshold` (1.15) — absolute unmet need is always the headline.
- HIGH funnel scenario is never computed anywhere.
- Missing template fields and metrics↔geometry mismatches fail the build; no-data is gray, never zero.
- PROJECTED watermark + chip on the sample report; both known upward biases + all data vintages printed.
- Single-county AAs get a regional-context map, never a one-polygon choropleth.

## Before the first real send (human steps)
1. Re-read Bank Irvine's PE; flip `verified: true`. Check current branch list on bankirvine.com.
2. Oracle hand-calc (spreadsheet from raw county_metrics.csv) must match the printed ORACLE CHECK numbers.
3. MA/CA charitable-solicitation filings per the research doc (CA CT-1 filed before CA sends).
4. Print one copy in grayscale and open the PDF on a phone — both must stay legible.

## The qualification memo (`src/memo.py`)

The one-page memorandum a bank keeps in its community reinvestment file for a grant
we received. It exists because **CD grants are never publicly filed and never
reported item-by-item to a regulator** (12 CFR __.43 public-file contents; Large
Institution CRA Exam Procedures, Investment Test step 1) — the bank's internal log
plus whatever the grantee supplied is the entire evidence base an examiner sees.

Built to satisfy, item by item, what examiners verify: CD category + primary purpose
(§__.12(g)(2), Q&A §__.12(h)—8) · LMI proof via the SNAP proxy quoted verbatim from
Q&A §__.12(g)(2)—1 · geographic nexus (§__.12(h)—6) · amount/date/recipient ·
attestations covering program-delivery-only use, no returned benefit, no
per-enrollment compensation, no steering, and no double-claiming.

**Posture rule (test-enforced):** the memo supplies evidence and never asserts that
the grant qualifies or that any rating follows — that determination is the bank's.
Need figures are framed as performance-context input that raises responsiveness
weighting, never as "earns credit."

**One page is a hard requirement.** Long assessment areas auto-engage a `dense`
layout; if a memo still renders past one page the generator raises
`MemoOverflowError` rather than clip content. A test renders every loaded bank's
memo through Chrome and asserts exactly one page.
