"""Sub-county unmet-need choropleth (PUMA level) as inline SVG.

More specific than the county bars: a PUMA is a ~100k-person Census "footprint,"
so this shows WHERE inside the assessment area the eligible-but-unenrolled
population concentrates — at the need model's native resolution (the county
figures are aggregated up from these very PUMAs).

Honesty rules baked in:
- PUMAs are sub-county FOOTPRINTS, never "tracts" — the label says so.
- CA need is modeled (CV AUC 0.80); FL is a direct survey-weighted count. Each
  state's own columns are used; nothing is invented.
- Low-sample PUMAs render gray (like the county no-data treatment), never as
  low need.
- Presentation only: this reads the same PUMA data the state figures use and
  never changes a headline number.

Supported states must have BOTH a PUMA need CSV and PUMA geometry; every other
state falls back to the county-bar breakdown in generate.py.
"""
import csv
import json
import math
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
TOOL_ROOT = Path(__file__).resolve().parents[1]
US_COUNTIES = REPO_ROOT / "data-ops/reference/us_counties_20m.geojson"
TRACT_TO_PUMA = REPO_ROOT / "data-ops/reference/2020_tract_to_puma.txt"

ACCENT = "#C0553B"
# Lightness-ordered terracotta ramp, low -> high need (grayscale-print safe).
RAMP = ["#F3D9CF", "#E3AE9A", "#D08466", "#B9613F", "#8E3A26"]
NO_DATA = "#ECEAE6"
MIN_SAMPLE = 30  # PUMAs thinner than this render gray, not as low need

# state -> (fips, puma geojson, need csv, need-loader key)
STATES = {
    "CA": ("06", REPO_ROOT / "data-ops/reference/ca_pumas_2020_500k.geojson",
           REPO_ROOT / "data-ops/sample/ca-snap-gap/ca_snap_gap_puma.csv"),
    "FL": ("12", REPO_ROOT / "data-ops/reference/fl_pumas_2020_500k.geojson",
           REPO_ROOT / "data-ops/sample/fl-snap-gap/fl_snap_gap_puma.csv"),
}


def available(state: str) -> bool:
    cfg = STATES.get(state)
    return bool(cfg) and cfg[1].exists() and cfg[2].exists()


def load_puma_need(state: str) -> dict:
    """{puma5ce: {"unenrolled", "eligible", "low_conf"}} — never numbers elsewhere.

    `eligible` is the model/survey eligible-person count for the PUMA; the ranked
    bar chart reports eligible x (1 - USDA participation rate) so the per-
    neighborhood figures use the same reconciliation as the page-1 headline.
    """
    _, _, csv_path = STATES[state]
    out = {}
    rows = list(csv.DictReader(csv_path.open()))
    if state == "CA":
        for r in rows:  # modeled: eligible_population x non_enrollment_rate
            key = r["puma_code"][-5:]
            elig = float(r["est_eligible_population"])
            un = elig * float(r["est_non_enrollment_rate"])
            out[key] = {"unenrolled": un, "eligible": elig,
                        "low_conf": int(float(r["n_sample_households"])) < MIN_SAMPLE}
    elif state == "FL":
        for r in rows:  # direct survey-weighted count of eligible non-recipients
            key = r["PUMA"].zfill(5)
            out[key] = {"unenrolled": float(r["no_snap_persons"]),
                        "eligible": float(r["eligible_persons"]),
                        "low_conf": int(float(r["n_sample"])) < MIN_SAMPLE}
    return out


def _county_fips(state: str, aa_counties) -> set:
    """AA county NAMES -> 3-digit county FIPS, via the national county geojson."""
    fips = STATES[state][0]
    g = json.loads(US_COUNTIES.read_text())
    name_to_cf = {f["properties"]["NAME"]: f.get("id", "")[2:5]
                  for f in g["features"] if f.get("id", "").startswith(fips)}
    return {name_to_cf[c] for c in aa_counties if c in name_to_cf}


def _pumas_for_counties(state: str, countyfps: set) -> set:
    """PUMA5CE codes whose tracts fall in the given counties (2020 crosswalk)."""
    fips = STATES[state][0]
    pumas = set()
    with TRACT_TO_PUMA.open(encoding="utf-8-sig") as fh:  # header carries a BOM
        for r in csv.DictReader(fh):
            if r["STATEFP"] == fips and r["COUNTYFP"] in countyfps:
                pumas.add(r["PUMA5CE"])
    return pumas


def _rings(geom):
    if geom["type"] == "Polygon":
        return geom["coordinates"]
    return [ring for poly in geom["coordinates"] for ring in poly]


def _ramp_color(v, lo, hi):
    if hi == lo:
        return RAMP[len(RAMP) // 2]
    i = int((v - lo) / (hi - lo) * (len(RAMP) - 1) + 0.5)
    return RAMP[max(0, min(len(RAMP) - 1, i))]


class PumaMapError(Exception):
    pass


INK = "#232220"             # bar labels (matches the artifact ink token)
MUTED = "#54524B"           # bar value annotations
LOC_OFF = "#E9E7E2"         # non-AA counties in the small locator
LOC_STROKE = "#ffffff"      # hairlines between locator counties


def _state_counties(state):
    """{county NAME: geometry} for the state, from the national county file."""
    fips = STATES[state][0]
    g = json.loads(US_COUNTIES.read_text())
    return {f["properties"]["NAME"]: f["geometry"]
            for f in g["features"] if f.get("id", "").startswith(fips)}


def _bbox(geom):
    pts = [pt for ring in _rings(geom) for pt in ring]
    xs, ys = [p[0] for p in pts], [p[1] for p in pts]
    return min(xs), min(ys), max(xs), max(ys)


def _esc(s: str) -> str:
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def _puma_names(state) -> dict:
    """{puma5ce: human-readable Census PUMA name} from the geojson."""
    return {f["properties"]["puma"]: f["properties"].get("name", "")
            for f in json.loads(STATES[state][1].read_text())["features"]}


def _short_name(raw: str) -> str:
    """Census PUMA name -> a compact, recognizable neighborhood label.

    Census PUMA names are verbose ("Los Angeles County (Central)--LA City (East
    Central/Central City) PUMA"). Keep the specific place (the part after "--"),
    drop the redundant "City"/"County" scaffolding, and abbreviate Los Angeles.
    """
    s = raw.replace(" PUMA", "").strip()
    if "--" in s:
        s = s.split("--", 1)[1].strip()          # the specific place
    s = (s.replace("Los Angeles", "LA")
          .replace(" Cities", "").replace(" City", "")
          .replace(" County", " Co.").strip())
    return s if len(s) <= 34 else s[:33] + "…"


def ranked_bar_svg(aa_counties, state, reconcile_rate=None,
                   width=430, height=196, top_n=8):
    """Top-N assessment-area PUMAs by eligible-but-unenrolled residents, as a
    ranked horizontal bar chart named by neighborhood.

    Values use eligible x (1 - USDA participation rate) so they match the
    reconciled page-1 headline; ranking by that value surfaces the neighborhoods
    carrying the most unmet need. Replaces the earlier choropleth, which
    distorted by land area (empty desert counties dominated the eye).
    """
    need = load_puma_need(state)
    names = _puma_names(state)
    aa = _pumas_for_counties(state, _county_fips(state, aa_counties)) & set(names)
    factor = (1 - reconcile_rate) if reconcile_rate is not None else None
    rows = []
    for p in aa:
        e = need.get(p)
        if not e:
            continue
        val = e["eligible"] * factor if factor is not None else e["unenrolled"]
        if val > 0:
            rows.append((names[p], val))
    rows.sort(key=lambda t: t[1], reverse=True)
    rows = rows[:top_n]
    if not rows:
        raise PumaMapError(f"no AA PUMAs resolved for {aa_counties} ({state})")

    maxv = max(v for _, v in rows)
    pad_t, pad_b, pad_r = 6, 4, 4
    row_h = (height - pad_t - pad_b) / len(rows)
    bar_h = min(row_h * 0.46, 12)
    bar_x = width * 0.52
    bar_max = width - bar_x - pad_r - 42   # room for the value label at the end
    out = []
    for i, (nm, v) in enumerate(rows):
        cy = pad_t + i * row_h + row_h / 2
        bw = max(1.5, bar_max * (v / maxv))
        out.append(
            f'<text x="0" y="{cy + 2.4:.1f}" font-size="7.6" fill="{INK}" '
            f"font-family=\"'Be Vietnam Pro',sans-serif\">{_esc(_short_name(nm))}</text>")
        out.append(
            f'<rect x="{bar_x:.1f}" y="{cy - bar_h / 2:.1f}" width="{bw:.1f}" '
            f'height="{bar_h:.1f}" rx="1.5" fill="{ACCENT}" class="puma-bar"/>')
        out.append(
            f'<text x="{bar_x + bw + 4:.1f}" y="{cy + 2.4:.1f}" font-size="7" '
            f'fill="{MUTED}" font-family="\'Be Vietnam Pro\',sans-serif">'
            f'{_fmt_k(v)}</text>')
    return (f'<svg viewBox="0 0 {width} {height}" xmlns="http://www.w3.org/2000/svg" '
            f'role="img" aria-label="Top {len(rows)} neighborhoods by eligible '
            f'but not enrolled">' + "".join(out) + "</svg>")


def locator_svg(aa_counties, state, width=118, height=82):
    """Small state locator: the assessment-area counties in accent, the rest of
    the state in a neutral fill, so the ranked bars keep a geographic anchor."""
    counties = _state_counties(state)
    pts = [pt for g in counties.values() for ring in _rings(g) for pt in ring]
    xs, ys = [p[0] for p in pts], [p[1] for p in pts]
    minx, maxx, miny, maxy = min(xs), max(xs), min(ys), max(ys)
    lat0 = math.radians((miny + maxy) / 2)
    W = (maxx - minx) * math.cos(lat0)
    H = maxy - miny
    pad = 3
    s = min((width - 2 * pad) / W, (height - 2 * pad) / H)
    ox = (width - W * s) / 2
    oy = (height - H * s) / 2

    def proj(lon, lat):
        return f"{ox + (lon * math.cos(lat0) - minx * math.cos(lat0)) * s:.1f}," \
               f"{oy + (maxy - lat) * s:.1f}"

    aaset = set(aa_counties)
    shapes = []
    for nm, g in counties.items():
        fill = ACCENT if nm in aaset else LOC_OFF
        for ring in _rings(g):
            shapes.append(f'<polygon points="{" ".join(proj(x, y) for x, y in ring)}" '
                          f'fill="{fill}" stroke="{LOC_STROKE}" stroke-width="0.35"/>')
    return (f'<svg viewBox="0 0 {width} {height}" xmlns="http://www.w3.org/2000/svg" '
            f'role="img" aria-label="Assessment area within the state">'
            + "".join(shapes) + "</svg>")


def puma_visual_html(aa_counties, state, model_short, reconcile_rate=None):
    """Right-column visual: a ranked bar chart of the highest-need neighborhoods
    (PUMAs) plus a small state locator — or '' if the state is unsupported."""
    if not available(state):
        return ""
    bars = ranked_bar_svg(aa_counties, state, reconcile_rate=reconcile_rate)
    loc = locator_svg(aa_counties, state)
    return ('<div class="geomap">'
            '<div class="geo-cap">Eligible but not enrolled &mdash; top neighborhoods</div>'
            f'<div class="geo-bars">{bars}</div>'
            f'<div class="geo-loc">{loc}<span>assessment area within the state</span></div>'
            '<div class="geo-src">Each bar is a Census PUMA (~100k residents), '
            "at USDA's participation rate.</div>"
            '</div>')


def _fmt_k(v):
    v = round(v)
    if v >= 10000:
        return f"{v/1000:.0f}k"
    if v >= 1000:
        return f"{v/1000:.1f}k"
    return f"{v:,.0f}"


