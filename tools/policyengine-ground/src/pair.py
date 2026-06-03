#!/usr/bin/env python3
"""
PolicyEngine US (offline) -> v0.6 oracle benefit-corroboration pairing.

The third-source independence proof for benefit dollars. Mutation testing
(tools/profile-harness/src/mutation-score/) proves the TS engine drifts from
its Python twin when mutated -- but both encode the same b = round(maxA -
0.30 * N) formula with the same constants. That is twin-consistency, not full
independence.

This script runs ~15 v0.6 profiles through PolicyEngine US (an independent
open-source SNAP model) and reports per-profile agreement vs the oracle's
expected benefit. Where PE agrees with the oracle within tolerance, the
benefit value is corroborated by a third, structurally independent source --
closing the loop the contamination-sanity-check finding flagged as open.

AGPL boundary: policyengine-us is AGPL-3.0; this is a DEV TOOL that runs it
OFFLINE in a local venv (see README). We ship only the JSON output (facts)
and this harness source, never the policyengine-us code. Outputs are facts
about a public benefit formula; the library is not conveyed.

Run:
  cd tools/policyengine-ground
  .venv/bin/python src/pair.py \\
    --state CA \\
    --year 2025 \\
    --out ../../data-ops/sample/policyengine-ca/oracle_pairing_fy26.json
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path


# Profiles selected to span the benefit-math surfaces. Each covers a path
# the engine has to get right; collectively they exercise earned/unearned/
# mixed income, E/D + non-E/D, small + large HH, homeless deduction, BBCE
# flips, edge cases at the gross/net boundaries, and shelter-cap regimes.
SELECTED_PROFILES = [
    # Earned-income paths (non-E/D)
    "A01",  # Single mother, 2 kids, low wage (hh3)
    "A04",  # Working family of 4 (hh4 boundary)
    "A09",  # LPR, 40 quarters, earned (immigration handled by PE structurally)
    # Unearned-income paths
    "A02",  # SSI only, elderly hh1 (categorical eligibility)
    "A03",  # SSDI + medical (E/D + medical deduction)
    "A07",  # Elderly couple low SS, high shelter (E/D uncapped shelter)
    # Mixed paths
    "A08",  # Wages + child support deduction
    # Special-case paths
    "A05",  # Homeless single adult, zero income (homeless deduction)
    "A06",  # Pure-TANF (cat-elig pure_PA)
    # Edge/threshold profiles (CA = BBCE-200 so M03/M04 both approve)
    "M01",  # Gross at 165% FPL (BBCE flip; sub-130% in KS would DENY)
    "M03",  # Gross just under 130%
    "M04",  # Gross just over 130%
    # Shelter / deduction regimes
    "M09",  # Shelter at the cap (non-E/D)
    "M11",  # Working parent with childcare deduction
    "H03",  # Shelter ladder mid-point (non-E/D capped regime)
]


def find_member(profile: dict, member_id: str) -> dict | None:
    for m in profile["facts"]["household"]:
        if m["member_id"] == member_id:
            return m
    return None


def is_ed(member: dict) -> bool:
    return bool(member.get("elderly")) or bool(member.get("disability")) or member.get("age", 0) >= 60


def map_profile_to_situation(profile: dict, year: int, state: str) -> dict:
    """
    Translate a v0.6 fixture profile into a PolicyEngine US situation dict.
    Annualizes monthly facts; routes income types to the correct PE variable.

    IMPORTANT: PolicyEngine US auto-imputes program participation (TANF, SSI,
    UI, etc.) for households that look eligible, which inflates snap_gross_income.
    To get a clean independent benefit reading for the *same* fact set we
    explicitly zero every income variable that the profile doesn't author.
    """
    # Income variables to suppress by default (auto-imputation sources)
    PEOPLE_INCOME_ZEROS = [
        "ssi", "social_security", "self_employment_income",
        "unemployment_compensation", "interest_income",
        "pension_income", "rental_income",
    ]
    SPM_UNIT_ZEROS = ["tanf"]

    members = []
    people: dict = {}
    for m in profile["facts"]["household"]:
        pid = m["member_id"]
        people[pid] = {"age": {year: m["age"]}}
        # Suppress auto-imputation
        for var in PEOPLE_INCOME_ZEROS:
            people[pid][var] = {year: 0}
        members.append(pid)

    # Route income by type — overrides zeros set above
    def add_to(pid, var, annual):
        if var in people[pid] and people[pid][var].get(year, 0) > 0:
            people[pid][var][year] += annual
        else:
            people[pid][var] = {year: annual}

    # v0.6 type name → PE variable. tanf is on spm_unit so handled separately.
    EARNED_MAP = {"wages": "employment_income", "wages_contract": "employment_income"}
    UNEARNED_MAP = {
        "unearned_rsdi": "social_security",
        "unearned_ssdi": "social_security",
        "ssi": "ssi",
        "unearned_ui": "unemployment_compensation",
    }
    SE_TYPES = {"self_employment", "farm_se"}
    EXCLUDED_TYPES = {"americorps_sn", "excluded_tax_refund", "gift_cash"}
    PENDING_TANF_TYPES = {"tanf", "unearned_tanf"}

    for inc in profile["facts"]["income"]:
        mid = inc["member"]
        if mid not in people:
            continue
        amount_monthly = float(inc["amount"])
        annual = amount_monthly * 12
        t = inc["type"]
        if t in EARNED_MAP:
            add_to(mid, EARNED_MAP[t], annual)
        elif t in UNEARNED_MAP:
            add_to(mid, UNEARNED_MAP[t], annual)
        elif t in SE_TYPES:
            add_to(mid, "self_employment_income", annual)
        elif t in PENDING_TANF_TYPES:
            people[mid].setdefault("_pending_tanf", 0)
            people[mid]["_pending_tanf"] += annual
        elif t in EXCLUDED_TYPES or t.startswith("excluded_"):
            continue
        else:
            sys.stderr.write(f"  warning: unmapped income type {t!r} on profile {profile['legacy_id']}; skipping\n")

    # Shelter -> housing_cost + utility_expense (annual)
    shelter = profile["facts"]["shelter"]
    housing_annual = float(shelter["rent"]) * 12
    sua_annual = float(shelter.get("sua_amount") or 0) * 12

    # Deductions: medical/dependent-care/child-support deductions live on
    # different entities in PE than I have an easy path to set on a per-
    # person basis. Skipping them is honest: the corroboration only covers
    # the (large) gross-and-shelter component. Profiles whose oracle benefit
    # is dominated by these deductions (A03 SSDI+medical) will show a
    # systematic delta. Track which were skipped.
    deds = profile["facts"]["deductions"]
    skipped_deductions = []
    if (deds.get("medical_unreimbursed") or 0) > 0:
        skipped_deductions.append(f"medical={deds['medical_unreimbursed']}")
    if (deds.get("dependent_care") or 0) > 0:
        skipped_deductions.append(f"dependent_care={deds['dependent_care']}")
    if (deds.get("child_support_paid") or 0) > 0:
        skipped_deductions.append(f"child_support={deds['child_support_paid']}")

    # Assets — handle v0.6 sentinel strings
    raw_assets = profile["facts"].get("assets")
    if isinstance(raw_assets, str):
        if "categorical_no_asset_test" in raw_assets:
            assets = 0.0  # cat-elig HH — PE handles cat-elig structurally
        else:
            # "not_authored" or unknown sentinel — fixture author intended a no-assert
            assets = 0.0  # treat as zero; the oracle expected was authored ignoring assets
    else:
        assets = float(raw_assets or 0)

    # Aggregate any per-person _pending_tanf into the spm_unit total
    tanf_annual = 0
    for pid in list(people.keys()):
        if "_pending_tanf" in people[pid]:
            tanf_annual += people[pid].pop("_pending_tanf")

    spm_unit = {
        "members": members,
        "snap": {year: None},
        "housing_cost": {year: housing_annual},
        "utility_expense": {year: sua_annual},
        "snap_assets": {year: assets},
        "tanf": {year: tanf_annual},  # always set (zero suppresses imputation)
    }

    # Homeless deduction: PE does not expose housing_status as a settable
    # SPM-unit variable in this version. Setting housing_cost=0 already
    # nudges the result; the homeless deduction substitute (~$199/mo) is
    # not exactly modeled but the magnitude is small relative to the
    # benefit floor.

    situation = {
        "people": people,
        "spm_units": {"spm": spm_unit},
        "households": {"hh": {"members": members, "state_name": {year: state}}},
    }
    # Stash the skipped-deductions list on a closure-accessible attribute
    # by returning it alongside; the caller picks it apart.
    return (situation, skipped_deductions)


def benefit_monthly(situation: dict, year: int) -> float | None:
    """Run PolicyEngine, return monthly SNAP benefit (rounded to dollar)."""
    from policyengine_us import Simulation

    sim = Simulation(situation=situation)
    annual = float(sim.calculate("snap", year)[0])
    return round(annual / 12)


def pair_profile(profile: dict, state: str, year: int, tolerance: int) -> dict:
    expected = profile["expected_by_state"].get(state, {})
    exp_benefit = expected.get("benefit")
    exp_verdict = expected.get("verdict")

    skipped_deductions: list[str] = []
    try:
        situation, skipped_deductions = map_profile_to_situation(profile, year, state)
        pe_benefit = benefit_monthly(situation, year)
    except Exception as err:
        return {
            "legacy_id": profile["legacy_id"],
            "label": profile["label"],
            "state": state,
            "expected_verdict": exp_verdict,
            "expected_benefit": exp_benefit,
            "pe_benefit": None,
            "delta": None,
            "agrees_within_tolerance": False,
            "skipped_deductions": skipped_deductions,
            "error": f"{type(err).__name__}: {err}"[:200],
        }

    delta = (pe_benefit - exp_benefit) if (exp_benefit is not None) else None
    agrees = (
        delta is not None
        and abs(delta) <= tolerance
        and exp_verdict == "APPROVE"
        and pe_benefit > 0
    )
    if exp_verdict == "DENY" and pe_benefit == 0:
        agrees = True

    return {
        "legacy_id": profile["legacy_id"],
        "label": profile["label"],
        "state": state,
        "expected_verdict": exp_verdict,
        "expected_benefit": exp_benefit,
        "pe_benefit": pe_benefit,
        "delta": delta,
        "agrees_within_tolerance": agrees,
        "skipped_deductions": skipped_deductions,
    }


def main(argv=None):
    p = argparse.ArgumentParser()
    p.add_argument("--state", default="CA")
    p.add_argument("--year", type=int, default=2026, help="PolicyEngine US calendar year (default 2026 picks up FY26 projected params)")
    p.add_argument("--tolerance", type=int, default=10, help="±$/mo tolerance for 'agrees'")
    p.add_argument("--fixture", default=None, help="path to civica_test_profiles.json")
    p.add_argument("--out", default=None)
    p.add_argument("--pe-version", default="unknown")
    p.add_argument("--profiles", default=None, help="comma-separated legacy_ids (default: built-in selection)")
    a = p.parse_args(argv)

    repo_root = Path(__file__).resolve().parents[3]
    fixture_path = (
        Path(a.fixture).resolve() if a.fixture
        else repo_root / "data-ops" / "sample" / "civica-test-profiles" / "v0.6.json"
    )
    out_path = (
        Path(a.out) if a.out
        else repo_root / "data-ops" / "sample" / f"policyengine-{a.state.lower()}" / f"oracle_pairing_fy26.json"
    )
    out_path.parent.mkdir(parents=True, exist_ok=True)

    fixture = json.loads(fixture_path.read_text())
    all_profiles = fixture.get("profiles") or fixture
    if isinstance(all_profiles, dict):
        all_profiles = list(all_profiles.values())

    by_legacy = {p["legacy_id"]: p for p in all_profiles}
    if a.profiles == "ALL_BY_STATE":
        selected_ids = [p["legacy_id"] for p in all_profiles if "expected_by_state" in p]
    elif a.profiles:
        selected_ids = a.profiles.split(",")
    else:
        selected_ids = SELECTED_PROFILES
    targets = [by_legacy[lid] for lid in selected_ids if lid in by_legacy]
    missing = [lid for lid in selected_ids if lid not in by_legacy]
    if missing:
        sys.stderr.write(f"warning: {len(missing)} requested legacy_ids not in fixture: {missing}\n")

    print(f"[pair] PolicyEngine US (offline) — {a.state} year={a.year} tolerance=±${a.tolerance}/mo", file=sys.stderr)
    print(f"[pair] {len(targets)} profiles to run", file=sys.stderr)

    results = []
    for prof in targets:
        print(f"  {prof['legacy_id']:6} {prof['label'][:55]:55} ", end="", file=sys.stderr, flush=True)
        r = pair_profile(prof, a.state, a.year, a.tolerance)
        if r.get("error"):
            print(f"ERROR: {r['error'][:80]}", file=sys.stderr)
        elif r["expected_benefit"] is None:
            print(f"(no expected benefit for {a.state})", file=sys.stderr)
        else:
            mark = "✓" if r["agrees_within_tolerance"] else "✗"
            print(
                f"{mark} exp=${r['expected_benefit']:>4} pe=${r['pe_benefit']:>4} Δ={r['delta']:>+4}",
                file=sys.stderr,
            )
        results.append(r)

    # Summary
    actionable = [r for r in results if r.get("expected_benefit") is not None and not r.get("error")]
    agrees = [r for r in actionable if r["agrees_within_tolerance"]]
    disagrees = [r for r in actionable if not r["agrees_within_tolerance"]]
    errors = [r for r in results if r.get("error")]

    summary = {
        "total": len(results),
        "actionable": len(actionable),
        "agrees": len(agrees),
        "disagrees": len(disagrees),
        "errors": len(errors),
        "agreement_rate_pct": round(100.0 * len(agrees) / len(actionable), 1) if actionable else 0.0,
        "median_delta": (
            sorted(r["delta"] for r in actionable)[len(actionable) // 2]
            if actionable else None
        ),
    }

    report = {
        "source": "PolicyEngine US (AGPL-3.0) run OFFLINE; outputs are facts (not the model code)",
        "pe_version": a.pe_version,
        "param_year": a.year,
        "state": a.state,
        "fixture_path": str(fixture_path),
        "tolerance_per_month_usd": a.tolerance,
        "summary": summary,
        "results": results,
    }
    try:
        rel = str(fixture_path.relative_to(repo_root))
    except ValueError:
        rel = str(fixture_path)
    report["fixture_path"] = rel
    out_path.write_text(json.dumps(report, indent=2))

    print(f"\n[pair] === SUMMARY ===", file=sys.stderr)
    print(f"  Total selected:       {summary['total']}", file=sys.stderr)
    print(f"  Actionable:           {summary['actionable']}", file=sys.stderr)
    print(f"  ✓ Agrees (±${a.tolerance}):  {summary['agrees']}", file=sys.stderr)
    print(f"  ✗ Disagrees:          {summary['disagrees']}", file=sys.stderr)
    print(f"  Errors:               {summary['errors']}", file=sys.stderr)
    print(f"  Agreement rate:       {summary['agreement_rate_pct']}%", file=sys.stderr)
    if summary['median_delta'] is not None:
        print(f"  Median Δ:             ${summary['median_delta']:+d}/mo", file=sys.stderr)
    print(f"\n[pair] Wrote report to {out_path}", file=sys.stderr)


if __name__ == "__main__":
    main()
