"""Regional-context county map as inline SVG.

Design rule (design review Pass 2): never render a one-polygon choropleth.
The AA county/counties render in the accent; neighboring counties render in a
single-hue green ramp ordered by LIGHTNESS (grayscale-print safe); counties
with no data render a distinct neutral gray, never as low-need.
"""
import json
import math
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
CA_COUNTIES = REPO_ROOT / "data-ops/reference/ca_counties.geojson"
US_COUNTIES = REPO_ROOT / "data-ops/reference/us_counties_20m.geojson"

ACCENT = "#1d4d3b"
# Lightness-ordered ramp, low need -> high need (survives grayscale).
RAMP = ["#cdddd5", "#a6c3b6", "#7fa896", "#5c8f7b", "#3f7360"]
NO_DATA = "#e8eae9"

N_NEIGHBORS = 5


class GeometryGapError(Exception):
    """A county with metrics is missing from the geojson (hard error)."""


def _load_features(geojson_kind="ca_named", state_fips=None):
    """Name-keyed geometry dict. 'ca_named' = legacy CA file; 'national' =
    Census 20m national file filtered to state_fips, keyed by NAME."""
    if geojson_kind == "ca_named":
        g = json.loads(CA_COUNTIES.read_text())
        return {f["properties"]["name"]: f["geometry"] for f in g["features"]}
    g = json.loads(US_COUNTIES.read_text())
    return {f["properties"]["NAME"]: f["geometry"]
            for f in g["features"] if f.get("id", "").startswith(state_fips)}


def _rings(geom):
    if geom["type"] == "Polygon":
        return geom["coordinates"]
    if geom["type"] == "MultiPolygon":
        return [ring for poly in geom["coordinates"] for ring in poly]
    raise GeometryGapError(f"unsupported geometry type {geom['type']}")


def _centroid(geom):
    pts = [p for ring in _rings(geom) for p in ring]
    return (sum(p[0] for p in pts) / len(pts), sum(p[1] for p in pts) / len(pts))


def neighbors_of(aa_counties, geoms, n=N_NEIGHBORS):
    """Nearest-n counties by centroid distance (topology-free, auditable)."""
    centers = {name: _centroid(g) for name, g in geoms.items()}
    aa_centers = [centers[c] for c in aa_counties if c in centers]
    if not aa_centers:
        raise GeometryGapError(f"no geometry for any AA county: {aa_counties}")
    def dist(name):
        cx, cy = centers[name]
        return min(math.hypot(cx - ax, cy - ay) for ax, ay in aa_centers)
    others = sorted((c for c in geoms if c not in aa_counties), key=dist)
    return others[:n]


def _ramp_color(rate, rates):
    lo, hi = min(rates), max(rates)
    if hi == lo:
        return RAMP[len(RAMP) // 2]
    i = int((rate - lo) / (hi - lo) * (len(RAMP) - 1) + 0.5)
    return RAMP[i]


def regional_map_svg(aa_counties, metrics, width=560, height=430,
                     geojson_kind="ca_named", state_fips=None):
    """SVG string: AA in accent, neighbors ramped by need, no-data gray."""
    geoms = _load_features(geojson_kind, state_fips)
    for c in aa_counties:
        if c in metrics and c not in geoms:
            raise GeometryGapError(f"county has metrics but no geometry: {c}")
    show = list(aa_counties) + [n for n in neighbors_of(aa_counties, geoms)
                               if n not in aa_counties]
    shown_rates = [metrics[c]["non_enroll_rate"] for c in show if c in metrics]

    # Equirectangular fit anchored on the AA counties (expanded ~2.2x) so one
    # oversized neighbor (San Bernardino) can't shrink the AA to a speck.
    # Neighbor geometry outside the frame clips at the viewBox edge.
    aa_pts = [p for c in aa_counties if c in geoms
              for ring in _rings(geoms[c]) for p in ring]
    alons, alats = [p[0] for p in aa_pts], [p[1] for p in aa_pts]
    cx, cy = (min(alons) + max(alons)) / 2, (min(alats) + max(alats)) / 2
    # Single-county AAs need generous surrounding context (2.2x); multi-county
    # AAs already are the context — expand just enough for neighbor slivers.
    expand = 2.2 if len(aa_counties) == 1 else 1.15
    half_w = max((max(alons) - min(alons)) / 2, 0.2) * expand
    half_h = max((max(alats) - min(alats)) / 2, 0.2) * expand
    lons = [cx - half_w, cx + half_w]
    lats = [cy - half_h, cy + half_h]
    lat0 = math.radians(cy)
    xs = [lon * math.cos(lat0) for lon in lons]
    minx, maxx, miny, maxy = min(xs), max(xs), min(lats), max(lats)
    pad = 8
    sx = (width - 2 * pad) / (maxx - minx)
    sy = (height - 2 * pad) / (maxy - miny)
    s = min(sx, sy)
    # Center the fitted content in the box (min-scale fit leaves slack on one axis).
    ox = (width - (maxx - minx) * s) / 2
    oy = (height - (maxy - miny) * s) / 2

    def project(lon, lat):
        x = ox + (lon * math.cos(lat0) - minx) * s
        y = oy + (maxy - lat) * s
        return f"{x:.1f},{y:.1f}"

    shapes = []
    for c in show:
        if c in aa_counties:
            fill, cls = ACCENT, "aa"
        elif c in metrics:
            fill, cls = _ramp_color(metrics[c]["non_enroll_rate"], shown_rates), "ctx"
        else:
            fill, cls = NO_DATA, "nodata"
        for ring in _rings(geoms[c]):
            path = " ".join(project(lon, lat) for lon, lat in ring)
            shapes.append(
                f'<polygon class="{cls}" data-county="{c}" points="{path}" '
                f'fill="{fill}" stroke="#ffffff" stroke-width="1.5"/>'
            )
    return (f'<svg viewBox="0 0 {width} {height}" '
            f'xmlns="http://www.w3.org/2000/svg" role="img" '
            f'aria-label="Assessment area in regional context">'
            + "".join(shapes) + "</svg>")
