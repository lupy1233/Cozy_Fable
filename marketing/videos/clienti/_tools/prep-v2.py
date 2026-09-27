# Taie capturile brute (RAW, implicit <tmp>/cozy-clienti-raw, @2x) la zona aratata in telefon si le scrie cu nume finale
# in assets/shots/clienti/. y0/y1 = coordonate CSS in pagina (sau in viewport pentru modale).
# Scrie si clienti/_tools/shots-manifest.json (y0 al fiecarei imagini, folosit de index.html).
# Rulare: cd marketing/videos && python3 clienti/_tools/prep-v2.py [--jpeg nume1,nume2]
import json, os, sys, tempfile
from PIL import Image

RAW = os.environ.get('RAW', os.path.join(tempfile.gettempdir(), 'cozy-clienti-raw'))
OUT = 'assets/shots/clienti'
S = 2  # deviceScaleFactor al capturilor
# (nume final, sursa bruta, y0, y1, offset-ul sursei in pagina (captura de regiune), x0, x1)
SPEC = [
    ('hdr-anon', 'w-header-anon.png', 0, 53, 0),
    ('hdr-ana', 's2-header.png', 0, 53, 0),
    ('hdr-ioana', 'w-header-ioana.png', 0, 53, 0),
    ('hdr-elena', 's11-offers-header.png', 0, 53, 0),
    ('hdr-mihai', 's13-review-header.png', 0, 53, 0),
    ('s2-a', 's2-a.png', 230, 830, 0),
    ('s2-b', 's2-b.png', 320, 890, 0),
    ('s2-c', 's2-c.png', 60, 712, 0),
    ('s2-d', 's2-d.png', 60, 712, 0),
    ('s3-a', 's3-a.png', 630, 1262, 0),
    ('s4-a', 's4-a.png', 140, 942, 0),
    ('s4-b', 's4-b.png', 370, 942, 0),
    ('s4-c', 's4-c.png', 370, 942, 0),
    ('s5-m0', 's5-m0.png', 1030, 1652, 0),
    ('s5-m1', 's5-m1.png', 1080, 1652, 0),
    ('s5-card-front', 's5-m0.png', 1196, 1484, 0, 41, 389),
    ('s5-card-back', 's5-m1.png', 1196, 1484, 0, 41, 389),
    ('s5-d0', 's5-d0.png', 464, 1036, 0),
    ('s5-d1', 's5-d1.png', 464, 1036, 0),
    ('s5-d2', 's5-d2.png', 464, 1036, 0),
    ('s5-d3', 's5-d3.png', 464, 1036, 0),
    ('s6-a', 's6-a.png', 484, 1064, 148),
    ('s6-b', 's6-b.png', 484, 1064, 148),
    ('s6-c', 's6-c.png', 484, 1064, 148),
    ('s6-d', 's6-d.png', 484, 1064, 148),
    ('s6-sl-a', 's6-a.png', 1080, 1128, 148, 41, 389),
    ('s6-sl-b', 's6-b.png', 1080, 1128, 148, 41, 389),
    ('s6-sl-c', 's6-c.png', 1080, 1128, 148, 41, 389),
    ('s7-a', 's7-a.png', 410, 982, 0),
    ('s7-b', 's7-b.png', 410, 982, 0),
    ('s7-c', 's7-c.png', 410, 982, 0),
    ('s8-a', 's8-a.png', 646, 1216, 0),
    ('s8-b', 's8-b.png', 646, 1216, 0),
    ('s8-c', 's8-c.png', 646, 1216, 0),
    ('s9-a', 's9-a.png', 1572, 2042, 0),
    ('s9-b', 's9-b.png', 0, 640, 0),
    ('s10-a', 's10-a.png', 272, 932, 0),
    ('s11-an', 's11-offers.png', 216, 792, 0),
    ('s11-dw', 's11-offers.png', 1324, 1900, 0),
    ('s11-cm', 's11-offers.png', 2270, 2850, 0),
    ('s12-chat', 's11-offers.png', 660, 1322, 0),
    ('s13-deliv', 's13-deliv.png', 180, 752, 0),
    ('s13-review', 's13-review.png', 180, 752, 0),
]
jpeg = set(sys.argv[sys.argv.index('--jpeg') + 1].split(',')) if '--jpeg' in sys.argv else set()
manifest, total = {}, 0
for row in SPEC:
    name, src, y0, y1, off = row[:5]
    x0, x1 = (row[5], row[6]) if len(row) > 5 else (0, 430)
    im = Image.open(os.path.join(RAW, src)).convert('RGB')
    top, bot = (y0 - off) * S, min(im.height, (y1 - off) * S)
    crop = im.crop((x0 * S, top, x1 * S, bot))
    ext = 'jpg' if name in jpeg else 'png'
    path = os.path.join(OUT, f'{name}.{ext}')
    if ext == 'jpg':
        crop.save(path, quality=90, optimize=True, progressive=True)
    else:
        crop.save(path, optimize=True)
    size = os.path.getsize(path)
    total += size
    manifest[name] = {'file': f'{name}.{ext}', 'y0': y0, 'x0': x0, 'w': x1 - x0, 'h': round((bot - top) / S, 1)}
    print(f'{name:16s} {crop.size[0]}x{crop.size[1]} {size/1024:7.0f} KB')
json.dump(manifest, open('clienti/_tools/shots-manifest.json', 'w'), indent=1)
print(f'total {total/1024/1024:.2f} MB')
