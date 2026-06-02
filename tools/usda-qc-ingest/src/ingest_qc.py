#!/usr/bin/env python3
"""
USDA SNAP QC Public-Use File  ->  California error-rate aggregates.

Grounds the engine's reference constants (CA element shares, income-group PER,
CA baseline PER) in the ACTUAL federal microdata, reproducibly — so the pitch
can say "here is the file, here is the query" instead of "trust our constants".
Companion to docs/findings/2026-05-29-error-rate-truth-point.md.

Source (public-use, free, no login): https://snapqcdata.net/datafiles
Most recent year = FY2023. Download the CSV variant (simplest — only needs
pandas) and pass its path with --data.

TWO MODES
  inspect : load the file, print row count + every column + dtype + a sample.
            RUN THIS FIRST — the SNAP-QC column names must be verified against
            the codebook (FY2023 Tech Doc, Chapter V, ~p.55). Then map the real
            names into the --col-* flags for `build`.
  build   : filter California, compute the aggregates that the confirmed columns
            allow, write a vendored artifact + provenance, and print a
            validation table vs the engine's current reference constants.

The --col-* defaults are the CONVENTIONAL SNAP-QC names (stable across recent
years, used in published replication code) but are NOT guaranteed — verify with
`inspect`. `build` computes each aggregate only if its columns are present and
clearly reports what it skipped and why. No fabrication: if a column is missing,
the aggregate is omitted, never guessed.
"""

from __future__ import annotations

import argparse
import json
import os
import sys


# Engine reference constants (FY2023) for the validation table. Mirrors
# packages/snap-qc-engine/src/scoring/error-risk.ts — these are what the
# microdata should reproduce. Source of truth stays in the engine; duplicated
# here only to print a side-by-side "derived vs engine" comparison.
ENGINE_CA_TOTAL_PER_FY2023 = 13.40          # per-history.ts (CA FY2023 total PER)
ENGINE_CA_INCOME_GROUP_PER_FY23 = {          # CA_INCOME_GROUP_PER_FY23
    "wage_only": 16.79,
    "mixed_wage_se": 15.84,
    "se_only": 7.77,
    "no_earned": 8.44,
}
ENGINE_CA_ELEMENT_ATTRIBUTION_FY23 = {       # CA_ELEMENT_ATTRIBUTION_FY23 (share %)
    "363": ("Shelter deduction", 39.94),
    "311": ("Wages", 21.35),
    "331": ("RSDI", 11.06),
    "333": ("SSI", 7.65),
    "346": ("Other unearned income", 6.25),
    "312": ("Self-employment", 5.16),
    "364": ("Standard utility allowance", 4.49),
}


def load_df(path: str):
    """Load the QC file by extension. Lazy-imports so --help needs no deps."""
    import pandas as pd  # noqa: PLC0415

    ext = os.path.splitext(path)[1].lower()
    if ext == ".csv":
        return pd.read_csv(path, low_memory=False)
    if ext in (".sas7bdat", ".sav", ".dta"):
        try:
            import pyreadstat  # noqa: PLC0415
        except ImportError:
            sys.exit(
                f"{ext} needs pyreadstat — `pip install pyreadstat`, or download "
                "the CSV variant from snapqcdata.net (only needs pandas)."
            )
        if ext == ".dta":
            df, _ = pyreadstat.read_dta(path)
        elif ext == ".sav":
            df, _ = pyreadstat.read_sav(path)
        else:
            df, _ = pyreadstat.read_sas7bdat(path)
        return df
    sys.exit(f"Unsupported file type {ext!r}. Use .csv / .sas7bdat / .dta / .sav")


def cmd_inspect(args) -> None:
    df = load_df(args.data)
    print(f"rows: {len(df):,}   columns: {len(df.columns)}\n")
    print("COLUMN                          DTYPE        NON-NULL")
    print("-" * 60)
    for col in df.columns:
        print(f"{str(col)[:30]:<31} {str(df[col].dtype):<12} {df[col].notna().sum():>8,}")
    print("\nFirst 3 rows (transposed):")
    import pandas as pd  # noqa: PLC0415
    with pd.option_context("display.max_rows", None, "display.max_columns", 3):
        print(df.head(3).T)
    print(
        "\nNext: map the real names against the codebook (Tech Doc Ch. V), then\n"
        "run `build` with --col-state/--col-weight/--col-error/--col-benefit/...\n"
    )


def _require(df, cols: dict, names: list[str]) -> list[str]:
    """Return the subset of `names` whose mapped column is missing from df."""
    return [n for n in names if cols[n] not in df.columns]


# AGENCY-code partition per FY2023 Tech Doc Ch. V (AGENCY OR CLIENT RESPONSIBILITY).
# Source: data-ops/sample/usda-qc-ca/ca_qc_fy2023.provenance.json.
AGENCY_OPERATIONAL = {10, 12, 14, 15, 16, 17, 18, 19, 20, 21}
AGENCY_CLIENT = {1, 2, 3, 4, 7}
AGENCY_EXCLUDED = {8}
ELEMENT_LABELS = {
    "363": "Shelter deduction",
    "311": "Wages",
    "331": "RSDI",
    "333": "SSI",
    "346": "Other unearned income",
    "312": "Self-employment",
    "364": "Standard utility allowance",
    "365": "Medical expense deduction",
    "350": "Dependent care deduction",
    "334": "Other earned income",
    "323": "Unemployment compensation",
    "366": "Child support deduction",
    "342": "Child support received",
    "332": "Veterans benefits",
    "130": "Resources",
    "140": "Vehicles",
    "150": "Household composition",
    "371": "Earned-income deduction",
    "520": "Work requirement / ABAWD",
}


def _agency_category(code: int) -> str:
    if code in AGENCY_OPERATIONAL:
        return "agency_operational"
    if code in AGENCY_CLIENT:
        return "client"
    if code in AGENCY_EXCLUDED:
        return "excluded"
    return "other"


def _multi_element_metrics(state_df, w, cols, error_col: str) -> dict:
    """Multi-element + multi-AGENCY attribution mirroring the CA reference build.

    Iterates ELEMENT1..9 + AGENCY1..9 per case. Element share = weighted
    per-case-distinct elements / total weighted attributable-errored cases.
    Responsibility ($-weighted) = sum of (FYWGT * |AMTERR|) per slot,
    classified by the slot's AGENCY code partition. Errored case = AMTERR ≠ 0
    AND has at least one non-null ELEMENT slot (excludes ~3% unattributable
    errored cases — matches CA reference build, n=378 vs 379 ref).
    """
    import pandas as pd  # noqa: PLC0415

    element_cols = [f"ELEMENT{i}" for i in range(1, 10) if f"ELEMENT{i}" in state_df.columns]
    agency_cols = [f"AGENCY{i}" for i in range(1, 10) if f"AGENCY{i}" in state_df.columns]
    n_slots = min(len(element_cols), len(agency_cols))
    if n_slots == 0:
        return {"_skipped": "no ELEMENT1..9 / AGENCY1..9 columns found"}

    err_abs = state_df[error_col].astype("float64").abs()
    has_any_element = state_df[[f"ELEMENT{i}" for i in range(1, n_slots + 1)]].notna().any(axis=1)
    errored_mask = (err_abs > 0) & has_any_element
    errored = state_df[errored_mask]
    if len(errored) == 0:
        return {"_skipped": "no errored cases in scope"}

    w_err = (w.loc[errored.index] if w is not None else pd.Series(1.0, index=errored.index))
    err_abs_err = err_abs.loc[errored.index]

    # Flatten (case × slot) into long-form rows. Build two long tables:
    #   long_el  — element-only (ELEMENT non-null, AGENCY may be null) for
    #              element-share denominators.
    #   long_resp — both ELEMENT and AGENCY non-null, for responsibility
    #              classification (null-AGENCY slots can't be classified).
    rows_el: list[pd.DataFrame] = []
    rows_resp: list[pd.DataFrame] = []
    for i in range(1, n_slots + 1):
        ec, ac = f"ELEMENT{i}", f"AGENCY{i}"
        e = errored[ec]
        a = errored[ac]
        em = e.notna()
        am = em & a.notna()
        if em.any():
            sub = errored[em]
            rows_el.append(pd.DataFrame({
                "case_idx": sub.index,
                "element": e[em].astype("Int64").astype("string"),
                "w": w_err.loc[sub.index].astype("float64").values,
            }))
        if am.any():
            sub = errored[am]
            rows_resp.append(pd.DataFrame({
                "case_idx": sub.index,
                "agency": a[am].astype("Int64"),
                "w": w_err.loc[sub.index].astype("float64").values,
                "err_abs": err_abs_err.loc[sub.index].astype("float64").values,
            }))
    if not rows_el:
        return {"_skipped": "all ELEMENT slots null in errored cases"}
    long_el = pd.concat(rows_el, ignore_index=True)
    long = pd.concat(rows_resp, ignore_index=True) if rows_resp else pd.DataFrame(
        columns=["case_idx", "agency", "w", "err_abs"]
    )

    # Element share — per-case (dedupe element occurrences within a case),
    # weighted by FYWGT, divided by total weighted errored cases. Includes
    # slots where AGENCY is null (CA reference build matches this).
    per_case = long_el.drop_duplicates(subset=["case_idx", "element"])
    total_err_w = float(w_err.sum())
    el_counts = per_case.groupby("element")["w"].sum().sort_values(ascending=False)
    element_share_pct = {
        str(k): round(float(v) / total_err_w * 100, 2)
        for k, v in el_counts.items()
    } if total_err_w else {}

    # Shelter (363) OR Wages (311) — share of errored cases citing either
    # (dedupe so a case with both is counted once).
    sw_cases = per_case[per_case["element"].isin(["363", "311"])].drop_duplicates(subset=["case_idx"])
    shelter_wages = round(float(sw_cases["w"].sum()) / total_err_w * 100, 2) if total_err_w else 0.0

    # Element validation labels vs engine.
    element_validation = {
        code: {
            "real": pct,
            "label": ELEMENT_LABELS.get(code, "(verify w/ codebook)"),
        }
        for code, pct in list(element_share_pct.items())[:10]
    }

    # Responsibility ($-weighted) — sum (FYWGT * |error$|) per slot, classified
    # by AGENCY partition. Raw shares include all four buckets; the
    # operational/client normalization restricts to those two.
    long["category"] = long["agency"].fillna(-1).astype("int64").map(_agency_category).fillna("other")
    long["wd"] = long["w"] * long["err_abs"]
    dollar_by_cat = long.groupby("category")["wd"].sum()
    total_d = float(dollar_by_cat.sum())
    raw_shares = {
        k: round(float(v) / total_d * 100, 1) if total_d else 0.0
        for k, v in dollar_by_cat.items()
    }
    for k in ("agency_operational", "client", "excluded", "other"):
        raw_shares.setdefault(k, 0.0)
    op_d = float(dollar_by_cat.get("agency_operational", 0.0))
    cl_d = float(dollar_by_cat.get("client", 0.0))
    norm = op_d + cl_d
    responsibility_dollar = {
        "operational_pct": round(op_d / norm * 100, 1) if norm else None,
        "client_pct": round(cl_d / norm * 100, 1) if norm else None,
        "raw_shares": raw_shares,
    }

    # Responsibility count — slot occurrences (NOT $-weighted).
    count_by_cat = long.groupby("category").size().to_dict()
    responsibility_count = {
        k: int(count_by_cat.get(k, 0))
        for k in ("agency_operational", "client", "excluded", "other")
    }

    return {
        "n_cases_in_scope": int(len(state_df)),
        "n_errored_cases": int(len(errored)),
        "weighted_n_errored": float(w_err.sum()) if w is not None else None,
        "element_share_pct": element_share_pct,
        "element_validation": element_validation,
        "shelter_or_wages_share_of_errored_pct": shelter_wages,
        "responsibility_dollar_weighted": responsibility_dollar,
        "responsibility_count": responsibility_count,
        "slots_used": n_slots,
    }


def cmd_build(args) -> None:
    df = load_df(args.data)
    cols = {
        "state": args.col_state,
        "weight": args.col_weight,
        "error": args.col_error,
        "benefit": args.col_benefit,
        "earned": args.col_earned,
        "unearned": args.col_unearned,
        "element": args.col_element,
    }

    state_label = args.state.upper()
    state_code = str(args.state_code if args.state_code is not None else args.ca_code)
    # FIPS may appear as "6" or "06" (CA) / "25" (MA); accept both representations.
    fips_variants = list({state_code, state_code.zfill(2), state_code.lstrip("0") or "0"})

    skipped: dict[str, str] = {}

    # --- State filter ------------------------------------------------------
    if cols["state"] not in df.columns:
        sys.exit(
            f"state column {cols['state']!r} not found. Run `inspect` and pass "
            f"--col-state. Available sample: {list(df.columns)[:20]}"
        )
    ca = df[df[cols["state"]].astype("string").str.strip().isin(fips_variants)]
    n_ca = len(ca)
    if n_ca == 0:
        sys.exit(f"0 {state_label} rows for {cols['state']} in {fips_variants}. Check --col-state/--state-code.")

    weighted = cols["weight"] in ca.columns
    w = ca[cols["weight"]].astype("float64") if weighted else None
    if not weighted:
        skipped["weighting"] = f"weight column {cols['weight']!r} missing — counts are UNWEIGHTED"

    result: dict = {
        "scope": state_label,
        "fiscal_year": args.fiscal_year,
        "n_unweighted": int(n_ca),
        "weighted": weighted,
        "weighted_n": float(w.sum()) if weighted else None,
        "metrics": {},
        "columns_used": cols,
        "notes": [],
    }

    # --- Dollar-weighted total PER  (error$ / issued$) ---------------------
    if not _require(ca, cols, ["error", "benefit"]):
        err = ca[cols["error"]].astype("float64").abs()
        ben = ca[cols["benefit"]].astype("float64")
        ww = w if weighted else 1.0
        denom = float((ww * ben).sum())
        per = round(float((ww * err).sum()) / denom * 100, 3) if denom else None
        result["metrics"]["total_per_pct"] = per
        result["notes"].append(
            "total_per_pct = sum(w*|error$|)/sum(w*benefit$)*100; approximate "
            "(no QC dollar-tolerance threshold applied)."
        )
    else:
        skipped["total_per"] = f"need {cols['error']} + {cols['benefit']}"

    # --- Income-group PER (earned vs no-earned) ----------------------------
    if not _require(ca, cols, ["error", "benefit", "earned"]):
        earned = ca[cols["earned"]].astype("float64").fillna(0)
        groups = {"earned_any": earned > 0, "no_earned": earned <= 0}
        ig: dict = {}
        for g, mask in groups.items():
            sub = ca[mask]
            if len(sub) == 0:
                continue
            ww = (w[mask] if weighted else 1.0)
            e = sub[cols["error"]].astype("float64").abs()
            b = sub[cols["benefit"]].astype("float64")
            d = float((ww * b).sum())
            ig[g] = {
                "n": int(len(sub)),
                "per_pct": round(float((ww * e).sum()) / d * 100, 3) if d else None,
            }
        result["metrics"]["income_group_per"] = ig
    else:
        skipped["income_group_per"] = f"need {cols['error']} + {cols['benefit']} + {cols['earned']}"

    # --- Element attribution -----------------------------------------------
    if args.multi_element:
        # Authoritative methodology: iterate ELEMENT1..9 + AGENCY1..9 per case.
        # Mirrors the CA reference build (data-ops/sample/usda-qc-ca/ca_qc_fy2023.json).
        if cols["error"] in ca.columns:
            me = _multi_element_metrics(ca, w if weighted else None, cols, cols["error"])
            if "_skipped" in me:
                skipped["multi_element"] = me["_skipped"]
            else:
                result["metrics"].update(me)
                result["notes"].append(
                    "Element share = weighted slot-count citing element / total weighted slot-count "
                    "across ELEMENT1..N (engine denominator)."
                )
                result["notes"].append(
                    "Operational vs client = $-weighted variance (FYWGT × |AMTERR|) per slot, "
                    f"AGENCY ∈ {{operational: {sorted(AGENCY_OPERATIONAL)}, "
                    f"client: {sorted(AGENCY_CLIENT)}, excluded: {sorted(AGENCY_EXCLUDED)}}}."
                )
                result["notes"].append(
                    "No 'policy-design' category exists in QC — errors are agency (operational) "
                    "or client (household)."
                )
        else:
            skipped["multi_element"] = f"need {cols['error']} column for errored-case filter"
    elif cols["element"] and cols["element"] in ca.columns and cols["error"] in ca.columns:
        # Single-element fallback (legacy / quick-look mode).
        errored = ca[ca[cols["error"]].astype("float64").abs() > 0]
        ww = (w.loc[errored.index] if weighted else None)
        counts = (
            errored.groupby(errored[cols["element"]].astype("string")).apply(
                lambda g: float(ww.loc[g.index].sum()) if weighted else float(len(g))
            )
        )
        total = float(counts.sum())
        result["metrics"]["element_share_pct"] = {
            str(k): round(v / total * 100, 2) for k, v in counts.sort_values(ascending=False).items()
        } if total else {}
    elif cols["element"]:
        skipped["element_share"] = f"element column {cols['element']!r} not found"
    else:
        skipped["element_share"] = "no --col-element provided (identify it via `inspect` first)"

    result["skipped"] = skipped

    # --- Write artifact + provenance --------------------------------------
    out_dir = args.out_dir or f"data-ops/sample/usda-qc-{state_label.lower()}"
    os.makedirs(out_dir, exist_ok=True)
    prefix = f"{state_label.lower()}_qc_fy{args.fiscal_year}"
    out = os.path.join(out_dir, f"{prefix}.json")
    with open(out, "w", encoding="utf-8") as fh:
        json.dump(result, fh, indent=2, ensure_ascii=False)
    prov = {
        "source": "USDA SNAP QC Public-Use File (snapqcdata.net)",
        "fiscal_year": args.fiscal_year,
        "input_file": os.path.abspath(args.data),
        "input_mtime": os.path.getmtime(args.data),
        "generated_at": args.generated_at,
        "state_label": state_label,
        "state_fips_filter": fips_variants,
        "columns_used": cols,
        "codebook": "FY2023 Tech Doc, Chapter V (~p.55) — verify column names here",
    }
    with open(os.path.join(out_dir, f"{prefix}.provenance.json"), "w", encoding="utf-8") as fh:
        json.dump(prov, fh, indent=2, ensure_ascii=False)

    # --- Validation table: microdata-derived vs engine constants ----------
    print(f"\nWrote {out}")
    print(f"{state_label} rows: {n_ca:,}  (weighted: {weighted})\n")
    if state_label == "CA":
        print("VALIDATION — microdata-derived vs engine reference (FY2023, CA)")
        print("-" * 58)
        per = result["metrics"].get("total_per_pct")
        print(f"CA total PER       derived={_fmt(per)}   engine={ENGINE_CA_TOTAL_PER_FY2023}")
        ig = result["metrics"].get("income_group_per", {})
        if ig:
            print(f"  earned-any PER   derived={_fmt(ig.get('earned_any', {}).get('per_pct'))}"
                  f"   engine(wage_only)={ENGINE_CA_INCOME_GROUP_PER_FY23['wage_only']}")
            print(f"  no-earned PER    derived={_fmt(ig.get('no_earned', {}).get('per_pct'))}"
                  f"   engine={ENGINE_CA_INCOME_GROUP_PER_FY23['no_earned']}")
    else:
        print(f"METRICS ({state_label}, FY{args.fiscal_year}) — no engine reference to validate against yet")
        print("-" * 58)
        per = result["metrics"].get("total_per_pct")
        print(f"{state_label} total PER       derived={_fmt(per)}")
        ig = result["metrics"].get("income_group_per", {})
        if ig:
            print(f"  earned-any PER   derived={_fmt(ig.get('earned_any', {}).get('per_pct'))}")
            print(f"  no-earned PER    derived={_fmt(ig.get('no_earned', {}).get('per_pct'))}")
        es = result["metrics"].get("element_share_pct", {})
        if es:
            print("  top element shares:")
            for k, v in list(es.items())[:7]:
                print(f"    {k:>5}  {v}%")
    if skipped:
        print("\nSKIPPED (missing columns — map via `inspect` then re-run):")
        for k, v in skipped.items():
            print(f"  - {k}: {v}")


def _fmt(x) -> str:
    return f"{x}" if x is not None else "—"


def main(argv=None) -> None:
    p = argparse.ArgumentParser(description="USDA SNAP QC -> CA error-rate aggregates")
    sub = p.add_subparsers(dest="mode", required=True)

    pi = sub.add_parser("inspect", help="load + print columns/dtypes (run first)")
    pi.add_argument("--data", required=True, help="path to the QC file (.csv/.sas7bdat/.dta/.sav)")
    pi.set_defaults(func=cmd_inspect)

    pb = sub.add_parser("build", help="filter state + compute aggregates + provenance")
    pb.add_argument("--data", required=True)
    pb.add_argument("--state", default="CA", help="state label, e.g. CA / MA (controls output filenames + dir)")
    pb.add_argument("--state-code", default=None, help="state FIPS as string, e.g. 6 for CA, 25 for MA")
    pb.add_argument("--fiscal-year", type=int, default=2023)
    pb.add_argument("--out-dir", default=None, help="defaults to data-ops/sample/usda-qc-<state>")
    pb.add_argument("--generated-at", default="unset", help="ISO timestamp for provenance")
    pb.add_argument("--col-state", default="STATEFIP")
    pb.add_argument("--ca-code", default="6", help="DEPRECATED alias for --state-code; kept for back-compat")
    pb.add_argument("--col-weight", default="FSUWGT")
    pb.add_argument("--col-error", default="RAWERR")
    pb.add_argument("--col-benefit", default="FSBEN")
    pb.add_argument("--col-earned", default="FSEARN")
    pb.add_argument("--col-unearned", default="FSUNEARN")
    pb.add_argument("--col-element", default=None, help="element-of-error code column (from inspect)")
    pb.add_argument("--multi-element", action="store_true",
                    help="iterate ELEMENT1..9 + AGENCY1..9 (authoritative methodology, "
                         "mirrors CA reference build). Overrides --col-element.")
    pb.set_defaults(func=cmd_build)

    args = p.parse_args(argv)
    args.func(args)


if __name__ == "__main__":
    main()
