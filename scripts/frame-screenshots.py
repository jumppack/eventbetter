#!/usr/bin/env python3
"""Turns raw phone screenshots into Play Store screenshots.

Play rejects phone screenshots taller than 2:1, and modern phones capture
about 20:9, so each one is placed on a 1080x1920 (9:16) canvas with the
app's gradient behind it and a short caption above.

    python3 scripts/frame-screenshots.py

Reads screenshots/raw/ (gitignored) in filename order and writes
assets/store/screenshots/01.png, 02.png, ... Captions come from
screenshots/raw/captions.txt (one per line, same order) if it exists,
otherwise from CAPTIONS below.
"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "screenshots" / "raw"
OUT = ROOT / "assets" / "store" / "screenshots"
W, H = 1080, 1920
CAPTIONS = [
    "See how far along every recurring event is",
    "Every occurrence gets its own title",
    "Live preview as you type",
    "Title templates you control",
    "Reminders the day before",
    "Light and dark mode",
]


def font(size):
    # Pillow's bundled font (Aileron, CC0).
    return ImageFont.load_default(size=size)


def background():
    img = Image.new("RGBA", (W, H))
    px = img.load()
    (r1, g1, b1), (r2, g2, b2) = (0x1A, 0x2A, 0x6E), (0x3A, 0x1E, 0x6E)
    for y in range(H):
        for x in range(W):
            t = x / W * 0.3 + y / H * 0.7
            px[x, y] = (round(r1 + (r2 - r1) * t), round(g1 + (g2 - g1) * t), round(b1 + (b2 - b1) * t), 255)
    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.ellipse((-260, -200, 520, 580), fill=(122, 162, 255, 70))
    gd.ellipse((600, 1300, 1400, 2100), fill=(255, 143, 214, 55))
    img.alpha_composite(glow.filter(ImageFilter.GaussianBlur(90)))
    return img


def wrap(draw, text, fnt, width):
    lines, line = [], ""
    for word in text.split():
        trial = f"{line} {word}".strip()
        if draw.textlength(trial, font=fnt) <= width:
            line = trial
        else:
            lines.append(line)
            line = word
    return lines + [line]


def frame(shot, caption):
    img = background()
    d = ImageDraw.Draw(img)

    f = font(56)
    y = 110
    for line in wrap(d, caption, f, W - 160):
        tw = d.textlength(line, font=f)
        d.text(((W - tw) / 2, y), line, font=f, fill=(255, 255, 255, 255))
        y += 70

    # Screenshot scaled to the space below the caption, with rounded corners
    # and a soft shadow.
    top = max(y + 50, 330)
    max_h, max_w = H - top - 80, W - 160
    scale = min(max_h / shot.height, max_w / shot.width)
    sw, sh = round(shot.width * scale), round(shot.height * scale)
    shot = shot.convert("RGBA").resize((sw, sh), Image.LANCZOS)
    radius = round(sw * 0.06)
    mask = Image.new("L", (sw, sh), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, sw - 1, sh - 1), radius=radius, fill=255)
    shot.putalpha(mask)

    x = (W - sw) // 2
    shadow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle((x, top + 18, x + sw, top + 18 + sh), radius=radius, fill=(0, 0, 0, 120))
    img.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(28)))
    img.alpha_composite(shot, (x, top))
    return img.convert("RGB")


def main():
    shots = sorted(p for p in RAW.glob("*") if p.suffix.lower() in (".png", ".jpg", ".jpeg"))
    if not shots:
        raise SystemExit(f"No screenshots in {RAW}")
    captions_file = RAW / "captions.txt"
    captions = (
        [l.strip() for l in captions_file.read_text().splitlines() if l.strip()]
        if captions_file.exists()
        else CAPTIONS
    )
    OUT.mkdir(parents=True, exist_ok=True)
    for i, path in enumerate(shots, 1):
        caption = captions[i - 1] if i <= len(captions) else ""
        frame(Image.open(path), caption).save(OUT / f"{i:02d}.png")
        print(f"{path.name} -> {OUT.relative_to(ROOT)}/{i:02d}.png  ({caption})")


if __name__ == "__main__":
    main()
