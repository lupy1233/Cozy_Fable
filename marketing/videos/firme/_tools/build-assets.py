# Construieste cadrele folosite in video din capturile brute (DPR 3) → assets/shots/firme/.
# Fiecare cadru = regiune CSS [x 15..415, y top..top+h] reesantionata la 2,5 px/CSS px (1000 px latime),
# JPEG q90 4:4:4. Antetul aplicatiei (sticky, 0..52,8 CSS) se salveaza separat (hdr-app.jpg).
#   python3 firme/_tools/build-assets.py
import os, json
from PIL import Image

RAW = os.environ.get('RAW_DIR', '/tmp/claude-0/-home-user-Cozy-Fable/af6c217d-d172-5c9e-a983-a809397375c3/scratchpad/raw')  # capturi brute DPR 3
OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'assets', 'shots', 'firme')
OUT = os.path.abspath(OUT)
S = 2.5          # px video / px CSS
X0, X1 = 15, 415 # fereastra orizontala (CSS)
HDR = 52.8       # inaltimea antetului sticky (CSS)
H_APP = 356      # inaltimea cadrului sub antet (CSS)
H_FULL = 405     # cadru fara antet (pagini de autentificare)

def load(name):
    im = Image.open(f'{RAW}/{name}.png').convert('RGB')
    return im, im.width / 430.0

def crop(name, top, h, x0=X0, x1=X1, scale=S):
    im, d = load(name)
    box = (round(x0 * d), round(top * d), round(x1 * d), round(min(im.height / d, top + h) * d))
    part = im.crop(box)
    w = round((x1 - x0) * scale); hh = round((box[3] - box[1]) / d * scale)
    return part.resize((w, hh), Image.LANCZOS)

def save(img, fname, q=90):
    path = os.path.join(OUT, fname)
    if fname.endswith('.png'): img.save(path, optimize=True)
    else: img.save(path, quality=q, subsampling=0, optimize=True, progressive=True)
    print(f'{fname:24s} {img.size[0]}x{img.size[1]}  {os.path.getsize(path)//1024} KB')

os.makedirs(OUT, exist_ok=True)
# antete
save(crop('feed', 0, HDR), 'hdr-app.jpg')
save(crop('partners', 0, HDR), 'hdr-pub.jpg')

FRAMES = [
    # nume fisier, captura, top CSS, inaltime CSS
    ('s2-reg.jpg', 'reg2', 420, H_FULL),
    ('s2-partners.jpg', 'partners', 488, H_APP),
    ('s3-feed-a.jpg', 'feed', 70, H_APP),
    ('s3-feed-b.jpg', 'feed', 655, H_APP),
    ('s4-req-a.jpg', 'kitchen', 118, H_APP),
    ('s4-req-b.jpg', 'kitchen', 490, H_APP),
    ('s5-baie.jpg', 'baie', 515, H_APP),
    ('s5-feed.jpg', 'feed2', 120, H_APP),
    ('s6-work-a.jpg', 'b0-sheet', 222, H_APP),
    ('s6-work-a2.jpg', 'b1-assigned', 222, H_APP),
    ('s6-clar.jpg', 'b3-clar-sent', 1768, H_APP),
    ('s7-offer-a.jpg', 'b3-clar-sent', 790, H_APP),
    ('s7-offer-a2.jpg', 'b4-price', 790, H_APP),
    ('s7-offer-b.jpg', 'b5-filled', 1180, H_APP),
    ('s7-offer-c.jpg', 'b6-sent', 782, H_APP),
    ('s8-claims.jpg', 'claims3', 70, H_APP),
    ('s8-messages.jpg', 'thread-ana', 222, H_APP),
    ('s9-perms.jpg', 'company2', 1730, H_APP),
    ('s9-team.jpg', 'messages-team2', 160, H_APP),
    ('s10-wallet-a.jpg', 'wallet2', 70, H_APP),
    ('s10-wallet-b.jpg', 'wallet2', 425, H_APP),
    ('s10-wallet-c.jpg', 'wallet2', 785, H_APP),
]
for f, src, top, h in FRAMES:
    save(crop(src, top, h), f)

# sticker: pastila de status „Status: Aprobată” din „Firma mea” (3 px/CSS px, fara reesantionare)
im, d = load('company')
save(im.crop((round(270 * d), round(96 * d), round(417 * d), round(143 * d))), 's2-status.png')

# PDF-ul real al ofertei (Versiunea 1), randat cu pypdfium2 la 3x: jumatatea de sus a paginii
pdf = Image.open(f'{RAW}/offer-v1-p0.png').convert('RGB')
top = pdf.crop((0, 0, pdf.width, int(pdf.height * 0.305)))
save(top.resize((600, round(600 * top.height / top.width)), Image.LANCZOS), 's7-pdf.jpg', q=92)

tot = sum(os.path.getsize(os.path.join(OUT, f)) for f in os.listdir(OUT))
print('TOTAL', tot // 1024, 'KB in', OUT)
