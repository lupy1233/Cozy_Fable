# Previzualizare: imparte capturile inalte in segmente de 932 CSS px (la 1x) pentru inspectie.
import sys, os
from PIL import Image
raw = os.environ.get('RAW_DIR', '/tmp/claude-0/-home-user-Cozy-Fable/af6c217d-d172-5c9e-a983-a809397375c3/scratchpad/raw')
out = raw + '/prev'
os.makedirs(out, exist_ok=True)
scale = float(os.environ.get('PSCALE', '1.0'))  # 1.0 = 430 px latime
for name in sys.argv[1:]:
    im = Image.open(f'{raw}/{name}.png').convert('RGB')
    dpr = im.width / 430
    seg = int(932 * dpr)
    n = 0
    for y in range(0, im.height, seg):
        part = im.crop((0, y, im.width, min(im.height, y + seg)))
        w = int(430 * scale); h = int(part.height * w / part.width)
        part.resize((w, h), Image.LANCZOS).save(f'{out}/{name}-{n}.png')
        print(f'{out}/{name}-{n}.png', w, h)
        n += 1
