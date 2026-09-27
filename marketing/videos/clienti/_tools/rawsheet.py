# Plansa rapida de verificare a capturilor brute: python3 clienti/_tools/rawsheet.py out.png y0 y1 f1.png f2.png ...
import sys
from PIL import Image
out, y0, y1, *files = sys.argv[1:]
y0, y1 = int(y0), int(y1)
ims = [Image.open(f).convert('RGB') for f in files]
W = Image.new('RGB', (len(ims) * 870, (y1 - y0) * 2), 'white')
for i, im in enumerate(ims):
    W.paste(im.crop((0, y0 * 2, 860, min(im.height, y1 * 2))), (i * 870, 0))
s = min(1, 1900 / W.width, 1900 / W.height)
W.resize((int(W.width * s), int(W.height * s))).save(out)
print(out, W.size, s)
