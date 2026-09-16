# -*- coding: utf-8 -*-
"""Bake the 9 wan faces to PNG so all 43 tile faces are plain images.

The SVG path needed KaiTi at runtime; most Android devices lack it and the
mini-program canvas cannot load a custom font reliably, so the glyphs are
rasterised here once instead.

Geometry mirrors wanFace() in app.js and the .wan-* rules in styles-v59.css:
viewBox 0 0 100 137 letterboxed into the 1.4-ratio art box, number baseline at
y=58, 萬 baseline at y=122, drawn as shadow -> white highlight -> main fill.
"""
from PIL import Image, ImageDraw, ImageFont
import os

W, H, SS = 187, 255, 3
FONT = 'C:/Windows/Fonts/simkai.ttf'
OUT = os.path.join(os.path.dirname(__file__), '..', 'assets', 'tiles-face')
CHARS = ['', '一', '二', '三', '四', '伍', '六', '七', '八', '九']

# design space is the 100 x 140 art box; the 137-tall viewBox is centred in it
BOX_W, BOX_H, VIEW_H = 100.0, 140.0, 137.0
PAD = (BOX_H - VIEW_H) / 2
sx, sy = W * SS / BOX_W, H * SS / BOX_H

NUM = dict(size=46, y=58, fill=(20, 20, 20))
WAN = dict(size=42, y=122, fill=(193, 40, 28))
SHADOW = (56, 34, 26, 117)          # rgba(56,34,26,.46)
HILITE = (255, 255, 255, 255)


def draw_glyph(layer, ch, spec):
    d = ImageDraw.Draw(layer)
    font = ImageFont.truetype(FONT, int(round(spec['size'] * sx)))
    stroke = max(1, int(round(spec['size'] * sx * 0.022)))  # font-weight:900 on a regular face
    base_y = (spec['y'] + PAD) * sy
    for dx, dy, fill in ((0.5, 0.6, SHADOW), (-0.4, -0.4, HILITE), (0, 0, spec['fill'] + (255,))):
        d.text((50 * sx + dx * sx, base_y + dy * sy), ch, font=font, fill=fill,
               anchor='ms', stroke_width=stroke, stroke_fill=fill)


for n in range(1, 10):
    canvas = Image.new('RGB', (W * SS, H * SS), (255, 255, 255))
    layer = Image.new('RGBA', canvas.size, (255, 255, 255, 0))
    draw_glyph(layer, CHARS[n], NUM)
    draw_glyph(layer, '萬', WAN)
    canvas = Image.alpha_composite(canvas.convert('RGBA'), layer).convert('RGB')
    canvas.resize((W, H), Image.Resampling.LANCZOS).save(os.path.join(OUT, 'wan-%d.png' % n))
    print('wan-%d.png' % n, CHARS[n])
