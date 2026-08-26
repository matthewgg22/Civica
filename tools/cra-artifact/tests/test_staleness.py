"""No artifact may be built on a superseded performance evaluation.

Busey is why this exists. Its artifact quoted the March 2022 finding that it had
"no branches, limited service facilities, or ATMs within low- and moderate-income
areas" in the Chicago MD. An October 14, 2025 evaluation rates its Service Test
High Satisfactory and its Investment Test Outstanding -- the bank fixed the
deficiency. Sending that letter would have quoted a resolved finding back at the
institution that resolved it.

It hid for two reasons worth keeping written down:

  1. Busey is a state member bank supervised by the FEDERAL RESERVE. The roster
     recorded it as FDIC, and the FDIC pull therefore never showed the new exam.
  2. CRAPES exposes EXM_CRA_PUB_DTE, the PUBLIC date, not the exam date.
     Comparing a roster exam date against a public date flags almost every bank
     as stale. The true exam date is encoded in the file id (..._YYMMDD.PDF).
"""
import datetime
import json
import sys
from pathlib import Path

TOOL_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(TOOL_ROOT))
from src import generate  # noqa: E402

INDEX = json.loads((TOOL_ROOT / "inputs/current_exams.json").read_text())
GRACE = datetime.timedelta(days=45)


def _d(s):
    return datetime.datetime.strptime(s, "%Y-%m-%d")


def _newest_known(bank):
    """Newest exam date recorded for this bank, by identifier -- never by name.

    Matching on a normalised name once matched FirstBank of Nashville to First
    Bank of Waverly, Iowa and raised a false staleness alarm. Identifiers only.
    """
    hits = []
    cert, rssd = str(bank.get("cert") or ""), str(bank.get("rssd") or "")
    if cert and cert in INDEX["by_cert"]:
        hits.append(INDEX["by_cert"][cert])
    if rssd and rssd in INDEX["by_rssd"]:
        hits.append(INDEX["by_rssd"][rssd])
    return max(hits, key=lambda h: h["exam_date"]) if hits else None


def test_no_sendable_bank_is_built_on_a_superseded_evaluation():
    banks, _a, _o = generate.load_inputs()
    stale = []
    for key, b in banks.items():
        if b.get("target_status") != "target":
            continue
        newest = _newest_known(b)
        if not newest or not b.get("pe_date"):
            continue
        if _d(newest["exam_date"]) > _d(b["pe_date"]) + GRACE:
            stale.append(f"{key}: artifact built on {b['pe_date']} but a "
                         f"{newest['exam_date']} exam exists ({newest['source']})")
    assert not stale, "superseded evaluations on the roster:\n  " + "\n  ".join(stale)


def test_busey_is_no_longer_pitched_on_a_resolved_finding():
    banks, _a, _o = generate.load_inputs()
    b = banks["busey_bank"]
    assert b["pe_date"] == "2025-10-14"
    assert b["svc_rating"] == "High Satisfactory"
    assert not b.get("pe_need_quote"), \
        "the 2022 LMI-access finding is RESOLVED; quoting it would be false"
    from src import archetype
    assert archetype.resolve(b) == "peer"


def test_the_regulator_on_record_is_the_one_that_actually_examines_the_bank():
    """Busey was recorded as FDIC while being a Fed state member bank, which is
    why its 2025 exam stayed invisible. Where an identifier resolves in the Fed
    index, the record must say so."""
    banks, _a, _o = generate.load_inputs()
    for key, b in banks.items():
        rssd = str(b.get("rssd") or "")
        if rssd and rssd in INDEX["by_rssd"] and b.get("target_status") == "target":
            assert b.get("regulator") in ("FED", "FRB"), \
                f"{key}: RSSD {rssd} is in the Federal Reserve index but regulator says {b.get('regulator')}"
