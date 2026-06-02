"""Adapter: live enrollment packet answers -> the rules engine's Household.

The enrollment flow (snap_enrollment.packet_answers) stores flat key/value
answers with provenance (answer_source + the applicant/ocr/navigator triplet).
The rules engine consumes a structured Household (rules/interfaces.py). This
module bridges them and, crucially, reports what is MISSING: any engine input the
intake does not collect becomes a `needs` entry, which makes the determination
`pending` rather than a fabricated eligible/ineligible.

Provenance is preserved per fact (verified / self_reported / extracted) so a
determination's facts_snapshot records not just the values but how trusted they
are — the signal the Payment Integrity Engine later consumes.

AUDITED LIMITATION (2026-06-01): the intake collects household_size + a few
booleans + income/rent aggregates, but NO per-member ages or citizenship and NO
assets. HouseholdMember.age is required (no default), so a valid Household cannot
be constructed from today's data — every real packet resolves to `pending`, with
`needs` naming exactly what is uncollected. The construction path activates the
moment per-member collection lands; until then this adapter is the instrument
that quantifies the collection gap.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

# Canonical engine input -> the answer keys that may carry it. The live data has
# drifted from the questions.ts definitions (e.g. monthly_income vs
# monthly_gross_income, has_children vs household_has_children), so each field
# accepts several aliases.
_FIELD_ALIASES: dict[str, list[str]] = {
    "household_size": ["household_size"],
    "has_children": ["has_children", "household_has_children"],
    "has_disability": ["has_disability", "household_has_disabled"],
    "has_elderly": ["household_has_elderly", "has_elderly"],
    "employment_status": ["employment_status"],
    "monthly_income": ["monthly_income", "monthly_gross_income"],
    "monthly_rent": ["monthly_rent", "monthly_rent_or_mortgage"],
    "monthly_utilities": ["monthly_utilities"],
    "housing_situation": ["housing_situation"],
    "citizenship": ["citizenship_status"],
}

# answer_source (DB CHECK values) -> Fact.status vocabulary (matrix §3).
_SOURCE_TO_STATUS: dict[str, str] = {
    "applicant_input": "self_reported",
    "ocr_extraction": "extracted",
    "navigator_entry": "verified",
    "prefilled": "self_reported",
}

# Engine inputs the intake never collects at the granularity the engine needs.
# Each missing one forces `pending` (see matrix §3). member_ages is the hard
# blocker: HouseholdMember.age is required and no per-member ages are collected.
_ALWAYS_MISSING = ("member_ages", "member_citizenship", "assets")


@dataclass
class ResolvedFact:
    field: str
    value: str | None
    status: str  # verified | self_reported | extracted | missing
    source: str | None  # raw answer_source
    raw_key: str | None


@dataclass
class AdapterResult:
    """Outcome of mapping one packet's answers toward a Household.

    household is None when a required engine input is uncollected (today: always,
    pending per-member ages). needs lists the uncollected inputs. facts_snapshot
    captures what WAS collected, with provenance, frozen for the determination.
    """

    household: Any | None  # rules.interfaces.Household | None (lazy import in sweep)
    needs: list[str] = field(default_factory=list)
    facts_snapshot: dict[str, Any] = field(default_factory=dict)


def _resolve(rows_by_key: dict[str, dict[str, Any]], canonical: str) -> ResolvedFact:
    """Resolve one canonical field from the packet's answer rows."""
    for key in _FIELD_ALIASES[canonical]:
        row = rows_by_key.get(key)
        if row is None:
            continue
        # Current best value: navigator-confirmed wins, then applicant, then OCR.
        value = (
            row.get("navigator_confirmed_value")
            or row.get("applicant_answer")
            or row.get("original_ocr_value")
        )
        if value is None:
            continue
        source = row.get("answer_source")
        status = _SOURCE_TO_STATUS.get(source or "", "self_reported")
        return ResolvedFact(canonical, str(value), status, source, key)
    return ResolvedFact(canonical, None, "missing", None, None)


def build_household(answer_rows: list[dict[str, Any]], state_code: str) -> AdapterResult:
    """Map a packet's answers toward a Household; report what blocks a decision."""
    rows_by_key = {r["question_key"]: r for r in answer_rows if r.get("question_key")}
    facts = {name: _resolve(rows_by_key, name) for name in _FIELD_ALIASES}

    needs: list[str] = list(_ALWAYS_MISSING)
    if facts["household_size"].value is None:
        needs.append("household_size")
    if facts["monthly_income"].value is None:
        needs.append("income")
    if facts["monthly_rent"].value is None:
        needs.append("shelter_rent")
    if facts["monthly_utilities"].value is None:
        needs.append("shelter_utilities")

    # Provenance-preserving snapshot of everything we DID collect. Values are
    # stored here (this lands only in the service_role determination row); the
    # sweep's console summary never prints these.
    facts_snapshot: dict[str, Any] = {
        "state": state_code,
        "determinable": False,
        "blocking": (
            "no per-member ages collected — HouseholdMember.age is required, "
            "so no valid Household can be constructed"
        ),
        "facts": {
            name: {"value": rf.value, "status": rf.status, "source": rf.source}
            for name, rf in facts.items()
            if rf.value is not None
        },
    }

    # No per-member ages => cannot construct a HouseholdMember => no Household.
    # When intake begins collecting per-member rows, construct members/income/
    # expenses here and set household; the sweep will then call the engine.
    return AdapterResult(household=None, needs=needs, facts_snapshot=facts_snapshot)
