"""Documented-access evidence callout (CDSS ME reviews) for Page 1.

Intentionally separate from score.py: this module produces PRESENTATION ONLY
and never participates in need/funnel/score math. It reads verbatim examiner
findings from inputs/county_access_evidence.json and renders a compact Page-1
strip for the bank's assessment-area counties.

Integrity contract (issue #1129):
- Quote-only: text is rendered verbatim from the JSON, never paraphrased here.
- Silent when absent: a county with no entry (and every non-CA bank) renders
  the empty string — never a fabricated barrier.
- No math: nothing in this module returns or mutates a numeric figure.
"""
import html
import json
from pathlib import Path

TOOL_ROOT = Path(__file__).resolve().parents[1]
EVIDENCE = TOOL_ROOT / "inputs" / "county_access_evidence.json"

# Only CA counties are covered by the CDSS ME production; other states stay silent.
SUPPORTED_STATES = {"CA"}
MAX_ENTRIES = 2  # keeps Page 1 to five pages; strongest findings first (lowest sev)


def load(path=EVIDENCE):
    return json.loads(Path(path).read_text()).get("counties", {})


def select(aa_counties, state="CA", counties=None, max_entries=MAX_ENTRIES):
    """The AA counties that have a verified entry, strongest (lowest sev) first.

    Returns a list of (county, entry) tuples — never numbers. Empty when the
    state is unsupported or no AA county has an entry.
    """
    if state not in SUPPORTED_STATES:
        return []
    if counties is None:
        counties = load()
    hits = [(c, counties[c]) for c in aa_counties
            if c in counties and counties[c].get("verified")]
    hits.sort(key=lambda t: (t[1].get("sev", 9), t[0]))
    return hits[:max_entries]


def evidence_html(aa_counties, state="CA", counties=None, max_entries=MAX_ENTRIES):
    """Compact Page-1 HTML block, or '' when there is nothing verified to show."""
    hits = select(aa_counties, state=state, counties=counties, max_entries=max_entries)
    if not hits:
        return ""
    items = []
    for county, e in hits:
        note = f" {html.escape(e['note'])}" if e.get("note") else ""
        items.append(
            f'<li><b>{html.escape(county)} County</b> &mdash; '
            f'&ldquo;{html.escape(e["quote"])}&rdquo;{note} '
            f'<span class="me-src">{html.escape(e["source"])}</span></li>'
        )
    return (
        '<div class="me-evidence">'
        '<div class="me-label">Documented in your assessment area · CDSS CalFresh reviews</div>'
        f'<ul>{"".join(items)}</ul>'
        '<div class="me-frame">The state’s own county reviews, verbatim — offered as '
        'performance context on documented need, not a representation about outcomes.</div>'
        '</div>'
    )
