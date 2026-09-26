# Video 1 — CLIENȚI · note de producție

Fișier final: `out/cozy-home-clienti-9x16.mp4` — 1080×1920, 30 fps, 40,00 s (1200 cadre), H.264 High (CRF 17)
+ pistă AAC mută, ~5,3 MB. Sursa: `clienti/index.html` (cronologie deterministă, `lib/timeline.js`).

```
cd marketing/videos
node render.mjs clienti --out out/cozy-home-clienti-9x16.mp4          # ~3,5 min
node render.mjs clienti --stills 1.2,10.8,31.9 --contact 20 --stills-only
```

## Scenele (timpi finali)

Fiecare scenă are intrare și ieșire (fade + deplasare/mască); tranzițiile se suprapun ~0,3 s.
Sus-stânga apare stația din „Drumul cererii” (`LandingV2.p1–p4.phase`: 1 Cererea · 2 Preluarea ·
3 Ofertele · 4 Montajul), iar pe marginea stângă se desenează firul de alamă cu cele 4 noduri.

| # | Timp | Ce se vede | Text pe ecran |
|---|---|---|---|
| 1 | 0,0–3,0 | 5 bilețele scrise „de mână” + 3 notificări de apel ratat cad/sunt aruncate dezordonat; la 1,4 s o coală de arhitect (caroiaj, colțare, „№ 0001”) intră din stânga și le mătură; fir de alamă sub titlu; coala se transformă în fereastra scenei 2. | **Mobilă la comandă, fără 10 telefoane.** |
| 2 | 3,0–8,0 | Captura reală a mini-configuratorului din hero, mărită și „filmată” pe bucăți: tap pe Dulap → 160 cm → Furnir stejar → Mânere (schița se schimbă la fiecare tap), zoom pe schiță, cartușul „Cererea ta ar suna așa” urcă și se tastează spec-ul. Schița se dizolvă în modelul 3D. | **Descrii vizual ce vrei** · `Dulap 160 cm · Furnir stejar · Mânere` · etichetă `10 camere · 10 piese` |
| 3 | 8,0–13,0 | Capturi reale Studio 3D (editorul „Piesă nouă” → Dulap): lățimea 120 → 160, „+” coloană (2 → 3), 160 → 180; tap pe corp → ușile se deschid (callout-uri „Bară de haine”, „Polițe”); paleta de finisaje: Stejar → Nuc → Verde salvie. Panou recreat: Lățime (slider + valoare), Coloane (stepper), Finisaj. | **Îl configurezi în 3D** · `L 180 · H 240 · A 60 cm` (L numără live) |
| 4 | 13,0–17,0 | Fotografia schiței pe hârtie urcă din afara cadrului peste zona de upload (stare drag-over), intră în rândul fișierului; badge „se scanează…” → „verificat” (salvie); rând „Inspirație din Caietul de idei · 3 poze”. Dedesubt: estimarea (8.500 – 12.000 lei, contor) + slider de buget. | **Ai doar o schiță pe hârtie? E de ajuns.** · **Primești o estimare pe loc.** |
| 5 | 17,0–22,0 | „Verifică și publică” cu firul de verificare (01 Detalii generale, 02 Cameră · Dulap + 3D, 03 Fișiere) → tap „Publică” → overlay „Publicăm cererea ta…” → cardul din „Cererile mele”: „Dulap dormitor”, „În marketplace” → „Preluată parțial”, „2 firme”; 3 sloturi: Atelier Nord și Lemn & Formă „ocupat” + „Firmă verificată”, al treilea „liber 2/3”. | **Publici gratuit.** → **Cel mult 3 firme verificate o preiau.** |
| 6 | 22,0–27,7 | Clopoțel + toast „Ofertă nouă · …” (1→2→3); trei oferte structurate în cascadă (firmă + „Firmă verificată”, versiune, valabilitate, preț RON ≈ EUR, preț pe cameră, termen, garanție, „Descarcă PDF”); apoi rând cu rând se aprind preț → termen → garanție → PDF pe toate cele trei. | **Compari oferte structurate, negru pe alb.** · `preț · termen · garanție · PDF` |
| 7 | 27,7–33,0 | Secțiunea Atelier Nord din pagina de oferte: bula firmei „Putem face ușile push-to-open, +300 lei.”, răspunsul clientului „Perfect, trimiteți varianta.”, „Versiunea 2” → „Versiunea 3”, 9.800 → 10.100 lei; tap „Acceptă oferta” → sigiliul de alamă „ACCEPTATĂ” se ștanțează, stadiul devine „Ofertă acceptată”; celelalte două devin gri: „Conversație închisă” + „doar pentru citire”. | **Discuți direct. Ceri modificări. Alegi.** (câte o frază, sincron cu acțiunea) |
| 8 | 33,0–37,0 | „Comandă livrată” (info) → tap „Confirmă livrarea” → „Finalizată”; „Recenzie”: 5 stele de alamă se umplu pe rând → „Recenzie publică”; notă cu scut. | **Confirmi livrarea. Lași recenzia.** · „Sub 3 stele? Intervenim noi.” |
| 9 | 37,0–40,0 | Casa se desenează (fumul de alamă la final), wordmark COZY HOME spațiat, riglă de alamă, tagline, butonul nuc, lista de încredere; ultimele 0,34 s: fade spre ivoriu (buclă curată spre hook). | **Cozy Home** · *De la schița ta, la firma potrivită.* · **Începe o cerere — gratuit** · Gratuit pentru clienți / Firme verificate / Cel mult 3 oferte |

## Ce e captură reală și ce e recreare

**Capturi reale** (frontend local, fără backend) — `assets/shots/clienti/`, total ~1,5 MB:
- `hero-0…4.png` — cardul „Probează configuratorul” de pe `/ro`, 430 px lățime @3x, 5 stări
  (Comodă TV 220/Alb mat/Push → Dulap → 160 cm → Furnir stejar → Mânere). Script: `clienti/_tools/cap-hero.mjs`.
- `studio-*.png` (9) — canvas-ul WebGL din editorul de piesă al Studio 3D (`/ro/studio` → „Descopăr singur” →
  „Piesă nouă” → Dulap, fronturi „Cu mâner”), 1440×900 @2x, colțurile rotunjite tăiate.
  Script: `clienti/_tools/cap-studio.mjs` + `prep-assets.sh` (reproductibile bit cu bit — verificat).
  Conturul portocaliu de selecție a zonei (HIGHLIGHT_COLOR) e scos doar în captură, resetând starea React a
  zonei active din scriptul Playwright; aplicația nu e modificată.

**Recreări HTML/CSS/SVG** (etichete din `ro.json`, tokens din `globals.css`, iconițe lucide identice):
cartușul spec (S2), panoul de comenzi 3D + pastila „Configurează în 3D” (S3), Dropzone / AttachmentRow /
BudgetSlider (S4), ReviewStep + overlay de publicare + cardul „Cererile mele” + sloturile (S5), OfferCard ×3 +
clopoțel (S6), secțiunea de ofertă cu ChatPanel (S7), ClientFulfillment + ilustrația din `process-band` (S8),
logo-ul `CozyHomeMark` (S9). Recuzită (nu UI de produs): bilețelele și notificările din S1, fotografia schiței
pe hârtie din S4 (SVG: caroiaj + creion + scris cu filtru de „tremur”, deoarece nu există o fotografie reală).

## Abateri de la PLAN.md (și de ce)

1. **Etichete reale în loc de cele din plan:** butonul e „Publică” (`Requests.publish`), nu „Publică cererea”;
   badge-ul cererii e „În marketplace” → „Preluată parțial” (`Requests.statusValue`) — „Publicată” există doar
   pentru lucrările din galeria admin. Pe ofertele închise: „Conversație închisă” (`Quotes.stage.CLOSED`) +
   „doar pentru citire” (`Quotes.apiErrors.THREAD_READ_ONLY`).
2. **Oferta acceptată e Atelier Nord (v2 → v3, 10.100 lei ≈ 1.942 €):** Lemn & Formă era deja la „Versiunea 3”,
   iar regula e max. 3 versiuni — doar Atelier Nord poate ajunge legal la „Versiunea 3” după cererea de modificare.
3. **Cifre:** „10” din hook și prețurile ofertelor sunt în DM Sans (în Marcellus „10” se citește „IO”); prețul în
   DM Sans semibold e și cel din rândul „Preț” al OfferCard. Restul titlurilor rămân Marcellus. EUR apare la toate
   cele trei oferte (curs implicit 5,2 din exemplul planului).
4. **Scena 1:** fără tăietură; coala de arhitect „mătură” bilețelele (tranziție continuă, permisă).
5. **Scena 2:** captura e arătată mărită (2,45× CSS → etichete ≥30 px) și panoramată, nu întreagă (cardul de
   398×706 px CSS nu încape lizibil în 9:16). Starea de start e Comodă TV, ca fiecare tap să schimbe vizibil schița.
6. **Scena 3:** paleta arată primul rând de swatch-uri (7 din 10), eticheta scurtată la „Finisaj”
   (real: „Finisaj (vizual)”); ușile deschise acoperă parțial prima coloană (așa randează modelul real).
7. **Caietul de idei:** menționat ca rând text + iconiță în S4 („Inspirație din Caietul de idei · 3 poze”, exact
   locul în care `UploadsStep` pune `InspirationPicker`), **fără strip de 4 poze** — fotografiile galeriei sunt pe
   CDN-ul Mobila Unicat, găzduirea lor așteaptă acordul PO (`lib/inspiration.ts`), iar CDN-ul nu e accesibil aici.
8. **„verificat”** apare conform planului (`Configurator.uploads.status.SAFE`), deși UI-ul real al clientului nu
   mai afișează statusul când fișierul e în regulă (doar „se verifică…” cât durează scanarea).
9. **CTA:** butonul poartă direct „Începe o cerere — gratuit”; linia de încredere e pe 3 rânduri cu bife (DM Sans
   44 px), ca lista din hero-ul landing-ului — pe un singur rând mono n-ar fi încăput la ≥44 px.
10. **Adăugiri:** kicker-ul de stație + firul de alamă, etichetele `10 camere · 10 piese`, `Studio 3D`,
    `Fișiere · buget`, firul de verificare din „Verifică și publică” (recapitulează scenele 2–4).
11. **„draft anonim”** nu are un moment vizual propriu (e implicit în fluxul de publicare).

## Decizii necesare / întrebări deschise

1. **DECIZIE NECESARĂ — domeniul la CTA:** `const SITE_URL = ''` (prima linie din script). Gol = doar wordmark;
   cu valoare, domeniul apare sub buton (layout-ul se ajustează automat).
2. **DECIZIE NECESARĂ — Mobila Unicat:** e singurul nume real (oferta 2 din S6) și în S7 devine ofertă neacceptată,
   „Conversație închisă”. Dacă partenerul nu vrea să apară așa, se schimbă `const PARTNER_NAME` (un singur loc).
3. **Fotografiile din Caietul de idei** — dacă PO aprobă găzduirea, rândul din S4 poate deveni strip de 4 imagini.
4. **Datele „Valabilă până la 09–11.10.2026”** vor părea vechi după octombrie 2026 — se pot schimba în HTML.

## Note tehnice

- Motorul de animație e în pagină (`A()` = keyframe-uri per proprietate). Motiv: în `lib/timeline.js`,
  `tween()` rulează toate pistele la fiecare seek, deci două tween-uri pe același element (intrare + ieșire) se
  suprascriu — câștigă ultimul înregistrat. N-am modificat fișierele comune; ocolit local.
- `capture.mjs` face click pe prima potrivire din toată pagina (etichete ca „Dulap”/„160 cm” apar și în alte
  secțiuni ale landing-ului) și nu poate completa input-uri/select-uri (necesare în Studio) → scripturi proprii în
  `clienti/_tools/`.
- `document.fonts.ready` nu garantează subseturile folosite doar mai târziu (latin-ext, „№”) → toate fețele sunt
  preîncărcate în `tl.onReady`.
- Determinism: aceeași ordine de seek → cadre identice bit cu bit (verificat md5). Cu altă ordine de seek apar
  diferențe de ≤2/255 pe ~7.000 de pixeli din panoul S3 (rasterizare Chromium; PSNR 72 dB, invizibil).
- Zona sigură: tot textul important stă între y 250 și 1600; butoanele platformei din dreapta-jos pot atinge
  marginea dreaptă a cardurilor (butoanele „Descarcă PDF”, swatch-ul „Verde salvie”).
- Unelte QA în `clienti/_tools/`: `measure.mjs` (lățimi reale de text), `sheet.sh` (stills alăturate),
  `strip.sh` (cadre din MP4 pe grilă).
