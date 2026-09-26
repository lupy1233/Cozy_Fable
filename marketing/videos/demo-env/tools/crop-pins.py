#!/usr/bin/env python3
"""Decupeaza randarile brute (data/pins-raw/*.png) in "pini" JPG cu aspect ratio
variat (3:4, 1:1, 4:3, 2:3...) pe fundalul ivoire al scenei 3D → pins/<slug>.jpg.
Ilustratiile din apps/frontend/public/illustrations sunt aplatizate pe acelasi
fundal si, pentru pozele listate in ILLUSTRATION_FOR, inlocuiesc randarea.
Necesita Pillow (pip install pillow)."""
import json, os, shutil
from PIL import Image, ImageChops

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..'))
RAW = os.path.join(ROOT, 'data', 'pins-raw')
OUT = os.path.join(ROOT, 'pins')
ILLU_SRC = os.path.abspath(os.path.join(ROOT, '..', '..', '..', 'apps', 'frontend', 'public', 'illustrations'))
MAX_W = 900
BG_FALLBACK = (246, 242, 236)

# poza (slug) -> ilustratie; alese dupa sistem/material/culoare din seed
ILLUSTRATION_FOR = {
    '60f5cb8f7628f60bf79f08c9-a24-2-min': ('lemn-masiv', '4:3'),          # Crama cu rafturi din lemn masiv
    '688a230b4b50ae9ac2fbdf00-mg-5007-min': ('gola', '3:4'),             # Bucatarie gri deschis fara manere (GOLA)
    '688a230b57c24a5b44a8bae8-mg-5010-min': ('aventos', '1:1'),          # Insula de bucatarie ... AVENTOS
    '60f56420e98f2b3f5cfba60e-p03': ('maner', '3:4'),                    # Bucatarie alba in L (MANER)
    '60cc98eeb0a237457b9dc1c9-mg-0337-min': ('mdf-infoliat', '1:1'),     # Perete de dulapuri albe (MDF_INFOLIAT)
    '65c9087a4ccb405f868b3d8b-rgc6906-hdr': ('push', '3:4'),             # Dulap alb cu nisa TV (PUSH)
    '663b998f42b10f76153d6128-mg-4270-min': ('mdf-vopsit', '1:1'),       # Biblioteca alba langa dining (MDF_VOPSIT)
    '619cdf7e75d870658c7dc38b-bfd-min': ('pal', '4:3'),                  # Hol cu bancuta (PAL)
    '619cdf7eb263b6cd5a5dbe1e-cd-min': ('altul', '1:1'),                 # Colt de birou cu tabla de scris
    '619cdddd6f087ebfea7b37d9-anca4-min': ('glisante', '3:4'),           # Dulap cu usi glisante si nisa TV
    '60f55d2634d71956d82b89eb-p67': ('mdf-furnir', '4:3'),               # Blat de baie din lemn masiv
}

def ratio(a):
    w, h = a.split(':')
    return float(w) / float(h)

def fit(box, img_size, aspect, pad_frac):
    x0, y0, x1, y1 = box
    bw, bh = x1 - x0, y1 - y0
    pad = pad_frac * max(bw, bh)
    cw, ch = bw + 2 * pad, bh + 2 * pad
    if cw / ch < aspect:
        cw = ch * aspect
    else:
        ch = cw / aspect
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    return int(cx - cw / 2), int(cy - ch / 2), int(cx + cw / 2), int(cy + ch / 2)

def compose(src, inner, box, bg):
    """Copiaza din src doar zona 'inner' (fara colturile rotunjite), restul = bg."""
    out = Image.new('RGB', (box[2] - box[0], box[3] - box[1]), bg)
    ix0, iy0 = max(box[0], inner[0]), max(box[1], inner[1])
    ix1, iy1 = min(box[2], inner[2]), min(box[3], inner[3])
    if ix1 > ix0 and iy1 > iy0:
        out.paste(src.crop((ix0, iy0, ix1, iy1)), (ix0 - box[0], iy0 - box[1]))
    return out

# finisajele deschise ies gri-deschis sub lumina scenei → ridicam tonurile medii
# (gamma < 1); fundalul ivoire aproape nu se schimba (247 → ~249)
GAMMA = {'Alb': 0.72, 'Crem': 0.86}

def lift(img, finish):
    g = GAMMA.get(finish)
    if not g:
        return img
    lut = [round(255 * (v / 255) ** g) for v in range(256)]
    return img.point(lut * 3)

def save(img, path):
    if img.width > MAX_W:
        img = img.resize((MAX_W, round(img.height * MAX_W / img.width)), Image.LANCZOS)
    img.save(path, 'JPEG', quality=86, optimize=True, progressive=True)

def main():
    os.makedirs(OUT, exist_ok=True)
    manifest = json.load(open(os.path.join(RAW, 'manifest.json')))
    bg_seen = None
    n = 0
    for s in manifest:
        src = Image.open(os.path.join(RAW, s['slug'] + '.png')).convert('RGB')
        W, H = src.size
        bg = src.getpixel((W // 2, max(8, H // 60)))
        bg_seen = bg_seen or bg
        m = int(W * 0.025)
        inner = (m, m, W - m, H - m)
        diff = ImageChops.difference(src.crop(inner), Image.new('RGB', (inner[2] - inner[0], inner[3] - inner[1]), bg))
        bbox = diff.convert('L').point(lambda v: 255 if v > 14 else 0).getbbox()
        if not bbox:
            print('!! gol', s['slug']); continue
        bbox = (bbox[0] + m, bbox[1] + m, bbox[2] + m, bbox[3] + m)
        box = fit(bbox, (W, H), ratio(s['aspect']), 0.09)
        save(lift(compose(src, inner, box, bg), s.get('finish')), os.path.join(OUT, s['slug'] + '.jpg'))
        n += 1
    # ilustratii: copie de referinta + inlocuire pentru pozele din ILLUSTRATION_FOR
    bg = bg_seen or BG_FALLBACK
    os.makedirs(os.path.join(OUT, 'illustrations'), exist_ok=True)
    for f in sorted(os.listdir(ILLU_SRC)):
        if f.endswith('.png'):
            shutil.copy(os.path.join(ILLU_SRC, f), os.path.join(OUT, 'illustrations', f))
    for slug, (name, aspect) in ILLUSTRATION_FOR.items():
        il = Image.open(os.path.join(ILLU_SRC, name + '.png')).convert('RGBA')
        flat = Image.new('RGB', il.size, bg)
        flat.paste(il, (0, 0), il)
        bbox = il.getchannel('A').point(lambda v: 255 if v > 10 else 0).getbbox()
        box = fit(bbox, il.size, ratio(aspect), 0.16)
        # cutia poate depasi canvasul ilustratiei → marginea ramane bg
        cover = Image.new('RGB', (box[2] - box[0], box[3] - box[1]), bg)
        cover.paste(flat, (-box[0], -box[1]))
        save(cover, os.path.join(OUT, slug + '.jpg'))
        n += 1
    print(f'{n} pini scrisi in {OUT} (bg {bg})')

if __name__ == '__main__':
    main()
