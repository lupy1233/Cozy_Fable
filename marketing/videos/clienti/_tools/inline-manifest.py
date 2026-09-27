# Copiaza clienti/_tools/shots-manifest.json (scris de prep-v2.py) in index.html, intre markerii @@MANIFEST@@ / @@END@@.
# Rulare: cd marketing/videos && python3 clienti/_tools/inline-manifest.py
import json, re
m = json.load(open('clienti/_tools/shots-manifest.json'))
body = 'const M = {\n' + ''.join(f"  '{k}': {{ file: '{v['file']}', y0: {v['y0']} }},\n" for k, v in m.items()) + '};'
p = 'clienti/index.html'
s = open(p).read()
s2 = re.sub(r'(// @@MANIFEST@@\n).*?(\n// @@END@@)', lambda mm: mm.group(1) + body + mm.group(2), s, flags=re.S)
assert s2 != s or body in s
open(p, 'w').write(s2)
print('manifest inlined:', len(m), 'imagini')
