#!/usr/bin/env bash
# Pregateste capturile Studio 3D pentru scena 3: taie colturile rotunjite ale canvas-ului
# (16 px din fiecare latura, @2x) si le copiaza cu nume finale in assets/shots/clienti/.
# Rulare (dupa capturi): cd marketing/videos && node clienti/_tools/cap-studio.mjs
#                        bash clienti/_tools/prep-assets.sh
set -euo pipefail
FF=node_modules/ffmpeg-static/ffmpeg
SRC=assets/shots/clienti/_studio
DST=assets/shots/clienti
for f in w120-c2 w140-c2 w160-c2 w160-c3 w170-c3 w180-c3 w180-c3-open w180-c3-open-nuc w180-c3-open-verde-salvie; do
  "$FF" -loglevel error -y -i "$SRC/$f.png" -vf "crop=iw-32:ih-32:16:16" "$DST/studio-$f.png"
  echo "studio-$f.png"
done
rm -rf "$SRC"   # capturile brute nu se pastreaza in repo
