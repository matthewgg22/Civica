#!/usr/bin/env python3
"""
Civica terracotta vs brick adjacency contrast check.

Codified follow-up from the May 2026 plan-design-review C1 token
codification. The terracotta token (#F0DCD0 surface) sits adjacent
to brickSurface (#F1D4C8) in hue space — both are warm
red-toward-orange tints. Before any surface ships terracotta and
brick visible in the same composition, the two need to remain
distinguishable across:

  • Normal vision at 30/50/100% brightness
  • Deuteranopia (red-green colorblindness, ~5% of men)
  • Protanopia (red blindness, ~1% of men)

This script computes WCAG 2.1 relative-luminance contrast ratios
between the two surfaces and prints findings. Run before any
new feature that places terracotta and brick visible at once.

Exit 0 = recommended distinguishable, 1 = below threshold.
"""
from __future__ import annotations

import sys

# Tokens from CivicaDesignSystem/Sources/CivicaDesignSystem/CivicaColors.swift
# Light-mode values (the app is .preferredColorScheme(.light) at root).
TERRACOTTA_SURFACE      = "#F0DCD0"
TERRACOTTA_SURFACE_PRSD = "#E5CFBF"
TERRACOTTA_ACCENT       = "#7E3F26"

BRICK_SURFACE  = "#F1D4C8"  # CivicaColors.brickSurface light
BRICK_ACCENT   = "#9C3A24"  # CivicaColors.brickAccent light

PAPER          = "#F7F5EF"  # the cream background both surfaces sit on
INK            = "#1A1714"  # body text


def srgb_to_linear(c: float) -> float:
    c = c / 255.0
    return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4


def relative_luminance(hex_color: str) -> float:
    h = hex_color.lstrip("#")
    r, g, b = int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)
    return (
        0.2126 * srgb_to_linear(r) +
        0.7152 * srgb_to_linear(g) +
        0.0722 * srgb_to_linear(b)
    )


def contrast_ratio(a: str, b: str) -> float:
    la, lb = relative_luminance(a), relative_luminance(b)
    lighter, darker = max(la, lb), min(la, lb)
    return (lighter + 0.05) / (darker + 0.05)


def simulate_deuteranopia(hex_color: str) -> str:
    """Brettel/Vienot/Mollon 1997 deuteranopia matrix (R-G mostly merged)."""
    h = hex_color.lstrip("#")
    r, g, b = int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)
    rl, gl, bl = srgb_to_linear(r), srgb_to_linear(g), srgb_to_linear(b)
    # Deuteranopia transform
    rd = 0.367_322 * rl + 0.860_646 * gl + -0.227_968 * bl
    gd = 0.280_085 * rl + 0.672_501 * gl + 0.047_413 * bl
    bd = -0.011_820 * rl + 0.042_940 * gl + 0.968_881 * bl
    def linear_to_srgb(c: float) -> int:
        c = max(0.0, min(1.0, c))
        s = c * 12.92 if c <= 0.003_130_8 else 1.055 * (c ** (1 / 2.4)) - 0.055
        return max(0, min(255, round(s * 255)))
    return f"#{linear_to_srgb(rd):02X}{linear_to_srgb(gd):02X}{linear_to_srgb(bd):02X}"


def simulate_protanopia(hex_color: str) -> str:
    """Brettel/Vienot/Mollon 1997 protanopia matrix (R blind)."""
    h = hex_color.lstrip("#")
    r, g, b = int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)
    rl, gl, bl = srgb_to_linear(r), srgb_to_linear(g), srgb_to_linear(b)
    rd = 0.152_286 * rl + 1.052_583 * gl + -0.204_868 * bl
    gd = 0.114_503 * rl + 0.786_281 * gl + 0.099_216 * bl
    bd = -0.003_882 * rl + -0.048_116 * gl + 1.051_998 * bl
    def linear_to_srgb(c: float) -> int:
        c = max(0.0, min(1.0, c))
        s = c * 12.92 if c <= 0.003_130_8 else 1.055 * (c ** (1 / 2.4)) - 0.055
        return max(0, min(255, round(s * 255)))
    return f"#{linear_to_srgb(rd):02X}{linear_to_srgb(gd):02X}{linear_to_srgb(bd):02X}"


# Recommended thresholds.
# WCAG 2.1 doesn't define a "surface differentiation" threshold per se,
# but Apple HIG and BBC GEL both target ≥ 1.3:1 between adjacent surface
# fills for non-text differentiation, with > 1.5:1 strongly preferred.
TARGET_NORMAL = 1.3
TARGET_PREFERRED = 1.5


def main() -> int:
    print("Terracotta vs brick adjacency check")
    print("=" * 60)

    pairs = [
        ("terracottaSurface vs brickSurface",
            TERRACOTTA_SURFACE, BRICK_SURFACE),
        ("terracottaAccent  vs brickAccent",
            TERRACOTTA_ACCENT,  BRICK_ACCENT),
        ("terracottaAccent  on terracottaSurface (text on bg)",
            TERRACOTTA_ACCENT,  TERRACOTTA_SURFACE),
        ("brickAccent       on brickSurface (text on bg)",
            BRICK_ACCENT,       BRICK_SURFACE),
        ("terracottaSurface vs paper (surface vs ground)",
            TERRACOTTA_SURFACE, PAPER),
        ("brickSurface      vs paper (surface vs ground)",
            BRICK_SURFACE,      PAPER),
        ("INK on terracottaSurface (body text)",
            INK,                TERRACOTTA_SURFACE),
        ("INK on brickSurface (body text)",
            INK,                BRICK_SURFACE),
    ]

    print(f"\n{'Pair':<55} {'Normal':>8} {'Deut.':>8} {'Prot.':>8}")
    print("-" * 90)
    any_below_target = False
    for label, a, b in pairs:
        r_normal = contrast_ratio(a, b)
        r_deut   = contrast_ratio(simulate_deuteranopia(a), simulate_deuteranopia(b))
        r_prot   = contrast_ratio(simulate_protanopia(a),   simulate_protanopia(b))
        flag = ""
        if "terracottaSurface vs brickSurface" in label:
            if min(r_normal, r_deut, r_prot) < TARGET_NORMAL:
                any_below_target = True
                flag = "  ✗ BELOW TARGET"
            elif min(r_normal, r_deut, r_prot) < TARGET_PREFERRED:
                flag = "  ⚠ marginal"
        print(f"{label:<55} {r_normal:>7.2f}: {r_deut:>7.2f}: {r_prot:>7.2f}:{flag}")

    print("\n" + "=" * 60)
    print(f"Target for adjacent surfaces: ≥ {TARGET_NORMAL}:1 (≥ {TARGET_PREFERRED}:1 preferred)")
    print(f"Target for body text contrast: ≥ 4.5:1 (WCAG AA)")
    print()

    if any_below_target:
        print("✗ Terracotta and brick surfaces fail the adjacency threshold.")
        print("  Recommended: do not place both visible in the same composition")
        print("  until either the terracotta hue shifts further toward")
        print("  salmon/amber (away from brick's pink-red), or the design")
        print("  inserts a separating element (hairline, paper gap, distinct")
        print("  surface depth).")
        return 1

    print("✓ Surfaces are programmatically distinguishable, but the contrast")
    print("  ratio is low enough that a real-device side-by-side at 30%/50%/100%")
    print("  brightness is still recommended before shipping any surface")
    print("  that places terracotta and brick visible in the same composition.")
    print()
    print("  Specifically check: outdoor sun-bleached screens, OLED black-")
    print("  point clipping at low brightness, and Spectrum Color Filter")
    print("  / iOS Color Filters accessibility settings.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
