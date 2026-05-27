"""Track 1 demo artifact: CA food-access × PER overlay.

Inputs (all under data-ops/sample/):
  usda-snap-retailers-ca/retailers.csv  -- 30,357 CA SNAP-authorized retailers
  per/2024_payment_error_rates.csv      -- USDA PER by state (CA is state-level only)
  ca-snap-gap/ca_snap_gap_puma.csv      -- PUMA-level non-enrollment estimates

Outputs (./artifacts/):
  retailers_by_county.csv     -- per-county aggregation
  food_access_hexbin.png      -- statewide retailer-density heatmap
  food_access_scatter.png     -- retailer points colored by Store_Type
  county_food_access.png      -- bar chart top/bottom counties + PER annotation
  snap_gap_summary.png        -- PUMA non-enrollment distribution

Run: tools/ca-snap-gap/.venv/bin/python data-ops/analysis/track1-food-desert/build.py
"""

from __future__ import annotations

from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[3]
SAMPLE = ROOT / "data-ops" / "sample"
OUT = Path(__file__).resolve().parent / "artifacts"
OUT.mkdir(parents=True, exist_ok=True)

# ---- Load -------------------------------------------------------------------
retailers = pd.read_csv(SAMPLE / "usda-snap-retailers-ca" / "retailers.csv")
per = pd.read_csv(SAMPLE / "per" / "2024_payment_error_rates.csv")
gap = pd.read_csv(SAMPLE / "ca-snap-gap" / "ca_snap_gap_puma.csv")

ca_per = per.loc[per["state_code"] == "CA"].iloc[0]
CA_PER = float(ca_per["per_total"])  # 10.98

# ---- Per-county aggregation -------------------------------------------------
retailers["County"] = retailers["County"].str.upper().str.strip()
grocery_types = {"Supermarket", "Super Store", "Large Grocery Store", "Grocery Store"}
retailers["is_grocery"] = retailers["Store_Type"].isin(grocery_types)

by_county = (
    retailers.groupby("County")
    .agg(
        total_retailers=("Record_ID", "count"),
        grocery=("is_grocery", "sum"),
    )
    .reset_index()
)
by_county["non_grocery"] = by_county["total_retailers"] - by_county["grocery"]
by_county["grocery_share"] = (by_county["grocery"] / by_county["total_retailers"]).round(3)
# food-access proxy: lower grocery share + low absolute grocery count = stressed
by_county = by_county.sort_values("total_retailers", ascending=False)
by_county.to_csv(OUT / "retailers_by_county.csv", index=False)
print(f"wrote retailers_by_county.csv ({len(by_county)} counties)")

# ---- Statewide hexbin heatmap (the headline visual) -------------------------
fig, ax = plt.subplots(figsize=(9, 11))
lat = retailers["Latitude"].astype(float)
lon = retailers["Longitude"].astype(float)
# CA bounding box, drop a few obvious typos outside the state
mask = (lat.between(32.5, 42.1)) & (lon.between(-124.5, -114.0))
hb = ax.hexbin(
    lon[mask], lat[mask], gridsize=60, cmap="YlOrRd", mincnt=1, bins="log"
)
ax.set_aspect("equal")
ax.set_xlabel("Longitude")
ax.set_ylabel("Latitude")
ax.set_title(
    "CA SNAP-authorized retailer density (log-binned)\n"
    f"n={mask.sum():,} stores · FY2024 CA PER = {CA_PER:.2f}% (USDA, statewide)",
    fontsize=12,
)
cb = fig.colorbar(hb, ax=ax, shrink=0.5, label="log10(stores per hex)")
ax.text(
    0.02, 0.02,
    "Dim hexes = food-access stress.\n"
    "PER is state-level only; county-level PER not\n"
    "published by FNS. Use density + non-enrollment\n"
    "as the load-bearing proxy in the demo.",
    transform=ax.transAxes, fontsize=8, va="bottom",
    bbox=dict(boxstyle="round", fc="white", ec="gray", alpha=0.85),
)
fig.tight_layout()
fig.savefig(OUT / "food_access_hexbin.png", dpi=150)
plt.close(fig)
print("wrote food_access_hexbin.png")

# ---- Scatter by store type -------------------------------------------------
fig, ax = plt.subplots(figsize=(9, 11))
top_types = retailers["Store_Type"].value_counts().head(6).index.tolist()
palette = plt.get_cmap("tab10")
for i, st in enumerate(top_types):
    sub = retailers[(retailers["Store_Type"] == st) & mask]
    ax.scatter(
        sub["Longitude"], sub["Latitude"],
        s=3, alpha=0.4, color=palette(i), label=f"{st} (n={len(sub):,})",
    )
ax.set_aspect("equal")
ax.set_xlabel("Longitude")
ax.set_ylabel("Latitude")
ax.set_title("CA SNAP retailers by Store_Type (top 6)")
ax.legend(loc="lower left", fontsize=8, markerscale=3)
fig.tight_layout()
fig.savefig(OUT / "food_access_scatter.png", dpi=150)
plt.close(fig)
print("wrote food_access_scatter.png")

# ---- County bar chart ------------------------------------------------------
top = by_county.head(15).iloc[::-1]
bot = by_county[by_county["total_retailers"] >= 20].tail(15)  # exclude tiny counties

fig, axes = plt.subplots(1, 2, figsize=(14, 7))
axes[0].barh(top["County"], top["grocery"], color="#5b8c5a", label="Grocery/Super")
axes[0].barh(
    top["County"], top["non_grocery"], left=top["grocery"],
    color="#c87f6a", label="Conv / Other",
)
axes[0].set_title("Top 15 CA counties — total SNAP retailers")
axes[0].set_xlabel("Stores")
axes[0].legend(loc="lower right", fontsize=9)

axes[1].barh(bot["County"], bot["grocery"], color="#5b8c5a")
axes[1].barh(
    bot["County"], bot["non_grocery"], left=bot["grocery"], color="#c87f6a",
)
axes[1].set_title(
    "Bottom 15 CA counties (≥20 stores) — food-access tail"
)
axes[1].set_xlabel("Stores")

fig.suptitle(
    f"Retailer mix per county · FY2024 CA statewide PER {CA_PER:.2f}% "
    f"(over/under {ca_per['per_overpayment']:.2f}/{ca_per['per_underpayment']:.2f})",
    fontsize=11,
)
fig.tight_layout()
fig.savefig(OUT / "county_food_access.png", dpi=150)
plt.close(fig)
print("wrote county_food_access.png")

# ---- SNAP-gap distribution -------------------------------------------------
fig, ax = plt.subplots(figsize=(9, 5))
ax.hist(gap["est_non_enrollment_rate"], bins=30, color="#7a5b8c", edgecolor="white")
median = gap["est_non_enrollment_rate"].median()
ax.axvline(median, color="black", ls="--", lw=1, label=f"median {median:.2f}")
ax.set_xlabel("Estimated non-enrollment rate (eligible but unenrolled)")
ax.set_ylabel("PUMAs")
ax.set_title(
    f"CA SNAP-gap by PUMA · n={len(gap)} PUMAs · "
    f"~{int(gap['est_eligible_population'].sum() / 1_000_000):,}M eligible Californians"
)
ax.legend()
fig.tight_layout()
fig.savefig(OUT / "snap_gap_summary.png", dpi=150)
plt.close(fig)
print("wrote snap_gap_summary.png")

# ---- Top-line numbers for README ------------------------------------------
summary = {
    "ca_per_fy2024_total": CA_PER,
    "ca_per_fy2024_over": float(ca_per["per_overpayment"]),
    "ca_per_fy2024_under": float(ca_per["per_underpayment"]),
    "retailer_total": int(len(retailers)),
    "retailer_grocery_share_pct": round(
        100 * retailers["is_grocery"].sum() / len(retailers), 2
    ),
    "counties": int(by_county.shape[0]),
    "top_county": by_county.iloc[0]["County"],
    "top_county_stores": int(by_county.iloc[0]["total_retailers"]),
    "pumas": int(len(gap)),
    "median_non_enrollment_rate": round(float(gap["est_non_enrollment_rate"].median()), 4),
    "total_eligible_population": int(gap["est_eligible_population"].sum()),
}
import json
(OUT / "summary.json").write_text(json.dumps(summary, indent=2))
print("wrote summary.json")
print(json.dumps(summary, indent=2))
