"""Per-institution configuration: the schema, validation, and scaffolding that
let you adapt the memo to any bank or financial institution.

An institution is defined by a small set of per-institution variables (FIELDS
below). Everything else on the page is either shared org copy (org.json),
state-driven copy (states.py, selected by the institution's `state`), or computed
from its assessment-area counties. So personalizing the memo for a new bank means
filling these fields — nothing in the template needs editing.

Add an institution one of two ways:
  * drop a JSON file at inputs/banks/<key>.json  (the filename is the key), or
  * add an object under "banks" in inputs/assessment_areas.json.

Then make sure its `state` is wired in states.py and its counties exist in that
state's metrics, and run:  python3 -m src.generate --bank <key>

Helpers:  --scaffold <key>  writes a ready-to-fill stub;  --validate <key>
reports exactly what (if anything) is missing;  --list  shows the whole roster
with each institution's readiness.
"""
from __future__ import annotations

from src import score, states

# Every per-institution field, in the order a scaffold should present them.
# (required, kind, what it controls on the page)
FIELDS: dict[str, tuple[bool, str, str]] = {
    "name": (True, "str",
             "Legal name, shown as the institution name throughout the memo."),
    "aa_counties": (True, "list",
                    "Delineated CRA assessment-area counties. Drive the need "
                    "model, the neighborhood bars, the regional map, and the "
                    "county list. Each county MUST exist in the state's metrics."),
    "ask_usd": (True, "int",
                "Pilot grant ask in whole dollars. Drives the headline ask, the "
                "tier ladder, and the projected quarterly funnel."),
    "pe_date": (True, "date",
                "Date (YYYY-MM-DD) of the institution's CRA Performance "
                "Evaluation; shown as the assessment-area citation date."),
    "regulator": (True, "enum",
                  "Prudential regulator: FDIC, OCC, or FRB. Selects the CRA rule "
                  "part (12 CFR 345 / 25 / 228) cited on pages 2 and 4."),
    "state": (False, "state",
              "Two-letter state code (default CA). Selects the SNAP fact base, "
              "participation rate, program name, and every state-driven "
              "paragraph. Must be wired in states.py."),
    "bank_specific_note": (False, "str",
                           "Optional per-institution 'fit' paragraph on page 2. "
                           "Omit to hide it entirely."),
    "aa_note": (False, "str", "Optional extra assessment-area note."),
    "verified": (False, "bool",
                 "Whether the assessment area and PE were verified against the "
                 "source. --send refuses to archive an unverified institution."),
    # provenance-only: kept with the record, never rendered on the page.
    "cert": (False, "str", "FDIC certificate / charter number (provenance only)."),
    "pe_url": (False, "str", "URL of the CRA PE PDF (provenance only)."),
    "bank_specific_note_source": (False, "str",
                                  "Source/provenance for the fit note (provenance only)."),
    "verify_note": (False, "str", "How the assessment area was verified (provenance only)."),
}

REQUIRED = [k for k, (req, *_) in FIELDS.items() if req]
REGULATORS = set(k for k in ("FDIC", "OCC", "FRB", "Federal Reserve"))


def validate(key: str, bank: dict) -> list[str]:
    """Return a list of human-readable problems for one institution.

    Empty list means the institution is ready to render. Checks: every required
    field present and well-typed, a recognized regulator, a wired state, and that
    every assessment-area county exists in that state's metrics."""
    problems: list[str] = []

    for f in REQUIRED:
        val = bank.get(f)
        if val is None or val == "" or val == []:
            problems.append(f"missing required field '{f}' — {FIELDS[f][2]}")

    # leftover scaffold placeholders (so a half-filled stub fails loudly)
    for f, val in bank.items():
        flat = val if isinstance(val, list) else [val]
        for item in flat:
            if isinstance(item, str) and ("TODO" in item or item == "YYYY-MM-DD"):
                problems.append(f"field '{f}' still has placeholder text ({item!r})")

    if "aa_counties" in bank and not isinstance(bank["aa_counties"], list):
        problems.append("'aa_counties' must be a list of county names")
    if "ask_usd" in bank and not isinstance(bank["ask_usd"], (int, float)):
        problems.append("'ask_usd' must be a number (whole dollars)")

    reg = bank.get("regulator")
    if reg and reg not in REGULATORS:
        problems.append(
            f"regulator {reg!r} not recognized — use one of {sorted(REGULATORS)}")

    state = bank.get("state", "CA")
    try:
        meta = states.state_meta(state)
    except states.UnsupportedStateError:
        problems.append(
            f"state {state!r} is not wired in states.py "
            f"(supported: {sorted(states.STATES)}); add it with a fact base first")
        return problems  # can't check counties without a state

    try:
        metrics = score.load_county_metrics(meta["metrics"])
    except Exception as e:  # noqa: BLE001 — surface any data-load failure plainly
        problems.append(f"could not load {state} metrics ({meta['metrics']}): {e}")
        return problems

    for c in bank.get("aa_counties", []) or []:
        if c not in metrics:
            problems.append(
                f"county {c!r} is not in the {state} metrics file "
                f"({meta['metrics'].name}) — check spelling or add the county")

    return problems


def scaffold(key: str, state: str = "CA") -> dict:
    """A ready-to-fill stub carrying every field with sensible placeholders."""
    return {
        "_README": (
            f"Fill every TODO below, then save this as inputs/banks/{key}.json "
            f"(or paste the object under \"banks\" in inputs/assessment_areas.json). "
            f"Required fields: {', '.join(REQUIRED)}. "
            f"Its state must be wired in states.py and its counties must exist in "
            f"that state's metrics. Check with: python3 -m src.generate --validate {key}"),
        "name": "TODO Full Legal Name",
        "aa_counties": ["TODO County"],
        "ask_usd": 25000,
        "pe_date": "YYYY-MM-DD",
        "regulator": "FDIC",
        "state": state,
        "bank_specific_note": "",
        "verified": False,
        "cert": "",
        "pe_url": "",
    }


def field_reference() -> str:
    """A plain-text table of every field for docs / --fields."""
    lines = [f"{'FIELD':26} {'REQ':4} {'KIND':7} DESCRIPTION",
             "-" * 96]
    for k, (req, kind, desc) in FIELDS.items():
        lines.append(f"{k:26} {'yes' if req else 'no':4} {kind:7} {desc}")
    return "\n".join(lines)
