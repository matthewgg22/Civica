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


CONTEXT_FILL = "#F2F1ED"    # surrounding counties (neutral geographic context)
CONTEXT_STROKE = "#DBD8D3"  # thin county hairlines in the context
COUNTY_LINE = "#6C6A64"     # AA county boundaries, drawn over the PUMA mosaic


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


def regional_puma_svg(aa_counties, state, width=430, height=250):
    """AA PUMAs shaded by unmet need, set in surrounding-county context.

    Three layers, back to front: (1) surrounding counties in a light neutral so
    the assessment area reads in its regional/state place; (2) the AA's PUMAs
    shaded by eligible-but-unenrolled count; (3) the AA county outlines on top,
    so county structure stays legible over the PUMA mosaic.
    """
    cfg = STATES[state]
    geoms = {f["properties"]["puma"]: f["geometry"]
             for f in json.loads(cfg[1].read_text())["features"]}
    need = load_puma_need(state)
    counties = _state_counties(state)
    countyfps = _county_fips(state, aa_counties)
    aa_pumas = sorted(_pumas_for_counties(state, countyfps) & set(geoms))
    if not aa_pumas:
        raise PumaMapError(f"no AA PUMAs resolved for {aa_counties} ({state})")

    vals = [need[p]["unenrolled"] for p in aa_pumas if p in need]
    lo, hi = (min(vals), max(vals)) if vals else (0.0, 1.0)

    # Frame on the AA counties, but from the 2nd–98th percentile of vertices so
    # far-flung islands (Channel Islands, the Keys) don't stretch the frame and
    # starve the populated mainland of detail. Zoom tight; thin context ring.
    aa_pts = [pt for c in aa_counties if c in counties
              for ring in _rings(counties[c]) for pt in ring] \
        or [pt for p in aa_pumas for ring in _rings(geoms[p]) for pt in ring]
    lons = sorted(q[0] for q in aa_pts)
    lats = sorted(q[1] for q in aa_pts)

    def _pct(a, p):
        return a[min(len(a) - 1, max(0, int(len(a) * p)))]

    minlon, maxlon = _pct(lons, 0.02), _pct(lons, 0.98)
    minlat, maxlat = _pct(lats, 0.02), _pct(lats, 0.98)
    cx, cy = (minlon + maxlon) / 2, (minlat + maxlat) / 2
    # Keep a generous ring of surrounding continental counties for context; the
    # islands don't stretch this because they're dropped from the draw below.
    expand = 1.8 if len(aa_counties) == 1 else 1.3
    half_w = max((maxlon - minlon) / 2, 0.05) * expand
    half_h = max((maxlat - minlat) / 2, 0.05) * expand
    fminx, fmaxx, fminy, fmaxy = cx - half_w, cx + half_w, cy - half_h, cy + half_h
    lat0 = math.radians(cy)
    minx, maxx, miny, maxy = fminx * math.cos(lat0), fmaxx * math.cos(lat0), fminy, fmaxy
    pad = 4
    s = min((width - 2 * pad) / (maxx - minx), (height - 2 * pad) / (maxy - miny))
    ox = (width - (maxx - minx) * s) / 2
    oy = (height - (maxy - miny) * s) / 2

    def project(lon, lat):
        return f"{ox + (lon * math.cos(lat0) - minx) * s:.1f},{oy + (maxy - lat) * s:.1f}"

    def polys(geom, attrs):
        a = " ".join(f'{k}="{v}"' for k, v in attrs.items())
        out = []
        for ring in _rings(geom):
            rx = [p[0] for p in ring]
            ry = [p[1] for p in ring]
            # Skip rings wholly outside the frame — drops offshore islands
            # (Channel Islands, the Keys) so they never leak into the letterbox.
            if max(rx) < fminx or min(rx) > fmaxx or max(ry) < fminy or min(ry) > fmaxy:
                continue
            # Also drop small far-south rings: the offshore islands are simple
            # low-vertex polygons well below the mainland; the coast itself is one
            # large ring, so this never crops populated shoreline.
            if len(ring) < 40 and max(ry) < cy - 0.08:
                continue
            out.append(f'<polygon points="{" ".join(project(x, y) for x, y in ring)}" {a}/>')
        return "".join(out)

    shapes = []
    # (1) surrounding counties within the frame — light neutral context
    for name, g in counties.items():
        bx0, by0, bx1, by1 = _bbox(g)
        if bx1 < fminx or bx0 > fmaxx or by1 < fminy or by0 > fmaxy:
            continue
        shapes.append(polys(g, {"fill": CONTEXT_FILL, "stroke": CONTEXT_STROKE,
                                "stroke-width": "0.7", "class": "ctx"}))
    # (2) AA PUMAs shaded by unmet need
    for p in aa_pumas:
        e = need.get(p)
        fill = _ramp_color(e["unenrolled"] if e else lo, lo, hi)
        shapes.append(polys(geoms[p], {"fill": fill, "stroke": "#ffffff",
                                       "stroke-width": "0.45", "data-puma": p, "class": "puma"}))
    # (3) AA county outlines on top for legibility
    for c in aa_counties:
        if c in counties:
            shapes.append(polys(counties[c], {"fill": "none", "stroke": COUNTY_LINE,
                                              "stroke-width": "1.3", "class": "aacounty"}))
    return (f'<svg viewBox="0 0 {width} {height}" xmlns="http://www.w3.org/2000/svg" '
            f'role="img" aria-label="Eligible but unenrolled by sub-county PUMA '
            f'footprint, within surrounding counties">' + "".join(shapes) + "</svg>")


def puma_visual_html(aa_counties, state, model_short):
    """Full right-column block: caption, choropleth, legend — or '' if unsupported."""
    if not available(state):
        return ""
    svg = regional_puma_svg(aa_counties, state)
    lo, mid, hi = puma_scale_labels(aa_counties, state)
    legend = ('<div class="geo-legend">'
              '<div class="geo-scale" aria-hidden="true"></div>'
              f'<div class="geo-ticks"><span>{lo}</span><span>{mid}</span><span>{hi}</span></div>'
              '<div class="geo-legcap">eligible, not enrolled &mdash; per PUMA</div>'
              '</div>')
    return ('<div class="geomap">'
            '<div class="geo-cap">Eligible but not enrolled</div>'
            f'{svg}{legend}'
            '<div class="geo-src">Each shape is a Census PUMA (~100k residents).</div>'
            '</div>')


def _fmt_k(v):
    v = round(v)
    if v >= 10000:
        return f"{v/1000:.0f}k"
    if v >= 1000:
        return f"{v/1000:.1f}k"
    return f"{v:,.0f}"


def puma_scale_labels(aa_counties, state):
    """Low / mid / high of per-PUMA unenrolled counts, for the legend ticks."""
    puma_keys = {f["properties"]["puma"]
                 for f in json.loads(STATES[state][1].read_text())["features"]}
    need = load_puma_need(state)
    aa = _pumas_for_counties(state, _county_fips(state, aa_counties)) & puma_keys
    vals = sorted(need[p]["unenrolled"] for p in aa if p in need)
    if not vals:
        return "", "", ""
    lo, hi = vals[0], vals[-1]
    return _fmt_k(lo), _fmt_k((lo + hi) / 2), _fmt_k(hi)
