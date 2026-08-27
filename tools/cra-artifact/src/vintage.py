"""The 2022-23 CRAPES vintage, and why no rating from it may be used.

Substantial Noncompliance appears at 0.1% in every other exam year and at 25.1%
in 2022-23. That alone is suspicious. What settles it: of the ELEVEN addressable
banks whose 2022-23 CRAPES record carries an SN component, ALL ELEVEN pair it
with a *Satisfactory* overall rating -- an impossible combination, because a
component that bad cannot sit under a satisfactory institution rating. The
corruption rate inside the window is 100%, not partial.

Six of those eleven are on our roster, and every one already carries the correct
value read from the PDF: Busey (SN -> High Satisfactory), CTBC, FirstBank,
Mechanics x2 and Meridian (all SN -> Low Satisfactory). The read-the-PDF rule
caught every instance, which is the strongest evidence we have that it earns its
cost.

Nothing here re-rates a bank. It marks which SOURCE values may not be trusted.
"""
from __future__ import annotations

import datetime
import re

WINDOW_START = datetime.date(2022, 1, 1)
WINDOW_END = datetime.date(2023, 12, 31)
SUSPECT = "substantial non"

# A component rating cannot be worse than the overall rating by this much.
_OK_OVERALL_WITH_SN = {"needs to improve", "substantial noncompliance",
                       "substantial non complianc"}


def exam_date_from_file_id(file_id: str | None) -> datetime.date | None:
    """CRAPES encodes the exam date in the file id: 2022/16450_220325.PDF."""
    m = re.search(r"_(\d{6})\.", file_id or "")
    if not m:
        return None
    try:
        return datetime.datetime.strptime(m.group(1), "%y%m%d").date()
    except ValueError:
        return None


def in_defective_window(exam_date: datetime.date | None) -> bool:
    return bool(exam_date and WINDOW_START <= exam_date <= WINDOW_END)


def is_internally_impossible(overall: str, investment: str, service: str) -> bool:
    """An SN component under a Satisfactory or Outstanding overall cannot happen."""
    comps = f"{investment or ''} {service or ''}".lower()
    if SUSPECT not in comps:
        return False
    return (overall or "").strip().lower() not in _OK_OVERALL_WITH_SN


def is_trustworthy(file_id: str, overall: str, investment: str, service: str) -> bool:
    """May these CRAPES component values be used as-is?

    False means read the PDF. It does not mean the bank is badly rated -- it
    means the source record cannot be believed either way.
    """
    d = exam_date_from_file_id(file_id)
    if not in_defective_window(d):
        return True
    return SUSPECT not in f"{investment or ''} {service or ''}".lower()


def audit(rows) -> dict:
    """rows: dicts with file_id / overall / inv / svc. Returns a summary."""
    total = tainted = suspect = impossible = 0
    for r in rows:
        total += 1
        d = exam_date_from_file_id(r.get("file_id"))
        if not in_defective_window(d):
            continue
        tainted += 1
        if SUSPECT in f"{r.get('inv','')} {r.get('svc','')}".lower():
            suspect += 1
            if is_internally_impossible(r.get("overall", ""), r.get("inv", ""), r.get("svc", "")):
                impossible += 1
    return {"total": total, "in_window": tainted,
            "sn_in_window": suspect, "internally_impossible": impossible}
