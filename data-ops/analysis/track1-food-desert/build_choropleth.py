"""Track 1 county choropleth: PUMA→county allocation + dual-metric map.

Pipeline:
  1. Load 2020 tract→PUMA crosswalk, filter to CA (STATEFP=06).
  2. For each PUMA, count tracts per overlapping county → tract-share weight.
  3. Apportion ca-snap-gap PUMA stats (est_eligible_population, weighted
     non_enrollment_rate) into counties using those weights.
  4. Join with per-county retailer aggregation (retailers_by_county.csv).
  5. Emit:
       - county_metrics.csv          full per-county join
       - county_choropleth.png       matplotlib two-panel choropleth
       - county_choropleth.html      Folium interactive choropleth

The PUMA codes in ca_snap_gap_puma.csv are 7 digits (06 state FIPS + 5-digit PUMA);
the crosswalk uses 5-digit PUMA5CE within STATEFP=06.

Tract-count weighting is a crude proxy for PUMA→county population share — it
assumes tracts within a PUMA are roughly equal-sized. Good enough for a demo
visual; documented as a caveat in README.

Run: tools/ca-snap-gap/.venv/bin/python data-ops/analysis/track1-food-desert/build_choropleth.py
"""
from __future__ import annotations

import json
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import folium

ROOT = Path(__file__).resolve().parents[3]
SAMPLE = ROOT / "data-ops" / "sample"
REF = ROOT / "data-ops" / "reference"
OUT = Path(__file__).resolve().parent / "artifacts"
OUT.mkdir(parents=True, exist_ok=True)

# ---- Load -------------------------------------------------------------------
xwalk = pd.read_csv(
    REF / "2020_tract_to_puma.txt",
    dtype={"STATEFP": str, "COUNTYFP": str, "TRACTCE": str, "PUMA5CE": str},
)
xwalk = xwalk[xwalk["STATEFP"] == "06"].copy()

gap = pd.read_csv(SAMPLE / "ca-snap-gap" / "ca_snap_gap_puma.csv")
# puma_code is 7-digit (06 + 5-digit puma); puma_raw appears to be the 5-digit
# PUMA but stored as int (e.g. 101, 7507). Zero-pad to 5.
gap["PUMA5CE"] = gap["puma_raw"].astype(int).astype(str).str.zfill(5)

retailers_by_county = pd.read_csv(OUT / "retailers_by_county.csv")
retailers_by_county["County"] = retailers_by_county["County"].str.title()

with open(REF / "ca_counties.geojson") as f:
    ca_geo = json.load(f)

# ---- CA county FIPS → name map ---------------------------------------------
# Hardcode the canonical FIPS→name mapping for CA's 58 counties (drives the
# crosswalk join). FIPS codes are odd-numbered 001..115.
CA_COUNTIES = {
    "001": "Alameda", "003": "Alpine", "005": "Amador", "007": "Butte",
    "009": "Calaveras", "011": "Colusa", "013": "Contra Costa", "015": "Del Norte",
    "017": "El Dorado", "019": "Fresno", "021": "Glenn", "023": "Humboldt",
    "025": "Imperial", "027": "Inyo", "029": "Kern", "031": "Kings",
    "033": "Lake", "035": "Lassen", "037": "Los Angeles", "039": "Madera",
    "041": "Marin", "043": "Mariposa", "045": "Mendocino", "047": "Merced",
    "049": "Modoc", "051": "Mono", "053": "Monterey", "055": "Napa",
    "057": "Nevada", "059": "Orange", "061": "Placer", "063": "Plumas",
    "065": "Riverside", "067": "Sacramento", "069": "San Benito",
    "071": "San Bernardino", "073": "San Diego", "075": "San Francisco",
    "077": "San Joaquin", "079": "San Luis Obispo", "081": "San Mateo",
    "083": "Santa Barbara", "085": "Santa Clara", "087": "Santa Cruz",
    "089": "Shasta", "091": "Sierra", "093": "Siskiyou", "095": "Solano",
    "097": "Sonoma", "099": "Stanislaus", "101": "Sutter", "103": "Tehama",
    "105": "Trinity", "107": "Tulare", "109": "Tuolumne", "111": "Ventura",
    "113": "Yolo", "115": "Yuba",
}
xwalk["County"] = xwalk["COUNTYFP"].map(CA_COUNTIES)

# ---- PUMA→county weights via tract count -----------------------------------
tract_share = (
    xwalk.groupby(["PUMA5CE", "County"]).size().reset_index(name="n_tracts")
)
puma_totals = tract_share.groupby("PUMA5CE")["n_tracts"].sum().rename("puma_tracts")
tract_share = tract_share.join(puma_totals, on="PUMA5CE")
tract_share["weight"] = tract_share["n_tracts"] / tract_share["puma_tracts"]

# ---- Apportion gap stats ----------------------------------------------------
merged = tract_share.merge(
    gap[["PUMA5CE", "est_eligible_population", "est_non_enrollment_rate"]],
    on="PUMA5CE", how="inner",
)
merged["county_eligible_pop"] = merged["weight"] * merged["est_eligible_population"]
# population-weighted non-enrollment rate at county level
merged["weighted_non_enroll_num"] = (
    merged["county_eligible_pop"] * merged["est_non_enrollment_rate"]
)
county_gap = merged.groupby("County").agg(
    eligible_pop=("county_eligible_pop", "sum"),
    non_enroll_weighted=("weighted_non_enroll_num", "sum"),
).reset_index()
county_gap["non_enroll_rate"] = (
    county_gap["non_enroll_weighted"] / county_gap["eligible_pop"]
)
county_gap = county_gap.drop(columns=["non_enroll_weighted"])

# ---- Join with retailer aggregation ----------------------------------------
county_metrics = county_gap.merge(retailers_by_county, on="County", how="outer")
county_metrics["stores_per_10k_eligible"] = (
    county_metrics["total_retailers"] / county_metrics["eligible_pop"] * 10_000
).round(2)
county_metrics["grocery_per_10k_eligible"] = (
    county_metrics["grocery"] / county_metrics["eligible_pop"] * 10_000
).round(2)
county_metrics = county_metrics.sort_values("eligible_pop", ascending=False)
county_metrics.to_csv(OUT / "county_metrics.csv", index=False)
print(f"wrote county_metrics.csv ({len(county_metrics)} counties)")

# ---- Matplotlib choropleth (two-panel) -------------------------------------
# Build a quick polygon lookup from the geojson.
from matplotlib.patches import Polygon as MplPolygon
from matplotlib.collections import PatchCollection
from matplotlib.colors import Normalize
from matplotlib import cm

def county_patches(metric_map, cmap_name, vmin=None, vmax=None):
    patches, values = [], []
    for feat in ca_geo["features"]:
        name = feat["properties"]["name"]
        val = metric_map.get(name)
        geom = feat["geometry"]
        polys = geom["coordinates"] if geom["type"] == "Polygon" else [
            c for mp in geom["coordinates"] for c in mp
        ]
        for poly in polys:
            patches.append(MplPolygon(poly, closed=True))
            values.append(val if val is not None else np.nan)
    return patches, np.array(values, dtype=float)

fig, axes = plt.subplots(1, 2, figsize=(16, 10))

# Panel 1: non-enrollment rate
nem = dict(zip(county_metrics["County"], county_metrics["non_enroll_rate"]))
patches1, vals1 = county_patches(nem, "Reds")
pc1 = PatchCollection(patches1, cmap="Reds", edgecolor="white", linewidth=0.4)
pc1.set_array(vals1)
pc1.set_clim(np.nanpercentile(vals1, 5), np.nanpercentile(vals1, 95))
axes[0].add_collection(pc1)
axes[0].set_xlim(-125, -114)
axes[0].set_ylim(32.3, 42.2)
axes[0].set_aspect("equal")
axes[0].set_title("CA non-enrollment rate by county\n(PUMA→county allocation, tract-weighted)")
axes[0].set_xticks([]); axes[0].set_yticks([])
fig.colorbar(pc1, ax=axes[0], shrink=0.6, label="Estimated non-enrollment rate")

# Panel 2: grocery share
gsm = dict(zip(county_metrics["County"], county_metrics["grocery_share"]))
patches2, vals2 = county_patches(gsm, "Greens")
pc2 = PatchCollection(patches2, cmap="Greens", edgecolor="white", linewidth=0.4)
pc2.set_array(vals2)
pc2.set_clim(np.nanpercentile(vals2, 5), np.nanpercentile(vals2, 95))
axes[1].add_collection(pc2)
axes[1].set_xlim(-125, -114)
axes[1].set_ylim(32.3, 42.2)
axes[1].set_aspect("equal")
axes[1].set_title("Grocery share of SNAP retailers by county\n(higher = better food access)")
axes[1].set_xticks([]); axes[1].set_yticks([])
fig.colorbar(pc2, ax=axes[1], shrink=0.6, label="grocery / total")

fig.suptitle(
    "CA food access × SNAP gap — county view\n"
    "FY2024 CA PER 10.98% (state-level; FNS does not publish county PER)",
    fontsize=13,
)
fig.tight_layout()
fig.savefig(OUT / "county_choropleth.png", dpi=150)
plt.close(fig)
print("wrote county_choropleth.png")

# ---- Folium interactive choropleth -----------------------------------------
fmap = folium.Map(location=[36.7, -119.5], zoom_start=6, tiles="CartoDB positron")

# Wrap county_metrics to the form folium.Choropleth wants
choro_df = county_metrics[["County", "non_enroll_rate", "grocery_share",
                            "total_retailers", "eligible_pop"]].copy()

folium.Choropleth(
    geo_data=str(REF / "ca_counties.geojson"),
    data=choro_df,
    columns=["County", "non_enroll_rate"],
    key_on="feature.properties.name",
    fill_color="YlOrRd",
    fill_opacity=0.75,
    line_opacity=0.4,
    nan_fill_color="lightgray",
    legend_name="Estimated non-enrollment rate (PUMA→county)",
    name="Non-enrollment rate",
).add_to(fmap)

folium.Choropleth(
    geo_data=str(REF / "ca_counties.geojson"),
    data=choro_df,
    columns=["County", "grocery_share"],
    key_on="feature.properties.name",
    fill_color="YlGn",
    fill_opacity=0.75,
    line_opacity=0.4,
    nan_fill_color="lightgray",
    legend_name="Grocery share of SNAP retailers",
    name="Grocery share",
    show=False,
).add_to(fmap)

# Hover tooltip layer
choro_lookup = choro_df.set_index("County").to_dict(orient="index")
def _style(_): return {"fillOpacity": 0, "color": "transparent"}
def _highlight(_): return {"weight": 2, "color": "#333"}

for feat in ca_geo["features"]:
    name = feat["properties"]["name"]
    row = choro_lookup.get(name, {})
    feat["properties"]["non_enroll_pct"] = (
        f"{100*row.get('non_enroll_rate', float('nan')):.1f}%"
        if row.get("non_enroll_rate") is not None and not pd.isna(row.get("non_enroll_rate"))
        else "n/a"
    )
    feat["properties"]["grocery_share_pct"] = (
        f"{100*row.get('grocery_share', float('nan')):.1f}%"
        if row.get("grocery_share") is not None and not pd.isna(row.get("grocery_share"))
        else "n/a"
    )
    feat["properties"]["total_retailers_fmt"] = (
        f"{int(row.get('total_retailers', 0)):,}"
        if row.get("total_retailers") and not pd.isna(row.get("total_retailers"))
        else "n/a"
    )

folium.GeoJson(
    ca_geo,
    style_function=_style,
    highlight_function=_highlight,
    tooltip=folium.GeoJsonTooltip(
        fields=["name", "non_enroll_pct", "grocery_share_pct", "total_retailers_fmt"],
        aliases=["County", "Non-enroll", "Grocery share", "SNAP stores"],
        sticky=True,
    ),
    name="Hover for stats",
).add_to(fmap)

folium.LayerControl(collapsed=False).add_to(fmap)

banner = """
<div style="position: fixed; top: 10px; left: 50px; z-index: 9999;
            background: white; padding: 10px 14px; border-radius: 6px;
            box-shadow: 0 2px 6px rgba(0,0,0,0.15); font-family: -apple-system, sans-serif;
            max-width: 340px; font-size: 12px; line-height: 1.4;">
  <div style="font-size: 14px; font-weight: 600; margin-bottom: 4px;">
    CA county view — non-enrollment × grocery share
  </div>
  <div>Toggle layers (top-right) to compare the two pillars.</div>
  <div style="color: #555; margin-top: 4px;">
    PUMA→county via tract-count weighting. FY2024 CA PER 10.98% (state-level only).
  </div>
</div>
"""
fmap.get_root().html.add_child(folium.Element(banner))

out_path = OUT / "county_choropleth.html"
fmap.save(str(out_path))
print(f"wrote {out_path.name} ({out_path.stat().st_size/1024:.0f} KB)")
