"""Shadow eligibility sweep tests.

Coverage:
  - adapter: provenance mapping (applicant/ocr/navigator -> status), value
    resolution (navigator-confirmed wins), alias keys, and the `needs` list
  - adapter: no per-member ages collected -> household is None (pending)
  - citation registry: exact + prefix + unmapped
  - engine -> determination/trace mapping (the FY2025 eligible path) carries
    citations on every fired rule
  - pending trace from needs; as_of parsing; determination-row shape
"""
from __future__ import annotations

from datetime import date
from decimal import Decimal

from backend.civic_api.snap.rules.citations import citation_for
from backend.civic_api.snap.rules.interfaces import (
    CitizenshipStatus,
    ExpenseFacts,
    Household,
    HouseholdMember,
    IncomeFacts,
    IncomeSource,
)
from backend.civic_api.snap.shadow import sweep
from backend.civic_api.snap.shadow.adapter import build_household


def _answer(key, source, *, applicant=None, ocr=None, navigator=None):
    return {
        "question_key": key,
        "answer_source": source,
        "applicant_answer": applicant,
        "original_ocr_value": ocr,
        "navigator_confirmed_value": navigator,
    }


# --- adapter -------------------------------------------------------------


def test_adapter_provenance_and_value_resolution():
    rows = [
        _answer("household_size", "applicant_input", applicant="3"),
        _answer("monthly_income", "ocr_extraction", ocr="1500"),
        _answer("monthly_rent", "navigator_entry", applicant="900", ocr="800", navigator="850"),
    ]
    facts = build_household(rows, "CA").facts_snapshot["facts"]
    assert facts["household_size"]["status"] == "self_reported"
    assert facts["monthly_income"]["status"] == "extracted"
    assert facts["monthly_rent"]["status"] == "verified"
    # navigator-confirmed value wins over applicant + OCR.
    assert facts["monthly_rent"]["value"] == "850"


def test_adapter_pending_when_ages_uncollected():
    result = build_household([_answer("household_size", "applicant_input", applicant="2")], "CA")
    assert result.household is None  # HouseholdMember.age is required, never collected
    assert result.facts_snapshot["determinable"] is False
    for need in ("member_ages", "member_citizenship", "assets"):
        assert need in result.needs
    # income / rent / utilities absent -> derived needs; household_size present -> not a need
    assert {"income", "shelter_rent", "shelter_utilities"} <= set(result.needs)
    assert "household_size" not in result.needs


def test_adapter_alias_keys_resolve():
    rows = [
        _answer("household_has_children", "applicant_input", applicant="yes"),
        _answer("monthly_gross_income", "applicant_input", applicant="1000"),
        _answer("monthly_rent_or_mortgage", "applicant_input", applicant="700"),
    ]
    result = build_household(rows, "MA")
    facts = result.facts_snapshot["facts"]
    assert "has_children" in facts and "monthly_income" in facts and "monthly_rent" in facts
    assert "income" not in result.needs and "shelter_rent" not in result.needs


# --- citation registry ---------------------------------------------------


def test_citation_registry():
    assert citation_for("citizenship") == "7 CFR 273.4"
    assert citation_for("student_rule") == "7 CFR 273.5"
    assert citation_for("gross_income_200pct_fpl_ca_mce") == "7 CFR 273.2(j)"
    assert citation_for("net_income_100pct_fpl") == "7 CFR 273.9(a)(2)"
    assert citation_for("asset_limit") == "7 CFR 273.8"
    # prefix fallback for an unenumerated variant
    assert citation_for("gross_income_999pct_xx") == "7 CFR 273.9(a)(1)"
    assert citation_for("totally_unknown_rule") is None


# --- engine -> determination / trace mapping -----------------------------


def _complete_household() -> Household:
    return Household(
        state="CA",
        members=[
            HouseholdMember(member_id="m1", age=40, is_applicant=True,
                            citizenship=CitizenshipStatus.US_CITIZEN)
        ],
        income=IncomeFacts(sources=[IncomeSource(member_id="m1", source_type="wages",
                                                 monthly_gross=Decimal("1200"), is_earned=True)]),
        expenses=ExpenseFacts(rent_or_mortgage=Decimal("900")),
    )


def test_engine_to_trace_mapping_is_eligible_and_cited():
    result = sweep._rules_for("CA", date(2025, 3, 15)).determine_eligibility(_complete_household())
    assert sweep._OUTCOME[result.status] == "eligible"
    assert sweep._allotment_cents(result) == 22200
    trace = sweep._trace_from_result(result)
    assert len(trace) == 5
    # every fired rule resolves to a regulatory authority
    assert all(row["citation_id"] for row in trace)
    by_rule = {row["rule_id"]: row["citation_id"] for row in trace}
    assert by_rule["citizenship"] == "7 CFR 273.4"
    assert by_rule["net_income_100pct_fpl"] == "7 CFR 273.9(a)(2)"


def test_trace_from_needs_documents_blockers():
    rows = sweep._trace_from_needs(["member_ages", "assets"])
    assert rows[0]["rule_id"] == "input.member_ages"
    assert rows[0]["predicate_result"] is False
    assert rows[0]["effect_applied"] == "blocks_determination"
    assert all(r["citation_id"] is None for r in rows)


def test_as_of_prefers_submitted_then_created():
    assert sweep._as_of({"submitted_at": "2026-03-15T10:00:00Z"}) == date(2026, 3, 15)
    assert sweep._as_of({"created_at": "2025-11-01T00:00:00+00:00"}) == date(2025, 11, 1)
    assert sweep._as_of(
        {"submitted_at": "2026-02-02T00:00:00Z", "created_at": "2025-01-01T00:00:00Z"}
    ) == date(2026, 2, 2)


def test_determination_row_shape():
    row = sweep._determination_row(
        packet_id="p1", state="CA", as_of=date(2025, 3, 15), outcome="pending",
        engine_version="x", needs=["member_ages"], facts_snapshot={"a": 1},
    )
    assert row["action_type"] == "initial"
    assert row["as_of_date"] == "2025-03-15"
    assert row["needs"] == ["member_ages"]
    assert row["allotment_cents"] is None
