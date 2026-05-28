"""Track 1 interactive layer: Folium HTML map.

Builds an offline-loadable HTML map combining:
  - HeatMap layer of all CA SNAP retailers (the food-access heatmap proper)
  - Grocery-only HeatMap (subset: Supermarket/Super Store/Large Grocery/Grocery Store)
  - Marker cluster colored by Store_Type (top 6 types)
  - Title banner with FY2024 CA PER + SNAP-gap top-line numbers

LayerControl lets the viewer toggle layers — the "all retailers vs grocery-only"
toggle is the load-bearing interaction: it visualizes the food-desert claim by
showing how many of the dense urban hexes collapse when convenience stores are
removed.

Run: tools/ca-snap-gap/.venv/bin/python data-ops/analysis/track1-food-desert/build_interactive.py
Output: ./artifacts/interactive_map.html (self-contained, opens in any browser)
"""
from __future__ import annotations

from pathlib import Path
import json

import folium
from folium.plugins import HeatMap, MarkerCluster
import pandas as pd

ROOT = Path(__file__).resolve().parents[3]
SAMPLE = ROOT / "data-ops" / "sample"
OUT = Path(__file__).resolve().parent / "artifacts"
OUT.mkdir(parents=True, exist_ok=True)

retailers = pd.read_csv(SAMPLE / "usda-snap-retailers-ca" / "retailers.csv")
per = pd.read_csv(SAMPLE / "per" / "2024_payment_error_rates.csv")
gap = pd.read_csv(SAMPLE / "ca-snap-gap" / "ca_snap_gap_puma.csv")

ca_per = per.loc[per["state_code"] == "CA"].iloc[0]
CA_PER = float(ca_per["per_total"])

# CA bbox filter — kills a handful of typos
m = (retailers["Latitude"].between(32.5, 42.1)) & (
    retailers["Longitude"].between(-124.5, -114.0)
)
ret = retailers[m].copy()

grocery_types = {"Supermarket", "Super Store", "Large Grocery Store", "Grocery Store"}
ret["is_grocery"] = ret["Store_Type"].isin(grocery_types)

# CA centroid-ish
fmap = folium.Map(
    location=[36.7, -119.5], zoom_start=6, tiles="CartoDB positron",
    control_scale=True,
)

# Title / pitch banner
banner_html = f"""
<div style="position: fixed; top: 10px; left: 50px; z-index: 9999;
            background: white; padding: 10px 14px; border-radius: 6px;
            box-shadow: 0 2px 6px rgba(0,0,0,0.15); font-family: -apple-system, sans-serif;
            max-width: 380px; font-size: 12px; line-height: 1.4;">
  <div style="font-size: 14px; font-weight: 600; margin-bottom: 4px;">
    CA SNAP food access — Track 1
  </div>
  <div><b>{len(ret):,}</b> SNAP-authorized retailers ·
       <b>{int(ret['is_grocery'].sum()):,}</b> grocery / supermarket
       (<b>{100*ret['is_grocery'].mean():.1f}%</b>)</div>
  <div>FY2024 CA PER <b>{CA_PER:.2f}%</b>
       (over {ca_per['per_overpayment']:.2f} / under {ca_per['per_underpayment']:.2f})</div>
  <div><b>{gap['est_eligible_population'].sum()/1e6:.2f}M</b> est. eligible Californians ·
       median PUMA non-enrollment <b>{gap['est_non_enrollment_rate'].median()*100:.1f}%</b></div>
  <div style="margin-top: 6px; color: #555;">
    Toggle "Grocery only" vs "All retailers" to see food-desert geography.
  </div>
</div>
"""
fmap.get_root().html.add_child(folium.Element(banner_html))

# --- HeatMap: all retailers ---
all_pts = ret[["Latitude", "Longitude"]].values.tolist()
HeatMap(
    all_pts, name="All retailers (heatmap)",
    radius=12, blur=18, max_zoom=10, min_opacity=0.25,
).add_to(fmap)

# --- HeatMap: grocery only ---
grocery_pts = ret.loc[ret["is_grocery"], ["Latitude", "Longitude"]].values.tolist()
HeatMap(
    grocery_pts, name="Grocery only (heatmap)",
    radius=14, blur=20, max_zoom=10, min_opacity=0.3,
    gradient={0.2: "#2e6f3e", 0.5: "#7ab87a", 0.8: "#f3d250", 1.0: "#c04040"},
    show=False,
).add_to(fmap)

# --- Marker cluster colored by store type (sampled to keep HTML <5MB) ---
SAMPLE_N = 4000
sampled = ret.sample(min(SAMPLE_N, len(ret)), random_state=42)
type_colors = {
    "Convenience Store": "lightred",
    "Grocery Store": "green",
    "Supermarket": "darkgreen",
    "Super Store": "darkgreen",
    "Large Grocery Store": "green",
    "Dollar Store": "orange",
    "Pharmacy": "blue",
    "Specialty Store": "purple",
    "Farmer's Market": "darkgreen",
    "Convenience Store With Gas": "lightred",
}
cluster = MarkerCluster(name=f"Stores (sampled {SAMPLE_N:,})", show=False).add_to(fmap)
for _, row in sampled.iterrows():
    color = type_colors.get(row["Store_Type"], "gray")
    folium.CircleMarker(
        location=[row["Latitude"], row["Longitude"]],
        radius=3,
        color=color, fill=True, fill_opacity=0.7, weight=0,
        popup=folium.Popup(
            f"<b>{row['Store_Name']}</b><br>"
            f"{row['Store_Type']}<br>"
            f"{row['City']}, {row['County']}",
            max_width=240,
        ),
    ).add_to(cluster)

# Legend for marker colors
legend_html = """
<div style="position: fixed; bottom: 30px; right: 20px; z-index: 9999;
            background: white; padding: 8px 12px; border-radius: 6px;
            box-shadow: 0 2px 6px rgba(0,0,0,0.15); font-family: -apple-system, sans-serif;
            font-size: 11px; line-height: 1.6;">
  <div style="font-weight:600;margin-bottom:4px;">Store type</div>
  <div><span style="color:#3a7d3a">●</span> Grocery / Supermarket</div>
  <div><span style="color:#ff7575">●</span> Convenience</div>
  <div><span style="color:#f5a623">●</span> Dollar</div>
  <div><span style="color:#5b8def">●</span> Pharmacy</div>
  <div><span style="color:#9b59b6">●</span> Specialty</div>
</div>
"""
fmap.get_root().html.add_child(folium.Element(legend_html))

folium.LayerControl(collapsed=False, position="topright").add_to(fmap)

out_path = OUT / "interactive_map.html"
fmap.save(str(out_path))
size_kb = out_path.stat().st_size / 1024
print(f"wrote {out_path.name} ({size_kb:.0f} KB)")
