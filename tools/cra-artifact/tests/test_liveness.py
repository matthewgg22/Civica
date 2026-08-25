"""Liveness — enforced offline against the stored answer."""
import datetime
import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from src import generate, liveness
from src.liveness import DeadInstitutionError, assert_alive

STALE_AFTER_DAYS = 180


def test_every_bank_is_a_live_institution():
    """CRAPES reported all 18,902 records active, Signature Bank included -- it
    failed in March 2023. Six closed institutions surfaced in the 2022-vintage
    work, two of them large and recent enough to look plausible in a pitch list."""
    banks, _a, _o = generate.load_inputs()
    for key, bank in banks.items():
        assert_alive(key, bank)


def test_liveness_was_actually_checked_and_is_not_stale():
    banks, _a, _o = generate.load_inputs()
    today = datetime.date.today()
    for key, bank in banks.items():
        checked = bank.get("active_checked")
        assert checked, f"{key}: no liveness check recorded"
        age = (today - datetime.date.fromisoformat(checked)).days
        assert age <= STALE_AFTER_DAYS, (
            f"{key}: liveness last checked {age} days ago — re-run "
            "`python3 -m src.liveness --write`")


def test_a_closed_bank_is_rejected_even_if_flagged_active():
    """Berkshire Bank's record would have read active right up to 2025-09-02.
    An end date is disqualifying on its own."""
    with pytest.raises(DeadInstitutionError):
        assert_alive("berkshire", {"active": True, "active_checked": "2026-08-25",
                                   "active_end_date": "09/02/2025"})


def test_an_unchecked_bank_is_rejected_rather_than_assumed_alive():
    with pytest.raises(DeadInstitutionError):
        assert_alive("unchecked", {})
    with pytest.raises(DeadInstitutionError):
        assert_alive("explicitly_dead", {"active": False, "active_checked": "2026-08-25"})


def test_the_far_future_sentinel_is_not_read_as_a_closure_date():
    """BankFind writes 12/31/9999 rather than null for an open institution.
    Reading that literally would mark every live bank dead."""
    assert liveness.parse_end_date("12/31/9999") is None
    assert liveness.parse_end_date(None) is None
    assert liveness.parse_end_date("") is None
    assert liveness.parse_end_date("09/02/2025") == "09/02/2025"


def test_send_refuses_a_bank_that_is_not_verified_alive():
    """The whole point: a dead bank must never reach a send copy."""
    banks, _a, _o = generate.load_inputs()
    live = [k for k, b in banks.items() if b.get("active") is True]
    assert live, "no bank passes the liveness gate"
    for key, bank in banks.items():
        assert "active" in bank, f"{key}: liveness never recorded"


def test_send_actually_refuses_a_dead_bank_end_to_end(monkeypatch):
    """Exercises the real --send path, not just assert_alive.

    Modelled on test_send_refuses_unverified_bank: a guard test must drive the
    code the operator drives, and must not depend on real data happening to be
    in the failing state. Berkshire Bank ($11.7B) closed on 2025-09-02 and would
    otherwise have looked entirely sendable."""
    banks, assumptions, org = generate.load_inputs()
    fake = dict(banks["busey_bank"])
    fake["active"] = True                       # still flagged live...
    fake["active_end_date"] = "09/02/2025"      # ...but it has a closure date
    patched = dict(banks); patched["__dead_fixture__"] = fake
    monkeypatch.setattr(generate, "load_inputs", lambda: (patched, assumptions, org))
    with pytest.raises(DeadInstitutionError):
        generate.main(["--bank", "__dead_fixture__", "--send"])


def test_send_refuses_a_bank_whose_liveness_was_never_checked(monkeypatch):
    banks, assumptions, org = generate.load_inputs()
    fake = dict(banks["busey_bank"])
    fake.pop("active", None); fake.pop("active_checked", None)
    patched = dict(banks); patched["__unchecked_fixture__"] = fake
    monkeypatch.setattr(generate, "load_inputs", lambda: (patched, assumptions, org))
    with pytest.raises(DeadInstitutionError):
        generate.main(["--bank", "__unchecked_fixture__", "--send"])
