#!/usr/bin/env bash
# Pune stills-urile date (secunde) una langa alta, la jumatate de rezolutie: clienti/stills/_sheet.png
# Rulare: cd marketing/videos && bash clienti/_tools/sheet.sh 0 1.2 2.2
set -euo pipefail
FF=node_modules/ffmpeg-static/ffmpeg
ins=(); fl=""; i=0
for t in "$@"; do
  f=$(printf "clienti/stills/t%s.png" "$(printf '%.2f' "$t" | tr . _)")
  ins+=(-i "$f"); fl+="[$i]scale=540:960[s$i];"; i=$((i+1))
done
lab=""; for ((k=0;k<i;k++)); do lab+="[s$k]"; done
"$FF" -loglevel error -y "${ins[@]}" -filter_complex "${fl}${lab}hstack=inputs=$i" clienti/stills/_sheet.png
echo clienti/stills/_sheet.png
