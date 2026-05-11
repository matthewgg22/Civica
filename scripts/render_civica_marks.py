#!/usr/bin/env python3
"""
Render the Civica Threshold C mark for AppIcon + LaunchLogo by
tracing the C as a single closed polygon, then filling it once.

The C boundary, traced CCW from outer top-right of the cut:
  1. Outer ellipse left-half (over top → left → under bottom)
     ending at outer-bottom-right of cut
  2. Bottom terminal cut: horizontal line to (CX, term_bot_y) where
     CX is the bottommost point of the inner ellipse
  3. Inner ellipse left-half (under bottom → left → over top)
     from (CX, term_bot_y) around the left to (CX, term_top_y)
  4. PIL auto-closes via the top terminal cut

Geometry constraint: ry_inner = CY - term_top_y (so the inner
ellipse's topmost/bottommost points land EXACTLY on the terminal
cuts, giving a horizontal tangent there for a smooth transition).
For wide-aperture variants like Threshold, this auto-thins swH
below its spec value. Visual difference is sub-pixel.
"""
import json
import math
from pathlib import Path
from PIL import Image, ImageDraw

REPO_ROOT = Path('/Users/matthewgreer-gentis/Developer/Civica')
APPICON_PATH = REPO_ROOT / 'Civica/Assets.xcassets/AppIcon.appiconset/AppIcon.png'
LAUNCH_LOGO_DIR = REPO_ROOT / 'Civica/Assets.xcassets/LaunchLogo.imageset'

# HANDOFF palette
BRICK_RGB = (0x9C, 0x3A, 0x24)
PAPER_RGB = (0xF5, 0xF2, 0xEC)

# Threshold variant geometry — canvas-100 units
CX, CY = 50.0, 50.0
RX_OUTER, RY_OUTER = 44.0, 51.25
TERM_TOP_RATIO = 0.74
TERM_BOT_RATIO = 0.74
SW_V = 18.5
SW_H_SPEC = 16.5  # spec value; auto-thinned at render time if too thick

# Bounding box of the C (full geometric extent including overshoot)
BBOX_WIDTH = 2 * RX_OUTER
BBOX_HEIGHT = 2 * RY_OUTER


def compute_geometry() -> tuple[float, float, float, float]:
    """Return (rx_inner, ry_inner, term_top_y, term_bot_y).

    ry_inner is set to the larger of:
      - The spec value (RY_OUTER - SW_H_SPEC)
      - max(CY - term_top_y, term_bot_y - CY) — so the inner ellipse's
        topmost/bottommost points land exactly on the terminal cuts.
    """
    term_top_y = CY - TERM_TOP_RATIO * RY_OUTER
    term_bot_y = CY + TERM_BOT_RATIO * RY_OUTER

    spec_ry_inner = RY_OUTER - SW_H_SPEC
    required_ry_inner = max(CY - term_top_y, term_bot_y - CY)
    ry_inner = max(spec_ry_inner, required_ry_inner)
    rx_inner = RX_OUTER - SW_V
    return rx_inner, ry_inner, term_top_y, term_bot_y


def x_on_ellipse_right(y: float, cx: float, cy: float, rx: float, ry: float) -> float:
    dy = (y - cy) / ry
    dy = max(-1.0, min(1.0, dy))
    return cx + rx * math.sqrt(1.0 - dy * dy)


def build_c_polygon() -> list[tuple[float, float]]:
    """Return the C-shape boundary as (x, y) points in canvas-100 units."""
    rx_inner, ry_inner, term_top_y, term_bot_y = compute_geometry()

    # Right-side intersections with the outer ellipse at the terminal cuts.
    ot_x = x_on_ellipse_right(term_top_y, CX, CY, RX_OUTER, RY_OUTER)
    ob_x = x_on_ellipse_right(term_bot_y, CX, CY, RX_OUTER, RY_OUTER)

    # The inner ellipse's rightmost extent at the terminal y-values.
    # Because ry_inner is sized so the inner ellipse's top/bottom land
    # exactly on the terminal cuts (or beyond), the right intersection
    # is essentially at CX (for the symmetric Threshold case).
    it_x = x_on_ellipse_right(term_top_y, CX, CY, rx_inner, ry_inner)
    ib_x = x_on_ellipse_right(term_bot_y, CX, CY, rx_inner, ry_inner)

    points: list[tuple[float, float]] = []

    # 1. Start at outer top-right corner of the mouth
    points.append((ot_x, term_top_y))

    # 2. Outer ellipse: trace from top-right CCW the long way around
    #    (over top, around left, under bottom) to bottom-right.
    theta_top_outer = math.asin((term_top_y - CY) / RY_OUTER)
    theta_bot_outer = math.asin((term_bot_y - CY) / RY_OUTER)
    n_outer = 240
    for i in range(1, n_outer + 1):
        t = i / n_outer
        theta = theta_top_outer + t * ((theta_bot_outer - 2 * math.pi) - theta_top_outer)
        x = CX + RX_OUTER * math.cos(theta)
        y = CY + RY_OUTER * math.sin(theta)
        points.append((x, y))

    # 3. Bottom terminal cut: horizontal line from (ob_x, term_bot_y)
    #    to (ib_x, term_bot_y). When ry_inner exactly equals
    #    term_bot_y - CY, ib_x == CX (tangent at the bottom).
    points.append((ib_x, term_bot_y))

    # 4. Inner ellipse: trace from bottom-right CW the long way around
    #    (around left side) to top-right. We parameterize by going
    #    "the short way" around the LEFT of the ellipse from the
    #    bottommost point to the topmost point: θ from π/2 to 3π/2.
    theta_start = math.asin((term_bot_y - CY) / ry_inner)  # in [-π/2, π/2]
    # If term_bot_y >= CY + ry_inner, theta_start clamps to π/2 (bottom).
    # Otherwise it's slightly less. We want to traverse from theta_start
    # going CCW (in standard orientation, which is "right-side-up" in
    # math coords but goes through the BOTTOM in screen coords) around
    # the left to the matching theta_end at the top.
    theta_end = math.asin((term_top_y - CY) / ry_inner)  # in [-π/2, π/2]
    # Go from theta_start (lower-right of inner ellipse) increasing θ
    # through π/2 (bottom), π (leftmost), 3π/2 (top), and end at
    # 2π + theta_end (which is the upper-right point matching it_x).
    n_inner = 240
    for i in range(1, n_inner + 1):
        t = i / n_inner
        theta = theta_start + t * ((2 * math.pi + theta_end) - theta_start)
        x = CX + rx_inner * math.cos(theta)
        y = CY + ry_inner * math.sin(theta)
        points.append((x, y))

    # 5. PIL auto-closes the polygon back to point 1 — top terminal cut.
    return points


def render_c_to_image(image_size: int, fill_rgb: tuple[int, int, int],
                      bg_rgba: tuple[int, int, int, int],
                      mark_ratio: float = 1.0) -> Image.Image:
    """Render the C polygon centered in a square image of given size."""
    supersample = 4
    canvas_size = image_size * supersample
    img = Image.new('RGBA', (canvas_size, canvas_size), bg_rgba)
    draw = ImageDraw.Draw(img)

    target_size = image_size * mark_ratio
    scale = target_size / max(BBOX_WIDTH, BBOX_HEIGHT)
    drawn_width = BBOX_WIDTH * scale
    drawn_height = BBOX_HEIGHT * scale
    offset_x = (image_size - drawn_width) / 2 - (CX - RX_OUTER) * scale
    offset_y = (image_size - drawn_height) / 2 - (CY - RY_OUTER) * scale

    polygon_canvas = build_c_polygon()
    polygon_px = [
        ((x * scale + offset_x) * supersample, (y * scale + offset_y) * supersample)
        for x, y in polygon_canvas
    ]

    draw.polygon(polygon_px, fill=fill_rgb + (255,))

    return img.resize((image_size, image_size), Image.Resampling.LANCZOS)


def render_appicon() -> None:
    APPICON_PATH.parent.mkdir(parents=True, exist_ok=True)
    img = render_c_to_image(
        image_size=1024,
        fill_rgb=PAPER_RGB,
        bg_rgba=BRICK_RGB + (255,),
        mark_ratio=0.58,
    )
    img.convert('RGB').save(APPICON_PATH, 'PNG', optimize=True)
    print(f'wrote {APPICON_PATH}')


def render_launch_logo() -> None:
    LAUNCH_LOGO_DIR.mkdir(parents=True, exist_ok=True)
    intrinsic = 200
    scales = [1, 2, 3]
    images_manifest = []
    for scale_factor in scales:
        pixels = intrinsic * scale_factor
        img = render_c_to_image(
            image_size=pixels,
            fill_rgb=BRICK_RGB,
            bg_rgba=(0, 0, 0, 0),
            mark_ratio=1.0,
        )
        suffix = '' if scale_factor == 1 else f'@{scale_factor}x'
        filename = f'LaunchLogo{suffix}.png'
        img.save(LAUNCH_LOGO_DIR / filename, 'PNG', optimize=True)
        images_manifest.append({
            'filename': filename,
            'idiom': 'universal',
            'scale': f'{scale_factor}x',
        })
    contents = {
        'images': images_manifest,
        'info': {'author': 'xcode', 'version': 1},
    }
    (LAUNCH_LOGO_DIR / 'Contents.json').write_text(json.dumps(contents, indent=2))
    print(f'wrote {LAUNCH_LOGO_DIR}/ ({len(scales)} resolutions)')


if __name__ == '__main__':
    render_appicon()
    render_launch_logo()
