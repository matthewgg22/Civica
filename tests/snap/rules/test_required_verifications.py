"""Required-verification surface tests.

This is the contract between the rules engine and the iOS document-upload
UI. The Ask-Selector pipeline stage also reads this list to know what
questions are still needed, so changes here have downstream effects.

Verification codes are stable identifiers — never rename. Add new ones,
mark old ones deprecated, but don't break iOS clients in older app
versions.
"""
from __future__ import annotations


class TestVerificationSurface:
    def test_photo_id_always_required(self, ma_rules, make_household):
        hh = make_household(wages=0)
        result = ma_rules.determine_eligibility(hh)
        codes = {rv.code for rv in result.required_verifications}
        assert "identity_photo_id" in codes

    def test_paystub_required_when_earned_income(self, ma_rules, make_household):
        hh = make_household(wages=1000)
        codes = {
            rv.code for rv in ma_rules.determine_eligibility(hh).required_verifications
        }
        assert "income_paystub" in codes

    def test_no_paystub_when_no_earned_income(self, ma_rules, make_household):
        hh = make_household(wages=0, unearned=500)
        codes = {
            rv.code for rv in ma_rules.determine_eligibility(hh).required_verifications
        }
        assert "income_paystub" not in codes

    def test_lease_required_when_rent(self, ma_rules, make_household):
        hh = make_household(wages=1000, rent=800)
        codes = {
            rv.code for rv in ma_rules.determine_eligibility(hh).required_verifications
        }
        assert "shelter_lease" in codes

    def test_no_lease_when_no_rent(self, ma_rules, make_household):
        hh = make_household(wages=1000, rent=0)
        codes = {
            rv.code for rv in ma_rules.determine_eligibility(hh).required_verifications
        }
        assert "shelter_lease" not in codes

    def test_utility_bill_when_actual_utilities_no_sua(self, ma_rules, make_household):
        from backend.civic_api.snap.rules.interfaces import SUATier

        hh = make_household(wages=1000, rent=500, utilities_actual=120, sua_tier=SUATier.NONE)
        codes = {
            rv.code for rv in ma_rules.determine_eligibility(hh).required_verifications
        }
        assert "utility_bill" in codes

    def test_no_utility_bill_when_using_sua(self, ma_rules, make_household):
        from backend.civic_api.snap.rules.interfaces import SUATier

        hh = make_household(
            wages=1000,
            rent=500,
            utilities_actual=120,
            sua_tier=SUATier.HEATING_COOLING,
        )
        codes = {
            rv.code for rv in ma_rules.determine_eligibility(hh).required_verifications
        }
        assert "utility_bill" not in codes

    def test_each_verification_is_bilingual(self, ma_rules, make_household):
        hh = make_household(wages=1000, rent=800)
        for rv in ma_rules.determine_eligibility(hh).required_verifications:
            assert rv.label_en, f"{rv.code} missing English label"
            assert rv.label_es, f"{rv.code} missing Spanish label"
            assert rv.explanation_en, f"{rv.code} missing English explanation"
            assert rv.explanation_es, f"{rv.code} missing Spanish explanation"

    def test_codes_are_stable_identifiers(self, ma_rules, make_household):
        # Codes must be ASCII snake_case so they can be persisted and
        # referenced by iOS client code without surprises.
        import re

        hh = make_household(wages=1000, rent=800, utilities_actual=120)
        for rv in ma_rules.determine_eligibility(hh).required_verifications:
            assert re.match(r"^[a-z][a-z0-9_]*$", rv.code), f"bad code: {rv.code!r}"

    # ------------------------------------------------------------------
    # Expedited postponement (7 CFR 273.2(i)(4))
    # ------------------------------------------------------------------

    def test_identity_never_postponable_even_for_expedited(
        self, federal_rules, make_household
    ):
        # Photo ID is always required upfront; it must never be marked
        # postponable even when the household qualifies for expedited service.
        hh = make_household(wages=100, countable_resources=50)
        result = federal_rules.determine_eligibility(hh)
        assert result.expedited_eligible is True
        photo_id = next(
            rv for rv in result.required_verifications if rv.code == "identity_photo_id"
        )
        assert photo_id.can_be_postponed_for_expedited is False

    def test_non_identity_verifications_postponable_when_expedited(
        self, federal_rules, make_household
    ):
        # Path 1 expedited household with earned income + rent: paystub and
        # lease must be marked postponable; identity must not be.
        hh = make_household(wages=100, countable_resources=50, rent=500)
        result = federal_rules.determine_eligibility(hh)
        assert result.expedited_eligible is True
        for rv in result.required_verifications:
            if rv.code == "identity_photo_id":
                assert rv.can_be_postponed_for_expedited is False
            else:
                assert rv.can_be_postponed_for_expedited is True, (
                    f"{rv.code} should be postponable for expedited household"
                )

    def test_non_identity_verifications_not_postponable_when_not_expedited(
        self, federal_rules, make_household
    ):
        # Standard (non-expedited) household: no verifications should be
        # marked postponable.
        hh = make_household(wages=1200, countable_resources=200, rent=500)
        result = federal_rules.determine_eligibility(hh)
        assert result.expedited_eligible is False
        for rv in result.required_verifications:
            assert rv.can_be_postponed_for_expedited is False, (
                f"{rv.code} should not be postponable for non-expedited household"
            )

    def test_path2_expedited_uses_sua_for_shelter_comparison(
        self, ma_rules, make_household
    ):
        # MA has an SUA override. A household whose combined income + liquid
        # resources are below shelter-with-SUA but above shelter-with-actuals
        # must still qualify for expedited via Path 2 — confirming the engine
        # uses _effective_utility_cost (SUA), not utilities_actual.
        from backend.civic_api.snap.rules.interfaces import SUATier

        # MA HEATING_COOLING SUA is $589 (FY25). Set actual utilities to a
        # low value so the test is only satisfied when SUA is substituted.
        # Rent $300 + SUA $589 = $889 shelter. Income $400 + liquid $400 = $800.
        # $800 < $889 → expedited via Path 2 with SUA.
        # $800 >= $300 + $50 ($350 actuals) → would NOT qualify without SUA.
        hh = make_household(
            wages=400,
            countable_resources=400,
            rent=300,
            utilities_actual=50,
            sua_tier=SUATier.HEATING_COOLING,
        )
        result = ma_rules.determine_eligibility(hh)
        assert result.expedited_eligible is True, (
            "Path 2 must use SUA when household elects it (7 CFR 273.2(i)(1)(iii))"
        )
