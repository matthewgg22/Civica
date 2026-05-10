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
