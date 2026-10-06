#!/usr/bin/env python3
"""Draws EventBetter's icon assets into assets/.

A calendar page with three rising bars (numbered events adding up over
time) on the app's blue-to-violet accent gradient. Shapes only, no fonts.
Everything is drawn at 4x and downsampled for clean edges.

    python3 scripts/generate-icons.py
"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "assets"
SITE = ROOT / "website" / "public" / "assets"
STORE = ROOT / "assets" / "store"
SCALE = 4
GRADIENT = ((0x2F, 0x5B, 0xE6), (0x6E, 0x42, 0xD6))  # theme buttonFrom -> buttonTo
WHITE = (255, 255, 255, 255)


def gradient(size):
    """Diagonal (135deg) gradient, top-left to bottom-right."""
    img = Image.new("RGBA", (size, size))
    px = img.load()
    (r1, g1, b1), (r2, g2, b2) = GRADIENT
    for y in range(size):
        for x in range(size):
            t = (x + y) / (2 * (size - 1))
            px[x, y] = (round(r1 + (r2 - r1) * t), round(g1 + (g2 - g1) * t), round(b1 + (b2 - b1) * t), 255)
    return img


def glyph(size, box, color=WHITE, cutout=(0, 0, 0, 0)):
    """The calendar glyph inside `box` (fractions of size: left, top, right, bottom)."""
    s = size * SCALE
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    l, t, r, b = (v * s for v in box)
    w, h = r - l, b - t
    stroke = w * 0.085

    # Page outline with a solid header band.
    radius = w * 0.16
    d.rounded_rectangle((l, t + h * 0.08, r, b), radius=radius, fill=color)
    d.rounded_rectangle(
        (l + stroke, t + h * 0.08 + h * 0.24, r - stroke, b - stroke),
        radius=radius - stroke,
        fill=cutout,
    )
    # Binding rings.
    ring_w, ring_h = w * 0.09, h * 0.2
    for cx in (l + w * 0.3, r - w * 0.3):
        d.rounded_rectangle((cx - ring_w / 2, t, cx + ring_w / 2, t + ring_h), radius=ring_w / 2, fill=color)

    # Three rising bars on the page.
    floor = b - stroke - h * 0.1
    bar_w = w * 0.15
    gap = w * 0.08
    start = l + (w - (3 * bar_w + 2 * gap)) / 2
    for i, frac in enumerate((0.16, 0.27, 0.38)):
        x = start + i * (bar_w + gap)
        d.rounded_rectangle((x, floor - h * frac, x + bar_w, floor), radius=bar_w * 0.3, fill=color)

    return img.resize((size, size), Image.LANCZOS)


def on_gradient(size, box, rounded=None):
    base = gradient(size)
    base.alpha_composite(glyph(size, box))
    if rounded:
        mask = Image.new("L", (size * SCALE, size * SCALE), 0)
        ImageDraw.Draw(mask).rounded_rectangle((0, 0, size * SCALE, size * SCALE), radius=rounded * SCALE, fill=255)
        base.putalpha(mask.resize((size, size), Image.LANCZOS))
    return base


def font(size):
    # Pillow's bundled font (Aileron, CC0), so no font licensing questions.
    return ImageFont.load_default(size=size)


def feature_graphic():
    """Play Store feature graphic, 1024x500. No third-party trademarks."""
    w, h = 1024, 500
    img = Image.new("RGBA", (w, h))
    px = img.load()
    (r1, g1, b1), (r2, g2, b2) = (0x1A, 0x2A, 0x6E), (0x3A, 0x1E, 0x6E)
    for y in range(h):
        for x in range(w):
            t = (x / w * 0.7 + y / h * 0.3)
            px[x, y] = (round(r1 + (r2 - r1) * t), round(g1 + (g2 - g1) * t), round(b1 + (b2 - b1) * t), 255)

    # Soft light blobs, like the app's background.
    glow = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    for (cx, cy, rad, color) in ((140, 60, 260, (122, 162, 255, 70)), (900, 420, 300, (255, 143, 214, 55))):
        gd.ellipse((cx - rad, cy - rad, cx + rad, cy + rad), fill=color)
    from PIL import ImageFilter
    img.alpha_composite(glow.filter(ImageFilter.GaussianBlur(70)))

    tile = on_gradient(200, (0.24, 0.22, 0.76, 0.76), rounded=46)
    img.alpha_composite(tile, (84, 150))

    d = ImageDraw.Draw(img)
    d.text((330, 128), "EventBetter", font=font(76), fill=(255, 255, 255, 255))
    d.text((334, 222), "Every occurrence gets its own title", font=font(34), fill=(220, 226, 255, 255))

    # Three example occurrence chips. Translucent fills must be composited:
    # ImageDraw on RGBA overwrites pixels instead of blending them.
    f = font(26)
    labels = ("1st month over", "2nd month over", "3rd month over")
    chips = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    cd = ImageDraw.Draw(chips)
    for i, label in enumerate(labels):
        y = 292 + i * 56
        tw = d.textlength(label, font=f)
        cd.rounded_rectangle((334, y, 334 + tw + 36, y + 44), radius=14, fill=(255, 255, 255, 38), outline=(255, 255, 255, 110))
    img.alpha_composite(chips)
    d = ImageDraw.Draw(img)
    for i, label in enumerate(labels):
        d.text((352, 292 + i * 56 + 7), label, font=f, fill=(255, 255, 255, 255))
    return img


def main():
    # Legacy/full icon (also the Play Store listing icon base): full-bleed square.
    on_gradient(1024, (0.24, 0.22, 0.76, 0.76)).save(ASSETS / "icon.png")

    # Adaptive icon layers. Android masks to a circle/squircle and only the
    # central 66% (a circle) is guaranteed visible; this box's diagonal fits it.
    gradient(512).save(ASSETS / "android-icon-background.png")
    glyph(512, (0.28, 0.26, 0.72, 0.72)).save(ASSETS / "android-icon-foreground.png")
    # Android 13 themed icons: same shape, single color; the system tints it.
    glyph(432, (0.28, 0.26, 0.72, 0.72)).save(ASSETS / "android-icon-monochrome.png")

    # Splash: the icon as a rounded tile, centered on the splash background color.
    on_gradient(1024, (0.24, 0.22, 0.76, 0.76), rounded=230).save(ASSETS / "splash-icon.png")

    # Status-bar notification icon: white on transparent, 96x96 as Expo asks.
    glyph(96, (0.12, 0.1, 0.88, 0.9)).save(ASSETS / "notification-icon.png")

    # Website favicon and touch icons, plus the 120x120 logo Google's OAuth
    # consent screen asks for.
    SITE.mkdir(parents=True, exist_ok=True)
    for size in (32, 180, 512):
        on_gradient(size, (0.24, 0.22, 0.76, 0.76), rounded=size * 0.22).save(SITE / f"icon-{size}.png")
    on_gradient(120, (0.24, 0.22, 0.76, 0.76)).save(ASSETS / "oauth-logo-120.png")

    # Play Store listing: 512x512 icon (Play applies its own mask) and the
    # 1024x500 feature graphic.
    STORE.mkdir(parents=True, exist_ok=True)
    on_gradient(512, (0.24, 0.22, 0.76, 0.76)).save(STORE / "play-icon-512.png")
    feature_graphic().convert("RGB").save(STORE / "feature-graphic.png")

    print("Wrote app icons to assets/, store graphics to assets/store/ and website icons to website/public/assets/")


if __name__ == "__main__":
    main()
