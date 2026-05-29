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

    skipped: dict[str, str] = {}

    # --- California filter -------------------------------------------------
    if cols["state"] not in df.columns:
        sys.exit(
            f"state column {cols['state']!r} not found. Run `inspect` and pass "
            f"--col-state. Available sample: {list(df.columns)[:20]}"
        )
    ca = df[df[cols["state"]].astype("string").str.strip().isin([str(args.ca_code), "06", "6"])]
    n_ca = len(ca)
    if n_ca == 0:
        sys.exit(f"0 CA rows for {cols['state']}=={args.ca_code}. Check --col-state/--ca-code.")

    weighted = cols["weight"] in ca.columns
    w = ca[cols["weight"]].astype("float64") if weighted else None
    if not weighted:
        skipped["weighting"] = f"weight column {cols['weight']!r} missing — counts are UNWEIGHTED"

    result: dict = {
        "scope": "CA",
        "fiscal_year": args.fiscal_year,
        "n_ca_unweighted": int(n_ca),
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

    # --- Element attribution (share of errored cases) ----------------------
    if cols["element"] and cols["element"] in ca.columns and cols["error"] in ca.columns:
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
    os.makedirs(args.out_dir, exist_ok=True)
    out = os.path.join(args.out_dir, f"ca_qc_fy{args.fiscal_year}.json")
    with open(out, "w", encoding="utf-8") as fh:
        json.dump(result, fh, indent=2, ensure_ascii=False)
    prov = {
        "source": "USDA SNAP QC Public-Use File (snapqcdata.net)",
        "fiscal_year": args.fiscal_year,
        "input_file": os.path.abspath(args.data),
        "input_mtime": os.path.getmtime(args.data),
        "generated_at": args.generated_at,
        "columns_used": cols,
        "codebook": "FY2023 Tech Doc, Chapter V (~p.55) — verify column names here",
    }
    with open(os.path.join(args.out_dir, f"ca_qc_fy{args.fiscal_year}.provenance.json"), "w", encoding="utf-8") as fh:
        json.dump(prov, fh, indent=2, ensure_ascii=False)

    # --- Validation table: microdata-derived vs engine constants ----------
    print(f"\nWrote {out}")
    print(f"CA rows: {n_ca:,}  (weighted: {weighted})\n")
    print("VALIDATION — microdata-derived vs engine reference (FY2023)")
    print("-" * 58)
    per = result["metrics"].get("total_per_pct")
    print(f"CA total PER       derived={_fmt(per)}   engine={ENGINE_CA_TOTAL_PER_FY2023}")
    ig = result["metrics"].get("income_group_per", {})
    if ig:
        print(f"  earned-any PER   derived={_fmt(ig.get('earned_any', {}).get('per_pct'))}"
              f"   engine(wage_only)={ENGINE_CA_INCOME_GROUP_PER_FY23['wage_only']}")
        print(f"  no-earned PER    derived={_fmt(ig.get('no_earned', {}).get('per_pct'))}"
              f"   engine={ENGINE_CA_INCOME_GROUP_PER_FY23['no_earned']}")
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

    pb = sub.add_parser("build", help="filter CA + compute aggregates + provenance")
    pb.add_argument("--data", required=True)
    pb.add_argument("--fiscal-year", type=int, default=2023)
    pb.add_argument("--out-dir", default="data-ops/sample/usda-qc-ca")
    pb.add_argument("--generated-at", default="unset", help="ISO timestamp for provenance")
    pb.add_argument("--col-state", default="STATEFIP")
    pb.add_argument("--ca-code", default="6")
    pb.add_argument("--col-weight", default="FSUWGT")
    pb.add_argument("--col-error", default="RAWERR")
    pb.add_argument("--col-benefit", default="FSBEN")
    pb.add_argument("--col-earned", default="FSEARN")
    pb.add_argument("--col-unearned", default="FSUNEARN")
    pb.add_argument("--col-element", default=None, help="element-of-error code column (from inspect)")
    pb.set_defaults(func=cmd_build)

    args = p.parse_args(argv)
    args.func(args)


if __name__ == "__main__":
    main()
