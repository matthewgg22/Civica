# `usda-qc-ingest` — ground the reference layer in real federal microdata

Turns the **USDA SNAP QC Public-Use File** into California error-rate aggregates,
so the engine's reference constants (CA element shares, income-group PER, CA
baseline PER) become *reproducible from the raw federal data* — "here is the
file, here is the query" — instead of hardcoded numbers to trust.

Companion to [`docs/findings/2026-05-29-error-rate-truth-point.md`](../../docs/findings/2026-05-29-error-rate-truth-point.md).

## 1. Download the file (one-time, manual)

The QC microdata is **public-use, free, no login, no agreement**:

1. Open **https://snapqcdata.net/datafiles**
2. Grab the most recent year (**FY2023** — FY2024 microdata isn't released yet).
   **Choose the CSV variant** (simplest — only needs pandas).
3. Save it somewhere local, e.g. `~/Downloads/qc_pub_fy2023.csv`.

(Why manual: it's a plain unauthenticated download, but it can't be fetched from
the sandbox here — grab it once in your browser.)

## 2. Set up

```bash
cd tools/usda-qc-ingest
/opt/homebrew/opt/python@3.13/bin/python3.13 -m venv .venv
.venv/bin/pip install -r requirements.txt        # pandas (CSV). Add pyreadstat for .sas7bdat/.dta
```

## 3. Inspect FIRST (verify column names)

The SNAP-QC column names must be checked against the codebook (FY2023 Tech Doc,
**Chapter V**, ~p.55). Print what's actually in the file:

```bash
.venv/bin/python src/ingest_qc.py inspect --data ~/Downloads/qc_pub_fy2023.csv
```

Paste me the column list and I'll finalize the `--col-*` mapping (state, weight,
error $, benefit $, earned income, and the element-of-error code).

## 4. Build the CA aggregates

```bash
.venv/bin/python src/ingest_qc.py build \
  --data ~/Downloads/qc_pub_fy2023.csv \
  --col-state STATEFIP --ca-code 6 \
  --col-weight FSUWGT --col-error RAWERR --col-benefit FSBEN \
  --col-earned FSEARN --col-element <ELEMENT_COL_FROM_INSPECT>
```

Writes `data-ops/sample/usda-qc-ca/ca_qc_fy2023.json` (+ `.provenance.json`) and
prints a **validation table** comparing the microdata-derived numbers against the
engine's reference constants (CA total PER, income-group PER, element shares).

## Design notes

- **Inspect-first, no fabrication.** `build` computes each aggregate only if its
  columns are present; anything missing is reported under `skipped`, never guessed.
- **Weighted.** All state/cohort PERs use the unit weight (`FSUWGT`) — the file
  is a stratified sample; unweighted counts are wrong for rates.
- **Defaults are conventional, not guaranteed.** The `--col-*` defaults are the
  stable SNAP-QC names used in published replication code; confirm via `inspect`.
- **Engine stays the source of truth.** This grounds/validates the constants; it
  does not replace them at runtime. If derived ≈ engine, that's the proof. If they
  diverge, that's a finding to chase.
