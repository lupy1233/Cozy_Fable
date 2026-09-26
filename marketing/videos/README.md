# Videouri promo Cozy Home

Două clipuri 9:16 (1080×1920, 30 fps, MP4 H.264) pentru rețele sociale: unul pentru clienți,
unul pentru firmele de mobilier. Planul complet (storyboard, copy, reguli de conținut) e în
[`PLAN.md`](PLAN.md); notele de producție ale fiecărui clip sunt în `clienti/NOTES.md` și `firme/NOTES.md`.

## Cum funcționează

Fiecare video este o pagină HTML (`clienti/index.html`, `firme/index.html`) cu o cronologie
deterministă: tot ce se mișcă este o funcție de timp `t`. `render.mjs` deschide pagina în Chromium
(Playwright), cere cadrul de la fiecare `t = i / fps`, face screenshot și trimite cadrele în ffmpeg,
care scrie MP4-ul. Nu există dependență de timp real, deci randarea este reproductibilă.

```
node render.mjs <dir> --out out/<nume>.mp4          # randare completă
node render.mjs <dir> --stills 2,7,12 --stills-only # PNG-uri la secundele date (QA)
node render.mjs <dir> --contact 16 --stills-only    # planșă de contact cu 16 cadre
node render.mjs <dir> --from 20 --to 26 --out x.mp4 # doar un interval (iterații rapide)
```

Deschis direct în browser, `index.html` rulează un preview în buclă: `spațiu` pauză,
`←`/`→` ±1 s, `0` restart.

## Instalare (o singură dată)

```
cd marketing/videos
npm install            # playwright + ffmpeg-static (folosește Chromium-ul deja instalat de Playwright)
```

Dacă Playwright nu găsește browserul: `npx playwright install chromium` sau setează
`CHROMIUM_PATH=/cale/catre/chrome`.

## Capturi reale din aplicație

`capture.mjs` face screenshot-uri din frontend-ul pornit local (`pnpm -F frontend dev`, port 3000),
la viewport de telefon 430×932 @2x:

```
node capture.mjs --url /ro --click "text=Dulap" --click "text=160 cm" --out assets/shots/clienti/hero.png
node capture.mjs --url /ro/studio --w 1440 --h 900 --scale 1 --click "text=Descopăr singur" --out assets/shots/studio.png
```

Fără backend funcționează paginile publice (landing cu mini-configurator, Studio 3D, ghid de schiță).
Ecranele care au nevoie de backend (marketplace, fișă de lucru, oferte, portofel) sunt recreate în HTML
cu aceleași etichete și culori ca în componentele reale.

## Modificări uzuale

- **Text**: editează string-urile din `index.html` (toate în română cu diacritice).
- **Domeniul la CTA**: constanta `SITE_URL` de la începutul scriptului din fiecare `index.html`.
- **Durata unei scene**: schimbă `t0/t1` în apelurile `tl.scene(...)` / `tl.tween(...)` și `durationMs`.
- **Format 16:9 / 1:1**: paginile sunt gândite pentru 1080×1920; pentru alt format se adaptează layout-ul
  și se randează cu `--w 1920 --h 1080`.

## Structură

```
PLAN.md            storyboard + reguli de conținut + decizii necesare
README.md          acest fișier
render.mjs         HTML → cadre → MP4
capture.mjs        capturi reale din aplicația locală
lib/timeline.js    cronologie deterministă (scene, tween, type, count, seek WAAPI/SMIL)
assets/fonts/      Marcellus, DM Sans, IBM Plex Mono (self-hosted, licență OFL)
assets/shots/      capturi și imagini folosite în scene
clienti/           Video 1 (index.html, NOTES.md)
firme/             Video 2 (index.html, NOTES.md)
out/               MP4 finale + JSON cu metadate de randare
```
