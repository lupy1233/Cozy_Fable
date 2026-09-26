#!/usr/bin/env python3
"""Fisierele atasate la cererea din fisa de lucru (claim 861163e7): o schita de
mana a dormitorului (plan cotat) si o poza de referinta pentru dulap."""
import os, random
from PIL import Image, ImageDraw, ImageFont, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', 'fixtures')
os.makedirs(OUT, exist_ok=True)
random.seed(7)
FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
W, H = 1600, 1300
PAPER, GRID, INK = (250, 247, 240), (226, 232, 238), (58, 62, 72)

img = Image.new('RGB', (W, H), PAPER)
d = ImageDraw.Draw(img)
for x in range(0, W, 40):
    d.line([(x, 0), (x, H)], fill=GRID, width=1)
for y in range(0, H, 40):
    d.line([(0, y), (W, y)], fill=GRID, width=1)

def wobble(p0, p1, width=4, seg=24):
    (x0, y0), (x1, y1) = p0, p1
    pts = []
    for i in range(seg + 1):
        t = i / seg
        pts.append((x0 + (x1 - x0) * t + random.uniform(-1.6, 1.6), y0 + (y1 - y0) * t + random.uniform(-1.6, 1.6)))
    d.line(pts, fill=INK, width=width, joint='curve')

def rect(x0, y0, x1, y1, width=4):
    wobble((x0, y0), (x1, y0), width); wobble((x1, y0), (x1, y1), width)
    wobble((x1, y1), (x0, y1), width); wobble((x0, y1), (x0, y0), width)

f = lambda s: ImageFont.truetype(FONT, s)
def text(xy, s, size=30, anchor='mm'):
    d.text(xy, s, font=f(size), fill=INK, anchor=anchor)

# camera 380 x 320 cm → 1 cm = 3 px
ox, oy, S = 230, 180, 3
rw, rh = 380 * S, 320 * S
rect(ox, oy, ox + rw, oy + rh, 6)
# fereastra pe peretele de sus
d.rectangle([ox + 150 * S, oy - 6, ox + 270 * S, oy + 6], fill=PAPER)
wobble((ox + 150 * S, oy - 8), (ox + 270 * S, oy - 8), 2); wobble((ox + 150 * S, oy + 8), (ox + 270 * S, oy + 8), 2)
text((ox + 210 * S, oy - 34), 'fereastră 120', 24)
# usa pe peretele de jos (x 150..230), se deschide spre interior
d.rectangle([ox + 150 * S, oy + rh - 6, ox + 230 * S, oy + rh + 6], fill=PAPER)
d.arc([ox + 150 * S - 80 * S, oy + rh - 80 * S, ox + 150 * S + 80 * S, oy + rh + 80 * S], 270, 360, fill=INK, width=3)
wobble((ox + 150 * S, oy + rh), (ox + 150 * S, oy + rh - 80 * S), 3)
text((ox + 190 * S, oy + rh + 34), 'ușă 80', 24)
# dulap pe peretele stang: 240 x 60
rect(ox + 8, oy + 40 * S, ox + 60 * S, oy + 280 * S, 4)
for k in (120, 200):
    wobble((ox + 8, oy + k * S), (ox + 60 * S, oy + k * S), 2)
text((ox + 32 * S, oy + 160 * S), 'DULAP', 26)
text((ox + 32 * S, oy + 175 * S), 'uși glisante', 20)
# pat 160 x 200 centrat pe peretele din dreapta
bx0, by0 = ox + rw - 200 * S, oy + 80 * S
rect(bx0, by0, ox + rw - 8, by0 + 160 * S, 4)
text((bx0 + 100 * S, by0 + 80 * S), 'PAT 160×200', 26)
# noptiere 45 x 40
rect(ox + rw - 45 * S, by0 - 44 * S, ox + rw - 8, by0 - 4 * S, 3)
rect(ox + rw - 45 * S, by0 + 164 * S, ox + rw - 8, by0 + 204 * S, 3)
text((ox + rw - 120 * S, by0 - 24 * S), 'noptieră 45', 20)
text((ox + rw - 120 * S, by0 + 184 * S), 'noptieră 45', 20)

# cote
def dim_h(x0, x1, y, label):
    wobble((x0, y), (x1, y), 2)
    wobble((x0, y - 12), (x0, y + 12), 2); wobble((x1, y - 12), (x1, y + 12), 2)
    text(((x0 + x1) / 2, y - 22), label, 28)
def dim_v(x, y0, y1, label):
    wobble((x, y0), (x, y1), 2)
    wobble((x - 12, y0), (x + 12, y0), 2); wobble((x - 12, y1), (x + 12, y1), 2)
    img2 = Image.new('RGBA', (220, 50), (0, 0, 0, 0))
    ImageDraw.Draw(img2).text((110, 25), label, font=f(28), fill=INK, anchor='mm')
    img2 = img2.rotate(90, expand=True)
    img.paste(img2, (int(x - 70), int((y0 + y1) / 2 - 110)), img2)
dim_h(ox, ox + rw, oy + rh + 110, '380 cm')
dim_v(ox - 70, oy, oy + rh, '320 cm')
dim_v(ox + 60 * S + 95, oy + 40 * S, oy + 280 * S, 'dulap 240')
text((ox + 32 * S, oy + 25 * S), 'h 260', 22)
text((W - 60, 70), 'Ana P. — sept. 2026', 26, 'rm')
text((80, 70), 'Schiță dormitor (vedere de sus)', 36, 'lm')
img = img.filter(ImageFilter.GaussianBlur(0.6))
img.save(os.path.join(OUT, 'schita-dormitor.png'), optimize=True)
print('fixtures/schita-dormitor.png')
