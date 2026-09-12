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
    """{puma5ce: {"unenrolled": float, "low_conf": bool}} — never numbers elsewhere."""
    _, _, csv_path = STATES[state]
    out = {}
    rows = list(csv.DictReader(csv_path.open()))
    if state == "CA":
        for r in rows:  # modeled: eligible_population x non_enrollment_rate
            key = r["puma_code"][-5:]
            un = float(r["est_eligible_population"]) * float(r["est_non_enrollment_rate"])
            out[key] = {"unenrolled": un,
                        "low_conf": int(float(r["n_sample_households"])) < MIN_SAMPLE}
    elif state == "FL":
        for r in rows:  # direct survey-weighted count of eligible non-recipients
            key = r["PUMA"].zfill(5)
            out[key] = {"unenrolled": float(r["no_snap_persons"]),
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


def regional_puma_svg(aa_counties, state, width=430, height=250):
    """Choropleth of AA PUMAs shaded by eligible-but-unenrolled count."""
    cfg = STATES[state]
    geoms = {f["properties"]["puma"]: f["geometry"]
             for f in json.loads(cfg[1].read_text())["features"]}
    need = load_puma_need(state)
    countyfps = _county_fips(state, aa_counties)
    aa_pumas = sorted(_pumas_for_counties(state, countyfps) & set(geoms))
    if not aa_pumas:
        raise PumaMapError(f"no AA PUMAs resolved for {aa_counties} ({state})")

    vals = [need[p]["unenrolled"] for p in aa_pumas
            if p in need and not need[p]["low_conf"]]
    lo, hi = (min(vals), max(vals)) if vals else (0.0, 1.0)

    aa_pts = [pt for p in aa_pumas for ring in _rings(geoms[p]) for pt in ring]
    lons, lats = [q[0] for q in aa_pts], [q[1] for q in aa_pts]
    cx, cy = (min(lons) + max(lons)) / 2, (min(lats) + max(lats)) / 2
    half_w = max((max(lons) - min(lons)) / 2, 0.05) * 1.04
    half_h = max((max(lats) - min(lats)) / 2, 0.05) * 1.04
    lat0 = math.radians(cy)
    minx = (cx - half_w) * math.cos(lat0)
    maxx = (cx + half_w) * math.cos(lat0)
    miny, maxy = cy - half_h, cy + half_h
    pad = 6
    s = min((width - 2 * pad) / (maxx - minx), (height - 2 * pad) / (maxy - miny))
    ox = (width - (maxx - minx) * s) / 2
    oy = (height - (maxy - miny) * s) / 2

    def project(lon, lat):
        x = ox + (lon * math.cos(lat0) - minx) * s
        y = oy + (maxy - lat) * s
        return f"{x:.1f},{y:.1f}"

    shapes = []
    for p in aa_pumas:
        e = need.get(p)
        fill = NO_DATA if (not e or e["low_conf"]) else _ramp_color(e["unenrolled"], lo, hi)
        cls = "nodata" if fill == NO_DATA else "puma"
        for ring in _rings(geoms[p]):
            path = " ".join(project(lon, lat) for lon, lat in ring)
            shapes.append(f'<polygon class="{cls}" data-puma="{p}" points="{path}" '
                          f'fill="{fill}" stroke="#ffffff" stroke-width="0.6"/>')
    return (f'<svg viewBox="0 0 {width} {height}" xmlns="http://www.w3.org/2000/svg" '
            f'role="img" aria-label="Eligible but unenrolled by sub-county PUMA footprint">'
            + "".join(shapes) + "</svg>")


def puma_visual_html(aa_counties, state, model_short):
    """Full right-column block: caption, choropleth, legend — or '' if unsupported."""
    if not available(state):
        return ""
    svg = regional_puma_svg(aa_counties, state)
    legend = (
        '<div class="geo-legend">'
        '<span class="geo-scale" aria-hidden="true"></span>'
        '<span class="geo-ends">fewer &rarr; more not enrolled</span>'
        '<span class="geo-nd"><i></i> small sample</span></div>'
    )
    return ('<div class="geomap">'
            '<div class="geo-cap">Not enrolled, by sub-county footprint (PUMA)</div>'
            f'{svg}{legend}'
            f'<div class="geo-src">Census PUMAs (~100k residents each), {model_short}; '
            f'shaded by eligible residents not enrolled &mdash; not census tracts.</div>'
            '</div>')
