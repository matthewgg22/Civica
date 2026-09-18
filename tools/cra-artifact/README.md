# cra-artifact — per-bank CRA pitch PDF generator

Spec: [docs/designs/cra-artifact-build-spec.md](../../docs/designs/cra-artifact-build-spec.md) · Strategy: [docs/designs/cra-benefits-access-pilot.md](../../docs/designs/cra-benefits-access-pilot.md) · Research: [docs/strategy/cra-pilot-research-2026-08-22.md](../../docs/strategy/cra-pilot-research-2026-08-22.md)

Generates a 3-page US-Letter PDF on the Demeter design system (terracotta accent, Newsreader/Be Vietnam Pro) for one bank at a time: a **2-page pitch** (page 1 need — core-materials table + compact county map + documented-access callout; page 2 program + credit research + ask) plus a **detachable appendix** (page 3 — PROJECTED sample quarterly report + measurement plan + methodology/bias disclosures). County-grain, built on `data-ops/analysis/track1-food-desert/artifacts/county_metrics.csv` + `data-ops/reference/ca_counties.geojson`. Stdlib-only Python; renders via headless Chrome.

```bash
python3 -m src.generate --bank bank_irvine            # out/bank_irvine.{html,pdf} + oracle numbers
python3 -m src.memo --bank bank_irvine --amount 15000 --date 2026-10-01   # qualification memo
python3 -m src.memo --bank helm_bank --specimen       # unsigned sample memo for the pitch packet
python3 -m src.quarterly --bank ocean_bank --amount 25000 --period "Q1 2027" --sample   # the deliverable
python3 -m src.generate --bank bank_irvine --send     # + content-hash copy in sent/ (refuses verified:false)
python3 -m pytest tests/ -q                           # 19 tests: golden fixture + edge cases + PDF smoke
```

## Adding a bank or financial institution

Every value on the page is either shared org copy (`inputs/org.json`), state-driven copy (`src/states.py`, chosen by the institution's `state`), or computed from its assessment-area counties. So personalizing the memo for a new institution is **just filling a small per-institution config** — nothing in the template changes. The full field list, with what each one drives, is `src/institution.py` (or `--fields`).

```bash
python3 -m src.generate --fields                 # every per-institution field + what it controls
python3 -m src.generate --list                   # the whole roster with each institution's readiness
python3 -m src.generate --scaffold preferred_bank --state CA   # writes inputs/banks/preferred_bank.json stub
#   ... read the PE, fill name / aa_counties / ask_usd / pe_date / regulator ...
python3 -m src.generate --validate preferred_bank             # exactly what (if anything) is still missing
python3 -m src.generate --bank preferred_bank                 # out/preferred_bank.{html,pdf} + oracle numbers
```

**Two ways to define an institution** (identical schema):
- drop a JSON file at `inputs/banks/<key>.json` (the filename is the key — this is the "save a file to add a bank" path), or
- add an object under `"banks"` in `inputs/assessment_areas.json` (the original roster).

**Required fields:** `name`, `aa_counties`, `ask_usd`, `pe_date`, `regulator` (FDIC/OCC/FRB — selects the CRA rule part). `state` defaults to CA and **must be wired in `src/states.py`** (its SNAP fact base + participation rate); the currently wired states are CA/FL/TX/NY/AZ/KY/TN/AR/SC/MS. Leave `verified: false` until the PE is re-read — `--send` refuses to archive an unverified institution.

`--validate` (and the preflight that runs before every render) fails loudly with an actionable list: missing/mistyped required fields, an unrecognized regulator, an unwired state, a county not in that state's metrics, or leftover scaffold placeholders. If an AA county has no metrics coverage it renders gray and is excluded from figures (listed in the p1 footer); if NO county is covered, the build fails.

## Invariants the tests enforce
- Score math matches a hand-computable golden fixture (tolerance 1e-9); the CLI prints ORACLE CHECK numbers for the independent spreadsheet verification that gates any send (T5e).
- Ratio renders only at ≥ `ratio_display_threshold` (1.15) — absolute unmet need is always the headline.
- HIGH funnel scenario is never computed anywhere.
- Missing template fields and metrics↔geometry mismatches fail the build; no-data is gray, never zero.
- PROJECTED watermark + chip on the sample report; both known upward biases + all data vintages printed.
- Single-county AAs get a regional-context map, never a one-polygon choropleth.
- **Page-1 documented-access callout** (`inputs/county_access_evidence.json`, rendered by `src/access_evidence.py`): verbatim CDSS Management-Evaluation findings for the bank's AA counties, **quote-only** (source always shown), **silent when absent** (a county with no entry, and every non-CA bank, renders nothing — never a fabricated barrier), **capped at 2 entries strongest-first** so the artifact stays exactly five pages, and **excluded from all need/funnel/score math** (a test asserts `build_values`'s `need` equals `score.bank_need` computed alone). CA only — the CDSS production has no out-of-state counterpart.

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

## The quarterly report (`src/quarterly.py`) — the end-of-project deliverable

Five pages: headline result + exam-file block · delivery and service by county
(Layer 1, observed) · outcomes from the consented panel with opt-in and response
rates disclosed (Layer 2) · dollar traceability, the 63/15/12/10 split, and cost
per submitted application · methodology, the measured mid-funnel finding, and
what changes next quarter. Ships alongside the qualification memo; together they
are the bank's complete exam evidence for the grant.

**No measured-data source is wired yet, so the generator refuses to run without
`--sample`** rather than emit invented numbers as observed. The sample is
watermarked and its illustrative mid-funnel rates are deliberately set *below*
the proposal's mid-range assumptions — a test asserts this — so the sample
demonstrates the integrity promise: the quarter where the number misses is the
quarter the report says so, on page 1.
