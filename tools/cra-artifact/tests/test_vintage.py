"""The defective CRAPES window must never be believed, and never silently."""
import csv
import sys
from pathlib import Path

TOOL = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(TOOL))
from src import generate, vintage  # noqa: E402

UNIVERSE = (TOOL.parents[1] / "data-ops/analysis/cra-universe-2026"
            / "fdic_universe_capacity_first_2026.csv")


def test_every_sn_rating_in_the_window_is_internally_impossible():
    """If even one were coherent the window would be merely suspect. All are
    impossible, which is what licenses discarding the whole window."""
    if not UNIVERSE.exists():
        return
    rows = list(csv.DictReader(UNIVERSE.open()))
    a = vintage.audit(rows)
    assert a["sn_in_window"] > 0, "fixture no longer contains the defect"
    assert a["internally_impossible"] == a["sn_in_window"], (
        f"{a['sn_in_window'] - a['internally_impossible']} SN records in the "
        f"2022-23 window are internally coherent — the blanket distrust needs revisiting")


def test_a_window_sn_value_is_not_trustworthy():
    assert not vintage.is_trustworthy("2022/16450_220325.PDF", "Satisfactory",
                                      "", "Substantial Non Complianc")
    # ...but a clean rating from the same window is fine, and so is any rating
    # from outside it.
    assert vintage.is_trustworthy("2022/16450_220325.PDF", "Satisfactory",
                                  "High Satisfactory", "Low Satisfactory")
    assert vintage.is_trustworthy("2025/110_251201.PDF", "Satisfactory",
                                  "Outstanding", "Substantial Non Complianc")


def test_no_roster_rating_was_taken_from_a_corrupt_record():
    """Six roster banks have a corrupt CRAPES record. Each must carry the value
    read from the PDF instead -- that is the whole point of the read rule."""
    if not UNIVERSE.exists():
        return
    banks, _a, _o = generate.load_inputs()
    universe = {r["cert"]: r for r in csv.DictReader(UNIVERSE.open())}
    for key, b in banks.items():
        rec = universe.get(str(b.get("cert") or ""))
        if not rec:
            continue
        if vintage.is_trustworthy(rec.get("file_id", ""), rec.get("overall", ""),
                                  rec.get("inv", ""), rec.get("svc", "")):
            continue
        ours = (b.get("svc_rating") or "").lower()
        assert "substantial non" not in ours, (
            f"{key}: carries the corrupt CRAPES Substantial Noncompliance value")
        assert b.get("verified") or b.get("pe_mined"), (
            f"{key}: has a corrupt source record and no PE read to override it")
