#!/usr/bin/env python3
"""Build Mae's eCFR retrieval corpus from the official eCFR API.

Fetches the VERBATIM text of the federal SNAP regulation sections the Civica
eligibility engine cites (7 CFR Part 273 + 272.17 + 275.12), at a pinned issue
date, and writes a section/subsection-chunked JSON corpus that Mae retrieves
from per question. This is the faithful-source-text layer: Mae quotes from these
chunks instead of recalling regulation from memory.

The eCFR is U.S. Government work (public domain). Source of truth:
  https://www.ecfr.gov/api/versioner/v1/full/{DATE}/title-7.xml?chapter=II&part={N}

Re-run on each refresh (e.g. after a COLA/OBBBA rule change lands in eCFR):
  python3 build-ecfr-corpus.py
then commit the regenerated ecfr-snap.json. Bump ISSUE_DATE to the current
Title 7 latest_issue_date (GET /api/versioner/v1/titles.json).

Usage: python3 build-ecfr-corpus.py [output_path]
"""

import json
import re
import sys
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path

# Pinned eCFR Title 7 issue date. Post-OBBBA (P.L. 119-21) text. Bump on refresh.
ISSUE_DATE = "2026-06-02"
API = "https://www.ecfr.gov/api/versioner/v1/full/{date}/title-7.xml?chapter=II&part={part}"

# The federal SNAP sections Mae should be able to quote. Two groups:
#   • Eligibility + benefit (the engine's citation set) — determination/benefit math.
#   • Procedural (a CBO caseworker's daily work) — recert, appeals, reporting,
#     work registration, residency, SSN, notices, restoration of lost benefits.
# Keeping it to these named sections keeps the corpus tight + auditable.
TARGET_SECTIONS = {
    # Eligibility + benefit
    "273.1": 273, "273.2": 273, "273.4": 273, "273.5": 273, "273.8": 273,
    "273.9": 273, "273.10": 273, "273.11": 273, "273.16": 273, "273.24": 273,
    "272.1": 272,   # Use/disclosure of applicant info (confidentiality) — the "will ICE find out" question
    "272.17": 272, "275.12": 275,
    # Procedural (caseworker-facing)
    "273.3": 273,   # Residency
    "273.6": 273,   # Social security numbers
    "273.7": 273,   # Work provisions (registration / E&T / voluntary quit) — distinct from ABAWD 273.24
    "273.12": 273,  # Reporting requirements (change reporting)
    "273.13": 273,  # Notice of adverse action
    "273.14": 273,  # Recertification
    "273.15": 273,  # Fair hearings (appeals)
    "273.17": 273,  # Restoration of lost benefits
}

# Sections short enough to keep whole; longer subsections are split again to the
# numeric level ((a) → (a)(1), (a)(2), …) so retrieval can pull just the relevant
# paragraph (e.g. 273.9(d)(2) earned-income deduction, not all of 273.9(d)).
WHOLE_SECTION_MAX_CHARS = 3500
SUBSECTION_MAX_CHARS = 4000
ALPHA_RE = re.compile(r"^\(([a-z])\)\s")
NUM_RE = re.compile(r"^\((\d+)\)\s")


def fetch_part(part: int) -> bytes:
    url = API.format(date=ISSUE_DATE, part=part)
    print(f"  fetching part {part} …", file=sys.stderr)
    with urllib.request.urlopen(url, timeout=90) as r:
        return r.read()


def text_of(elem) -> str:
    """Flatten an element's text (drop inline tags, normalize whitespace)."""
    return re.sub(r"\s+", " ", "".join(elem.itertext())).strip()


def section_paragraphs(div8) -> list[str]:
    """Ordered paragraph texts within a section DIV8 (P + FP elements)."""
    out = []
    for p in div8.iter():
        if p.tag in ("P", "FP"):
            t = text_of(p)
            if t:
                out.append(t)
    return out


def group_sequential(paras: list[str], regex: re.Pattern, seq):
    """Group paragraphs by a strictly-sequential marker (a,b,c… or 1,2,3…).

    Only starts a new group on the EXPECTED next marker, so nested markers
    (roman numerals under a number, numbers under a letter) stay with their
    parent instead of being mis-promoted. Returns [(marker|None, [paras])];
    a leading None group holds any intro paragraphs before the first marker.
    """
    groups: list[tuple] = []
    cur, buf = None, []
    expected = next(seq)
    for p in paras:
        m = regex.match(p)
        if m and m.group(1) == str(expected):
            if buf:
                groups.append((cur, buf))
            cur, buf = m.group(1), [p]
            expected = next(seq)
        else:
            buf.append(p)
    if buf:
        groups.append((cur, buf))
    return groups


def _letters():
    c = ord("a")
    while c <= ord("z"):
        yield chr(c)
        c += 1


def _numbers():
    n = 1
    while True:
        yield n
        n += 1


def chunk_section(sec: str, heading: str, paras: list[str], url: str) -> list[dict]:
    """Whole-section chunk when short; else split by subsection, then by numeric
    sub-paragraph for any subsection still over the size budget."""
    base = {"section": sec, "heading": heading, "source_url": url, "effective_date": ISSUE_DATE}

    def make(letter, num, text):
        suffix = (f"({letter})" if letter else "") + (f"({num})" if num else "")
        sub = (letter or "") + (num if num else "")
        return {
            **base,
            "id": f"{sec}{('-' + sub) if sub else ''}",
            "citation": f"7 CFR {sec}{suffix}",
            "subsection": suffix or None,
            "text": "\n".join(text).strip(),
        }

    if len("\n".join(paras)) <= WHOLE_SECTION_MAX_CHARS:
        return [make(None, None, paras)]

    chunks: list[dict] = []
    for letter, lparas in group_sequential(paras, ALPHA_RE, _letters()):
        if letter is None or len("\n".join(lparas)) <= SUBSECTION_MAX_CHARS:
            chunks.append(make(letter, None, lparas))
            continue
        # Subsection too big — split it by its numeric sub-paragraphs.
        for num, nparas in group_sequential(lparas, NUM_RE, _numbers()):
            chunks.append(make(letter, num, nparas))
    return chunks


def main() -> None:
    out_path = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).parent / "ecfr-snap.json"
    parts: dict[int, ET.Element] = {}
    for part in sorted(set(TARGET_SECTIONS.values())):
        parts[part] = ET.fromstring(fetch_part(part))

    corpus: list[dict] = []
    for sec, part in TARGET_SECTIONS.items():
        root = parts[part]
        div8 = next((d for d in root.iter("DIV8") if d.get("N") == sec and d.get("TYPE") == "SECTION"), None)
        if div8 is None:
            print(f"  WARNING: section {sec} not found in part {part}", file=sys.stderr)
            continue
        head_el = div8.find("HEAD")
        heading = text_of(head_el) if head_el is not None else f"§ {sec}"
        url = f"https://www.ecfr.gov/current/title-7/section-{sec}"
        chunks = chunk_section(sec, heading, section_paragraphs(div8), url)
        corpus.extend(chunks)
        print(f"  {sec}: {len(chunks)} chunk(s)", file=sys.stderr)

    doc = {
        "_provenance": {
            "source": "eCFR (Electronic Code of Federal Regulations), U.S. Government work / public domain",
            "title": "Title 7 (Agriculture), Chapter II — SNAP",
            "issue_date": ISSUE_DATE,
            "note": "Verbatim section text the Civica engine cites. Post-OBBBA (P.L. 119-21). "
                    "Regenerate with build-ecfr-corpus.py and bump ISSUE_DATE on refresh.",
            "api": "https://www.ecfr.gov/api/versioner/v1",
        },
        "chunks": corpus,
    }
    out_path.write_text(json.dumps(doc, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"\nWrote {len(corpus)} chunks → {out_path}", file=sys.stderr)


if __name__ == "__main__":
    main()
