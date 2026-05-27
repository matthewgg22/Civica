"""Track 1 quadrant chart: county priority view.

Plots every CA county on (grocery_share, non_enroll_rate) axes, sized by
eligible population. The upper-left quadrant — low grocery share + high
non-enrollment — is the "highest priority" zone. The headline counties from
the pitch (Orange, San Bernardino) land in or near it.

Run: tools/ca-snap-gap/.venv/bin/python data-ops/analysis/track1-food-desert/build_quadrant.py
Output: ./artifacts/county_quadrant.png
"""
from __future__ import annotations

from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

OUT = Path(__file__).resolve().parent / "artifacts"
df = pd.read_csv(OUT / "county_metrics.csv")
df = df.dropna(subset=["grocery_share", "non_enroll_rate", "eligible_pop"])

# medians = quadrant split
gx = df["grocery_share"].median()
gy = df["non_enroll_rate"].median()

fig, ax = plt.subplots(figsize=(11, 8))
sizes = np.clip(df["eligible_pop"] / 1500, 20, 800)

# colour by quadrant
def quad(row):
    if row["grocery_share"] < gx and row["non_enroll_rate"] > gy:
        return "#b03a2e"  # priority: low access × high gap
    if row["grocery_share"] >= gx and row["non_enroll_rate"] > gy:
        return "#d49a3a"  # high gap, ok access (execution gap)
    if row["grocery_share"] < gx and row["non_enroll_rate"] <= gy:
        return "#7a8aa3"  # low access, ok enrollment
    return "#5b8c5a"  # neither — comparatively healthy

df["color"] = df.apply(quad, axis=1)
ax.scatter(
    df["grocery_share"], df["non_enroll_rate"],
    s=sizes, c=df["color"], alpha=0.75, edgecolor="white", linewidth=0.8,
)

# axis lines
ax.axvline(gx, ls="--", color="gray", lw=0.8, alpha=0.7)
ax.axhline(gy, ls="--", color="gray", lw=0.8, alpha=0.7)
ax.text(gx + 0.001, ax.get_ylim()[1] * 0.99 if False else 0.79,
        f"median grocery share {gx:.2f}", fontsize=8, color="gray", va="top")
ax.text(0.41, gy + 0.002,
        f"median non-enrollment {gy*100:.1f}%", fontsize=8, color="gray", ha="right")

# label notable counties
label_set = {
    "Orange", "San Bernardino", "Los Angeles", "San Diego", "Riverside",
    "Fresno", "Kern", "Sacramento", "Alameda", "Santa Clara", "Contra Costa",
    "Ventura", "Stanislaus", "San Francisco", "Imperial", "Tulare",
}
for _, row in df.iterrows():
    if row["County"] in label_set:
        ax.annotate(
            row["County"],
            xy=(row["grocery_share"], row["non_enroll_rate"]),
            xytext=(5, 4), textcoords="offset points",
            fontsize=8, color="#222",
        )

# quadrant titles
ax.text(0.005, 0.78, "↖ HIGHEST PRIORITY\nlow access × high gap",
        fontsize=9, color="#b03a2e", weight="bold")
ax.text(0.42, 0.78, "↗ EXECUTION GAP\nstores ok, enrollment poor",
        fontsize=9, color="#a87521", weight="bold", ha="right")
ax.text(0.005, 0.41, "↙ LOW ACCESS\nstores poor, enrollment ok",
        fontsize=9, color="#5a6a83", weight="bold")
ax.text(0.42, 0.41, "↘ COMPARATIVELY HEALTHY",
        fontsize=9, color="#3e6a3e", weight="bold", ha="right")

ax.set_xlabel("Grocery share of SNAP retailers")
ax.set_ylabel("Estimated non-enrollment rate")
ax.set_title(
    "CA counties — gap × access quadrant\n"
    "Bubble size = est. eligible population (PUMA→county, tract-weighted)",
    fontsize=12,
)

# legend for size
for pop, lbl in [(50_000, "50K"), (200_000, "200K"), (1_000_000, "1M")]:
    ax.scatter([], [], s=pop / 1500, c="#888", alpha=0.5, label=f"{lbl} eligible")
ax.legend(loc="lower right", title="Eligible pop", labelspacing=1.2, frameon=True)

fig.tight_layout()
fig.savefig(OUT / "county_quadrant.png", dpi=150)
plt.close(fig)
print("wrote county_quadrant.png")

# also emit a small priority list
priority = df[df["color"] == "#b03a2e"].sort_values("eligible_pop", ascending=False)
print(f"\nPriority quadrant counties (n={len(priority)}):")
print(priority[["County", "eligible_pop", "non_enroll_rate", "grocery_share",
                "grocery_per_10k_eligible"]].to_string(index=False))
