#!/usr/bin/env bash
# Extrage N cadre din MP4 intre T0 si T1 (secunde) si le pune pe o grila 5 x ceil(N/5): clienti/stills/_strip.png
# Rulare: cd marketing/videos && bash clienti/_tools/strip.sh 1.3 2.2 10
set -euo pipefail
FF=node_modules/ffmpeg-static/ffmpeg
T0=$1; T1=$2; N=${3:-10}; MP4=${4:-out/cozy-home-clienti-9x16.mp4}
DUR=$(python3 -c "print($T1-$T0)")
FPS=$(python3 -c "print(($N-1)/($T1-$T0) if $N>1 else 1)")
ROWS=$(( (N + 4) / 5 ))
"$FF" -loglevel error -y -ss "$T0" -t "$DUR" -i "$MP4" -vf "fps=$FPS,scale=216:384,tile=5x${ROWS}:padding=4:color=black" -frames:v 1 clienti/stills/_strip.png
echo clienti/stills/_strip.png
