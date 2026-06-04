"""Dated SNAP parameter table — rules-as-versioned-data (single source of truth).

The determination engine resolves *every* indexed scalar from here by
`as_of_date`, instead of hardcoding a fiscal year. This is the "rules live in
versioned data, never hardcoded" mandate for the shared eligibility engine
(docs/plans/snap-rules-matrix.md). The big per-size tables (HHS poverty,
FNS max allotment, state SUA) already live in `poverty_guidelines.py` and are
resolved by date there; this module holds the remaining scalars (deduction
rates, standard deduction, shelter cap, minimum benefit, asset limits, income
ratios) plus the QC tolerance τ used by the scoring spine (not by the
determination itself).

DATA INTEGRITY: never edit a row after its effective window passes — supersede
with a new row. FY2025 values are the verified seed already in
`poverty_guidelines.py`. FY2026 is a FLAGGED PLACEHOLDER (`verified=False`):
its scalars are from `civica_accurate_number_model.md` v0.2 §4.2 and are NOT
re-verified against the FNS FY2026 COLA memo — and the FY2026 poverty/allotment
tables are not loaded either, so the engine still raises NoTableForDateError for
FY2026 dates. See docs/plans/fy2026-reference-tables.md before flipping it on.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from decimal import Decimal

from .poverty_guidelines import NoTableForDateError


@dataclass(frozen=True)
class FYParameters:
    fiscal_year: int
    effective_start: date
    effective_end: date

    # Statutory rates/ratios (do not vary by year, but versioned for completeness).
    earned_income_deduction_rate: Decimal   # §273.9(d)(2)
    benefit_reduction_rate: Decimal          # §273.10(e) — 30% of net
    gross_income_ratio: Decimal              # §273.9(a) — 130% FPL (federal default)
    net_income_ratio: Decimal                # §273.9(a) — 100% FPL

    # Indexed amounts (48 contiguous + DC).
    standard_deduction_by_size: dict[int, Decimal]  # keys 1,4,5,6 (6 = "6 or more")
    excess_shelter_cap: Decimal              # §273.9(d)(6), non-elderly/disabled
    minimum_benefit: Decimal                 # §273.10(e)(2)(ii), HH 1–2
    homeless_shelter_deduction: Decimal      # §273.9(d)(6)(i) — engine does not yet APPLY this
    asset_limit_household: Decimal           # §273.8
    asset_limit_elderly_disabled: Decimal    # §273.8

    # Scoring-spine parameter — QC payment-error tolerance. NOT read by the
    # determination; used by the error-rate / prevention wings.
    tolerance_tau: Decimal                   # FNS QC Error Tolerance Threshold

    # Provenance / verification gate.
    verified: bool
    provenance: str

    def standard_deduction(self, size: int) -> Decimal:
        if size <= 3:
            return self.standard_deduction_by_size[1]
        if size in self.standard_deduction_by_size:
            return self.standard_deduction_by_size[size]
        return self.standard_deduction_by_size[max(self.standard_deduction_by_size)]


# FY2025 — verified seed (matches the constants previously hardcoded in
# poverty_guidelines.py / federal.py; HHS 2024 guidelines + FNS FY25 COLA).
FY2025 = FYParameters(
    fiscal_year=2025,
    effective_start=date(2024, 10, 1),
    effective_end=date(2025, 9, 30),
    earned_income_deduction_rate=Decimal("0.20"),
    benefit_reduction_rate=Decimal("0.30"),
    gross_income_ratio=Decimal("1.30"),
    net_income_ratio=Decimal("1.00"),
    standard_deduction_by_size={1: Decimal("204"), 4: Decimal("217"), 5: Decimal("254"), 6: Decimal("291")},
    excess_shelter_cap=Decimal("712"),
    minimum_benefit=Decimal("23"),
    homeless_shelter_deduction=Decimal("190.30"),  # FY2025 per taxonomy §13 (the $179 Swift value was stale); engine does not apply it yet
    asset_limit_household=Decimal("3000"),
    asset_limit_elderly_disabled=Decimal("4500"),
    tolerance_tau=Decimal("57"),                  # ⚠ PLACEHOLDER — FY2025 QC ETT not verified
    verified=True,
    provenance="FY2025 verified seed (poverty_guidelines.py constants). τ + homeless_shelter_deduction are unverified placeholders (neither is read by the determination).",
)

# FY2026 — ✓ All cells primary-confirmed 2026-06-04 (issue #428) against CDSS ACIN
# I-46-25 (restates FNS FY26 COLA memo); see poverty_guidelines.py docstring for
# the full citation. OBBBA §10101 (TFP cost-neutrality, effective 2025-10-01) is
# implicitly reflected — the COLA was published after enactment, so the figures
# already bake in §10101. §10104 (internet excluded from shelter inputs) is an
# engine-input rule, not a cap value; tracked separately as an engine task.
FY2026 = FYParameters(
    fiscal_year=2026,
    effective_start=date(2025, 10, 1),
    effective_end=date(2026, 9, 30),
    earned_income_deduction_rate=Decimal("0.20"),
    benefit_reduction_rate=Decimal("0.30"),
    gross_income_ratio=Decimal("1.30"),
    net_income_ratio=Decimal("1.00"),
    standard_deduction_by_size={1: Decimal("209"), 4: Decimal("223"), 5: Decimal("261"), 6: Decimal("299")},
    excess_shelter_cap=Decimal("744"),
    minimum_benefit=Decimal("24"),
    homeless_shelter_deduction=Decimal("198.99"),
    asset_limit_household=Decimal("3000"),         # ✓ ACIN I-46-25
    asset_limit_elderly_disabled=Decimal("4500"),  # ✓ ACIN I-46-25
    tolerance_tau=Decimal("58"),
    verified=True,
    provenance="FY2026 all cells ✓ primary-confirmed 2026-06-04 (issue #428) via CDSS ACIN I-46-25 (which restates FNS FY26 COLA memo, effective 2025-10-01 - 2026-09-30): SD(1-3/4/5/6+)=209/223/261/299, max-allotment HH1-8=298/546/785/994/1183/1421/1571/1789 (+218 each add'l), cap=744, homeless=198.99, min=24, asset 3000/4500. τ=58 is the QC scoring-spine value (not read by the determination engine). OBBBA §10101 baked into the published COLA implicitly; §10104 engine-input rule tracked separately.",
)


_PARAMETER_TABLES: list[FYParameters] = [FY2025, FY2026]


def params_for(as_of_date: date) -> FYParameters:
    """Resolve the parameter row in effect on `as_of_date`."""
    for params in _PARAMETER_TABLES:
        if params.effective_start <= as_of_date <= params.effective_end:
            return params
    raise NoTableForDateError(
        f"No SNAP parameter table loaded for {as_of_date}. "
        f"Add the fiscal-year row before running determinations for that date."
    )
