#!/usr/bin/env python3
"""
USDA SNAP QC FY2023 Public-Use File -> California error-rate aggregates.

Reproducible grounding for the engine's reference constants + the operational
vs client (agency-vs-client) split. Reads the real microdata (download via
tools/usda-qc-ingest/README.md), filters CA (STATE==6), and writes a compact
artifact + provenance. Companion to docs/findings/2026-05-29-error-rate-truth-point.md.

Real-schema column map (verified against the FY2023 Tech Doc codebook, Ch. V):
  STATE        — state FIPS (California = 6)
  FYWGT        — full-year QC weight (stratified sample; rates must be weighted)
  ELEMENT1..9  — element of error per variance (363 shelter, 311 wages, ...)
  AGENCY1..9   — "AGENCY OR CLIENT RESPONSIBILITY", primary cause of variance
  AMOUNT1..9   — variance dollar amount

AGENCY codebook -> responsibility class:
  agency (operational): 10 policy-incorrectly-applied, 12 info-disregarded,
    14/15 failed-follow-up, 16 failed-to-verify, 17 programming, 18 data-entry,
    19 mass-change, 20 arithmetic, 21 computer-user
  client (household):   1 not-reported, 2 incomplete-info, 3 withheld(IPV),
    4 incorrect-info(IPV), 7 collateral
  excluded: 8 (excluded from error determination per codebook)
  other: 99

Run:
  .venv/bin/python src/ca_aggregates.py --data /path/qc_pub_fy2023.csv \
    --out-dir ../../data-ops/sample/usda-qc-ca --generated-at <ISO>
"""
from __future__ import annotations

import argparse
import json
import os
import sys

AGENCY_OPERATIONAL = {10, 12, 14, 15, 16, 17, 18, 19, 20, 21}
CLIENT = {1, 2, 3, 4, 7}
EXCLUDED = {8}

# Engine CA_ELEMENT_ATTRIBUTION_FY23 (share %) — what the microdata should reproduce.
ENGINE_ELEMENT = {
    363: ("Shelter deduction", 39.94), 311: ("Wages", 21.35), 331: ("RSDI", 11.06),
    333: ("SSI", 7.65), 346: ("Other unearned income", 6.25), 312: ("Self-employment", 5.16),
    364: ("Standard utility allowance", 4.49), 365: ("Medical expense deduction", 3.88),
}


def main(argv=None) -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--data", required=True)
    p.add_argument("--out-dir", default="data-ops/sample/usda-qc-ca")
    p.add_argument("--fiscal-year", type=int, default=2023)
    p.add_argument("--generated-at", default="unset")
    a = p.parse_args(argv)

    import pandas as pd  # noqa: PLC0415

    df = pd.read_csv(a.data, low_memory=False)
    if "STATE" not in df.columns:
        sys.exit("STATE column missing — wrong file?")
    ca = df[df["STATE"] == 6].copy()
    w = "FYWGT"
    ecols = [c for c in df.columns if c.startswith("ELEMENT")]
    acols = [c for c in df.columns if c.startswith("AGENCY")]
    mcols = [c for c in df.columns if c.startswith("AMOUNT")]

    errmask = ca[ecols].notna().any(axis=1)
    err = ca[errmask]
    tot_err_w = float(err[w].sum())

    # Element shares: weighted errored cases citing element / total errored cases
    # (the engine's denominator; shares can exceed 100% summed since a case can
    # cite several elements).
    elems = sorted({int(v) for ec in ecols for v in ca[ec].dropna().unique()})
    element_share = {}
    for el in elems:
        cited = err[(err[ecols] == el).any(axis=1)]
        element_share[el] = round(float(cited[w].sum()) / tot_err_w * 100, 2)
    element_top = dict(sorted(element_share.items(), key=lambda kv: -kv[1])[:10])

    shelter_or_wages = round(
        float(err[(err[ecols] == 363).any(axis=1) | (err[ecols] == 311).any(axis=1)][w].sum())
        / tot_err_w * 100, 1)

    # Agency (operational) vs client — dollar-weighted across variance slots.
    rows = []
    for ac, mc in zip(acols, mcols):
        sub = ca[ca[ac].notna()]
        for code, amt, wt in zip(sub[ac].astype(int), sub[mc].fillna(0), sub[w]):
            rows.append((int(code), float(amt) * float(wt)))
    dollars = {"agency_operational": 0.0, "client": 0.0, "excluded": 0.0, "other": 0.0}
    counts = {"agency_operational": 0, "client": 0, "excluded": 0, "other": 0}
    for code, wamt in rows:
        k = ("agency_operational" if code in AGENCY_OPERATIONAL
             else "client" if code in CLIENT
             else "excluded" if code in EXCLUDED else "other")
        dollars[k] += wamt
        counts[k] += 1
    base = dollars["agency_operational"] + dollars["client"]
    operational_pct = round(dollars["agency_operational"] / base * 100, 1) if base else None
    client_pct = round(dollars["client"] / base * 100, 1) if base else None

    result = {
        "scope": "CA", "fiscal_year": a.fiscal_year, "weight": w,
        "n_ca_cases": int(len(ca)),
        "n_ca_errored_cases": int(errmask.sum()),
        "element_share_pct": {str(k): v for k, v in element_top.items()},
        "element_validation_vs_engine": {
            str(k): {"real": element_share.get(k), "engine": ENGINE_ELEMENT[k][1],
                     "label": ENGINE_ELEMENT[k][0]}
            for k in ENGINE_ELEMENT
        },
        "shelter_or_wages_share_of_errored_pct": shelter_or_wages,
        "responsibility_dollar_weighted": {
            "operational_pct": operational_pct, "client_pct": client_pct,
            "raw_shares": {k: round(v / sum(dollars.values()) * 100, 1) for k, v in dollars.items()},
        },
        "responsibility_count": counts,
        "notes": [
            "Element share = weighted errored cases citing element / total errored cases (engine denominator).",
            "Operational vs client is dollar-weighted variance (AMOUNT x FYWGT); excludes code 8 and 'other'(99) from the base.",
            "No 'policy-design' category exists in QC — errors are agency (operational) or client (household).",
        ],
    }

    os.makedirs(a.out_dir, exist_ok=True)
    out = os.path.join(a.out_dir, f"ca_qc_fy{a.fiscal_year}.json")
    with open(out, "w", encoding="utf-8") as fh:
        json.dump(result, fh, indent=2, ensure_ascii=False)
    prov = {
        "source": "USDA SNAP QC Public-Use File — snapqcdata.net (qcfy2023_csv.zip)",
        "fiscal_year": a.fiscal_year, "input_basename": os.path.basename(a.data),
        "generated_at": a.generated_at, "weight": w,
        "agency_operational_codes": sorted(AGENCY_OPERATIONAL),
        "client_codes": sorted(CLIENT), "excluded_codes": sorted(EXCLUDED),
        "codebook": "FY2023 Tech Doc Ch. V — AGENCY1..9 = AGENCY OR CLIENT RESPONSIBILITY",
    }
    with open(os.path.join(a.out_dir, f"ca_qc_fy{a.fiscal_year}.provenance.json"), "w", encoding="utf-8") as fh:
        json.dump(prov, fh, indent=2, ensure_ascii=False)

    print(f"wrote {out}")
    print(f"CA cases={result['n_ca_cases']} errored={result['n_ca_errored_cases']}")
    print(f"operational/client (dollar-weighted) = {operational_pct}% / {client_pct}%")
    print(f"shelter|wages share of errored = {shelter_or_wages}%")
    print("element validation (real vs engine):")
    for k, v in result["element_validation_vs_engine"].items():
        print(f"  {k} {v['label']}: real={v['real']}  engine={v['engine']}")


if __name__ == "__main__":
    main()
