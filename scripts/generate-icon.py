#!/usr/bin/env python3
"""Generate the DpsApp desktop icon without external image dependencies.

Outputs:
  - src-tauri/icons/icon.png  (1024x1024 RGBA PNG)
  - src-tauri/icons/icon.ico  (256x256 PNG-in-ICO)

The vector source is also kept as src-tauri/icons/icon.svg for human editing.
This script hand-rasterizes the same visual identity: a TFT-like hex board,
gold frame, cyan DPS pulse, and red crit marker.
"""
from __future__ import annotations

import math
import struct
import zlib
from pathlib import Path
from typing import Iterable, Sequence

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "src-tauri" / "icons"
PNG_PATH = OUT_DIR / "icon.png"
ICO_PATH = OUT_DIR / "icon.ico"
W = H = 1024

Color = tuple[int, int, int, int]
Point = tuple[float, float]


def clamp(v: float, lo: float = 0.0, hi: float = 1.0) -> float:
    return max(lo, min(hi, v))


def mix(a: float, b: float, t: float) -> float:
    return a + (b - a) * t


def hex_to_rgba(s: str, a: float = 1.0) -> Color:
    s = s.lstrip("#")
    return (int(s[0:2], 16), int(s[2:4], 16), int(s[4:6], 16), int(clamp(a) * 255 + 0.5))


def lerp_color(c1: Color, c2: Color, t: float) -> Color:
    t = clamp(t)
    return tuple(int(mix(c1[i], c2[i], t) + 0.5) for i in range(4))  # type: ignore[return-value]


def blend(dst: bytearray, idx: int, src: Color) -> None:
    sr, sg, sb, sa = src
    if sa <= 0:
        return
    if sa >= 255:
        dst[idx:idx + 4] = bytes((sr, sg, sb, 255))
        return
    dr, dg, db, da = dst[idx], dst[idx + 1], dst[idx + 2], dst[idx + 3]
    a = sa / 255.0
    inv = 1.0 - a
    out_a = a + (da / 255.0) * inv
    if out_a <= 0:
        return
    dst[idx] = int((sr * a + dr * (da / 255.0) * inv) / out_a + 0.5)
    dst[idx + 1] = int((sg * a + dg * (da / 255.0) * inv) / out_a + 0.5)
    dst[idx + 2] = int((sb * a + db * (da / 255.0) * inv) / out_a + 0.5)
    dst[idx + 3] = int(out_a * 255 + 0.5)


def rounded_rect_alpha(x: float, y: float, left: float, top: float, right: float, bottom: float, r: float) -> float:
    # Signed distance to rounded rectangle. Negative is inside.
    cx = (left + right) / 2
    cy = (top + bottom) / 2
    hx = (right - left) / 2 - r
    hy = (bottom - top) / 2 - r
    qx = abs(x - cx) - hx
    qy = abs(y - cy) - hy
    outside = math.hypot(max(qx, 0), max(qy, 0)) - r
    inside = min(max(qx, qy), 0)
    d = outside + inside
    return clamp(0.5 - d)


def point_in_poly(x: float, y: float, pts: Sequence[Point]) -> bool:
    inside = False
    j = len(pts) - 1
    for i, (xi, yi) in enumerate(pts):
        xj, yj = pts[j]
        if ((yi > y) != (yj > y)) and (x < (xj - xi) * (y - yi) / ((yj - yi) or 1e-9) + xi):
            inside = not inside
        j = i
    return inside


def dist_to_segment(px: float, py: float, ax: float, ay: float, bx: float, by: float) -> float:
    vx, vy = bx - ax, by - ay
    wx, wy = px - ax, py - ay
    denom = vx * vx + vy * vy
    if denom <= 1e-9:
        return math.hypot(px - ax, py - ay)
    t = clamp((wx * vx + wy * vy) / denom)
    qx, qy = ax + t * vx, ay + t * vy
    return math.hypot(px - qx, py - qy)


def dist_to_polyline(px: float, py: float, pts: Sequence[Point]) -> float:
    return min(dist_to_segment(px, py, *pts[i], *pts[i + 1]) for i in range(len(pts) - 1))


def dist_to_polygon_edges(px: float, py: float, pts: Sequence[Point]) -> float:
    return min(dist_to_segment(px, py, *pts[i], *pts[(i + 1) % len(pts)]) for i in range(len(pts)))


def draw_poly(img: bytearray, pts: Sequence[Point], fill, bbox: tuple[int, int, int, int] | None = None) -> None:
    if bbox is None:
        xs, ys = [p[0] for p in pts], [p[1] for p in pts]
        bbox = (max(0, int(min(xs)) - 2), max(0, int(min(ys)) - 2), min(W, int(max(xs)) + 3), min(H, int(max(ys)) + 3))
    x0, y0, x1, y1 = bbox
    for y in range(y0, y1):
        for x in range(x0, x1):
            px, py = x + 0.5, y + 0.5
            if point_in_poly(px, py, pts):
                d = dist_to_polygon_edges(px, py, pts)
                aa = clamp(d + 0.5)
                col = fill(px, py) if callable(fill) else fill
                if aa < 1:
                    col = (col[0], col[1], col[2], int(col[3] * aa))
                blend(img, (y * W + x) * 4, col)


def draw_line(img: bytearray, pts: Sequence[Point], width: float, color, bbox_pad: int = 80) -> None:
    xs, ys = [p[0] for p in pts], [p[1] for p in pts]
    x0 = max(0, int(min(xs) - width / 2 - bbox_pad))
    y0 = max(0, int(min(ys) - width / 2 - bbox_pad))
    x1 = min(W, int(max(xs) + width / 2 + bbox_pad))
    y1 = min(H, int(max(ys) + width / 2 + bbox_pad))
    radius = width / 2
    for y in range(y0, y1):
        for x in range(x0, x1):
            px, py = x + 0.5, y + 0.5
            d = dist_to_polyline(px, py, pts)
            aa = clamp(radius + 0.5 - d)
            if aa <= 0:
                continue
            col = color(px, py) if callable(color) else color
            if aa < 1:
                col = (col[0], col[1], col[2], int(col[3] * aa))
            blend(img, (y * W + x) * 4, col)


def cubic(p0: Point, p1: Point, p2: Point, p3: Point, n: int = 34) -> list[Point]:
    out: list[Point] = []
    for i in range(n + 1):
        t = i / n
        u = 1 - t
        x = u**3 * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t**3 * p3[0]
        y = u**3 * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t**3 * p3[1]
        out.append((x, y))
    return out


def png_bytes(width: int, height: int, rgba: bytes) -> bytes:
    def chunk(kind: bytes, data: bytes) -> bytes:
        return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data) & 0xFFFFFFFF)

    raw = bytearray()
    stride = width * 4
    for y in range(height):
        raw.append(0)  # filter type 0
        raw.extend(rgba[y * stride:(y + 1) * stride])
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)) + chunk(b"IDAT", zlib.compress(bytes(raw), 9)) + chunk(b"IEND", b"")


def downsample_box(src: bytearray, src_w: int, src_h: int, dst_w: int, dst_h: int) -> bytearray:
    sx = src_w // dst_w
    sy = src_h // dst_h
    out = bytearray(dst_w * dst_h * 4)
    for y in range(dst_h):
        for x in range(dst_w):
            acc = [0, 0, 0, 0]
            count = 0
            for yy in range(y * sy, (y + 1) * sy):
                for xx in range(x * sx, (x + 1) * sx):
                    i = (yy * src_w + xx) * 4
                    for c in range(4):
                        acc[c] += src[i + c]
                    count += 1
            j = (y * dst_w + x) * 4
            for c in range(4):
                out[j + c] = acc[c] // count
    return out


def write_ico(path: Path, png: bytes, size: int = 256) -> None:
    # ICO stores 256 as 0 in directory byte.
    header = struct.pack("<HHH", 0, 1, 1)
    entry = struct.pack("<BBBBHHII", 0 if size == 256 else size, 0 if size == 256 else size, 0, 0, 1, 32, len(png), 6 + 16)
    path.write_bytes(header + entry + png)


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    img = bytearray(W * H * 4)

    # Background rounded tile with transparent outer corners.
    bg0 = hex_to_rgba("#31224c")
    bg1 = hex_to_rgba("#151126")
    bg2 = hex_to_rgba("#07060d")
    for y in range(H):
        for x in range(W):
            px, py = x + 0.5, y + 0.5
            a = rounded_rect_alpha(px, py, 64, 64, 960, 960, 218)
            if a <= 0:
                continue
            # Radial gradient centered high-left, icon-like highlight.
            r = math.hypot((px - 348) / 720, (py - 250) / 720)
            if r < 0.45:
                c = lerp_color(bg0, bg1, r / 0.45)
            else:
                c = lerp_color(bg1, bg2, (r - 0.45) / 0.65)
            blend(img, (y * W + x) * 4, (c[0], c[1], c[2], int(255 * a)))

    # Quiet chess/hex board grid.
    grid = (110, 104, 138, 36)
    for seg in [((192, 512), (832, 512)), ((512, 192), (512, 832)), ((260, 318), (764, 706)), ((764, 318), (260, 706))]:
        draw_line(img, seg, 6, grid, bbox_pad=8)

    outer = [(512, 122), (824, 302), (824, 722), (512, 902), (200, 722), (200, 302)]
    inner = [(512, 184), (768, 332), (768, 692), (512, 840), (256, 692), (256, 332)]

    # Shadow.
    shadow = [(x, y + 28) for x, y in outer]
    draw_poly(img, shadow, (0, 0, 0, 90), (160, 150, 870, 950))

    gold1, gold2, gold3 = hex_to_rgba("#f6d37a"), hex_to_rgba("#c89b3c"), hex_to_rgba("#7b5218")

    def gold_grad(px: float, py: float) -> Color:
        t = clamp((px * 0.35 + py * 0.65 - 170) / 760)
        return lerp_color(gold1, gold2 if t < 0.5 else gold3, t * 2 if t < 0.5 else (t - 0.5) * 2)

    draw_poly(img, outer, lambda px, py: gold_grad(px, py), (170, 90, 860, 930))
    # Cut inner fill to create ring + center.
    draw_poly(img, [(512, 160), (790, 320), (790, 704), (512, 864), (234, 704), (234, 320)], hex_to_rgba("#11101d"), (220, 150, 805, 875))
    draw_poly(img, inner, hex_to_rgba("#3a2a55"), (240, 170, 785, 855))
    draw_poly(img, [(512, 205), (746, 340), (746, 684), (512, 819), (278, 684), (278, 340)], hex_to_rgba("#171229"), (275, 200, 750, 825))

    # DPS pulse path.
    pulse = []
    parts = [
        ((278, 612), (341, 612), (350, 448), (406, 448)),
        ((406, 448), (464, 448), (471, 690), (528, 690)),
        ((528, 690), (586, 690), (595, 337), (666, 337)),
        ((666, 337), (710, 337), (725, 451), (746, 512)),
    ]
    for part in parts:
        pts = cubic(*part, n=30)
        if pulse:
            pts = pts[1:]
        pulse.extend(pts)

    cyan1, cyan2, cyan3 = hex_to_rgba("#48f2ff"), hex_to_rgba("#3ea6ff"), hex_to_rgba("#9b5cff")

    def cyan_grad(px: float, py: float) -> Color:
        t = clamp((px - 278 + (690 - py) * 0.25) / 550)
        return lerp_color(cyan1, cyan2 if t < 0.58 else cyan3, t / 0.58 if t < 0.58 else (t - 0.58) / 0.42)

    # Glow approximation: draw translucent wider strokes first.
    draw_line(img, pulse, 92, lambda px, py: (*cyan_grad(px, py)[:3], 44), bbox_pad=90)
    draw_line(img, pulse, 58, cyan_grad, bbox_pad=70)
    draw_line(img, pulse, 18, (232, 251, 255, 224), bbox_pad=30)

    # Red crit marker polygon.
    crit = [(736, 238), (812, 328), (766, 434), (656, 424), (610, 322)]
    red1, red2 = hex_to_rgba("#ff8a70"), hex_to_rgba("#e6534a")

    def red_grad(px: float, py: float) -> Color:
        return lerp_color(red1, red2, clamp((py - 238 + px - 610) / 360))

    # Stroke then fill.
    draw_poly(img, crit, hex_to_rgba("#ffd0c4"), (590, 215, 835, 455))
    crit_inner = [(735, 260), (790, 330), (755, 410), (670, 402), (634, 326)]
    draw_poly(img, crit_inner, red_grad, (625, 255, 795, 415))
    draw_line(img, [(708, 308), (748, 350)], 16, (255, 242, 236, 235), bbox_pad=20)
    draw_line(img, [(751, 306), (708, 350)], 16, (255, 242, 236, 235), bbox_pad=20)

    # Lower reticle needle.
    tri = [(512, 738), (560, 812), (464, 812)]
    draw_poly(img, tri, lambda px, py: gold_grad(px, py), (455, 730, 570, 820))

    png = png_bytes(W, H, bytes(img))
    PNG_PATH.write_bytes(png)

    small = downsample_box(img, W, H, 256, 256)
    small_png = png_bytes(256, 256, bytes(small))
    write_ico(ICO_PATH, small_png, 256)

    print(f"wrote {PNG_PATH} ({len(png):,} bytes)")
    print(f"wrote {ICO_PATH} ({len(small_png):,} byte PNG payload)")


if __name__ == "__main__":
    main()
