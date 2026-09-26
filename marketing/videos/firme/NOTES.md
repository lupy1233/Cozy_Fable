# Video 2 — FIRME DE MOBILIER · note de producție

Livrabil: `marketing/videos/out/cozy-home-firme-9x16.mp4` — 1080×1920, 30 fps, 42,00 s, H.264 High
(yuv420p) + pistă AAC mută. Sursa: `firme/index.html` (cronologie deterministă, `lib/timeline.js`).

```
cd marketing/videos
node render.mjs firme --out out/cozy-home-firme-9x16.mp4             # ~7 min (1260 cadre)
node render.mjs firme --stills 1.5,6,11.5,17,23,28.5,33.5,38,41 --stills-only
```

## Cronologia finală

| # | Interval | Titlu / text pe ecran | Ce se vede |
|---|---|---|---|
| 1 | 0,0–3,0 | **Câte oferte trimiți degeaba?** | 5 foi „OFERTĂ · PDF” zboară în cascadă spre un telefon; clientul răspunde „Mulțumim, mai vedem…” (telefonul vibrează), foile se sting în gri. Tăietură: o coală curată de ivoriu urcă peste tot (2,52–2,98). |
| 2 | 3,0–9,0 | **Cereri dimensionate, cu materiale și buget clar.** · `mărime · buget · distanță · sloturi` | Feed marketplace (3 carduri din plan). Linia mono se tastează și fiecare cuvânt aprinde elementul lui pe primul card (mărime → buget → km → SlotTrack). Tap pe card → fișa cererii: camera 01 Bucătărie (chips reale din întrebări), camera 02 Bibliotecă cu captura 3D reală + chips 3D, „Vezi camera 3D”, „Vezi corpul în 3D”. |
| 3 | 9,0–14,0 | **Plătești credite doar pentru proiectele pe care le preiei.** → (11,6–12,5) **Cel mult 3 firme pe cerere.** · „nu ~~30 de firme~~, cel mult 3” | Sloturi: slot 1 „Firmă verificată · ocupat”, tap „Preia” → „Se preia…” → „Cerere preluată.”, slotul 2 devine „Atelier Nord · Firmă verificată”, 200 → 188 credite, „12 credite rezervate”, acoladă de alamă pe cele 3 sloturi. |
| 4 | 14,0–20,0 | **Fișă de lucru cu tot ce ai nevoie.** · `SLA · client · chat · fișiere` | WorkBar: „Se ocupă” Neatribuit → Andrei P. (dropdown), „Termen pentru ofertă (SLA)” 3 zile lucrătoare + cronometru, „Bugetul clientului” 12.000 – 18.000 lei. Card „Clientul tău” (inițiale, telefon, adresă), „Fișierele cererii”, „Clarificări”: se tastează „Bună! Blatul e inclus în buget?” → „Cere clarificare” → „SLA în pauză” (cronometrul îngheață). Rând mic „Retrage preluarea · rambursare la motivele validate”. |
| 5 | 20,0–26,0 | **Ofertare rapidă: o singură fișă, PDF gata.** · `până la 3 versiuni · RON/EUR` | Offer builder: 13.400 + 2.600 → total se adună singur 16.000 lei ≈ 3.077 €, RON/EUR, 6 săpt., 24 luni, 14 zile → „Trimite” → cardul ofertei „Atelier Nord · Versiunea 1 · Trimisă”, „Descarcă PDF”, documentul PDF „se descarcă”. |
| 6 | 26,0–31,0 | **Lucrezi în echipă, cu roluri și permisiuni.** · `chat intern, invizibil clientului` | Tabel „Echipă” + „Permisiuni pe câmpurile ofertei”: Proprietar / Manager / Angajat de încredere / Angajat coordonat × Preț / Termen / Garanție (matricea implicită din docs/03 §4.13). Mesagerie: tab „Echipa firmei”, bula internă „Verifică stocul de MDF înainte de ofertă”. |
| 7 | 31,0–36,0 | **Același formular, pe site-ul tău.** · `clienții configurează · tu primești fișa completă` | Telefon cu formularul Mobila Unicat: „Ce camere vrei să mobilezi?” → Bibliotecă → „Configurează în 3D” → „Verifică și trimite” + „Trimite cererea” (eticheta „fără cont”) → „Îți mulțumim pentru cerere!” cu numărul A1F3C07E. Apoi e-mailul intern real „Cerere nouă #A1F3C07E — București” cu fișa (camere, mod de pornire, buget, locație, fișiere, mesajul clientului, „Fișa completă”). |
| 8 | 36,0–39,75 | **Abonament flexibil. Credite doar când preiei.** · `Stripe · factură automată` | Portofel: Disponibile 188 · Rezervate 12 · Sold liber 188; planuri SILVER / GOLD / PLATINUM (gradientele TierBadge), „Acces imediat la cererile noi” evidențiat pe Platinum; „Plată securizată cu cardul (Stripe)”; „TRIAL o lună Gold + 10 credite la aprobare”. |
| 9 | 39,72–42,0 | **Cozy Home pentru firme** · **Înscrie-ți firma** · Verificare gratuită / Cereri calificate / Fără spam | Lockup-ul real (casa se desenează + wordmark spațiat), „pentru firme”, buton nuc cu reflex de alamă, 3 rânduri de încredere. Ultimele 0,22 s se estompează spre ivoriu ca bucla să se lege de primul cadru. |

Tranziții: ieșire comună (conținutul urcă 60 px și se stinge, inCubic, se termină la B+0,04 s) +
intrare (cuvintele titlului urcă pe rând, outCubic; cardurile outQuart; badge-uri/ștampile outBack).
Colțarele de alamă ale planșei „respiră” spre exterior la fiecare graniță de scenă.

## Real vs. recreat

Real (capturat / copiat, nu desenat):
- `assets/shots/firme/studio-biblioteca-3d.png` — randare reală din configuratorul 3D de piese
  (`/ro/studio` → Piesă nouă → Bibliotecă, config implicit: 160 × 200 × 35 cm, 3 coloane × 4 polițe),
  capturată headless la 2×. Folosită în fișa din scena 2 și în telefonul Mobila Unicat (scena 7 —
  aplicația white-label folosește același configurator).
- Logourile Mobila Unicat (`mobilaunicat-logo.svg`, `-white.svg`) din `cozy-mobilaunicat/apps/frontend/public/brand/`.
- Marca Cozy Home: path-urile SVG exacte din `components/brand/logo.tsx` (lockup orizontal, Marcellus .18em).
- Iconițele: path-urile lucide (ISC) extrase din `lucide-react` — aceleași ca în aplicație.
- Toate etichetele UI: string-uri din `apps/frontend/src/messages/ro.json` (Marketplace, Quotes, Lifecycle,
  Company, Messages, Billing, Configurator) și din `cozy-mobilaunicat` (ThankYou, Configurator, Requests,
  `lib/request-emails.ts` pentru e-mail, `lib/request-ref.ts` pentru formatul numărului de 8 caractere).

Recreat în HTML/CSS (necesită backend, deci nu se poate captura; recreat cu tokens și structura din `.tsx`):
feed marketplace, fișa cererii (RoomSpecCard), panoul de preluare, WorkBar + ClientCard + Clarificări,
OfferBuilder + OfferCard, tabelul echipă/permisiuni, mesageria, portofelul și planurile, wizardul și
pagina „mulțumim” Mobila Unicat, e-mailul „Cerere nouă”. Scena 1 (foile PDF + chatul generic) e ilustrație.
Capturi de landing nu sunt folosite (nu aduceau nimic peste recreările animate).

## Abateri de la PLAN.md (și de ce)

1. **Scena 2 — chips 3D.** Planul: `4 coloane · 2 uși · 12 polițe`. În aplicație chips-urile 3D apar doar la
   piesele configurate 3D (nu la bucătărie). Cererea „Bucătărie în L + insulă” are deci a doua cameră
   „02 Bibliotecă” configurată 3D, iar chips-urile sunt cele reale ale capturii: `160 × 200 × 35 cm · 3 coloane ·
   12 polițe · Finisaj Stejar` (config-chips.ts). Bucătăria arată chips-urile reale din întrebări
   („Ce formă are bucătăria? În formă de L”, „Vrei și o insulă? Da”).
2. **Scena 5 — defalcarea pe camere.** Planul: `Bucătărie 13.400 + Insulă 2.600`. Insula nu e cameră separată
   (e o întrebare din fluxul Bucătărie), iar builderul defalcă prețul pe camerele cererii → `1. Bucătărie 13.400 +
   2. Bibliotecă 2.600` (aceleași sume, total 16.000 lei ≈ 3.077 €). Butonul real e „Trimite”, sub titlul
   „Trimite oferta”. În cardul ofertei conversia apare în formatul real: „≈ 3.076,92 EUR”.
3. **Scena 3 — panoul de cost.** Textul real e „Cost: 12 credite · 200 credite” (fără „Sold”); soldul e
   arătat separat, mare, 200 → 188 „credite disponibile”.
4. **Scena 4 — „chat”.** Întrebarea se tastează în panoul real „Clarificări” (`claim-lifecycle-panel.tsx`),
   singurul loc care pune SLA-ul pe pauză; butonul „Cere clarificare” e cel real. „Fișiere” = rândul real
   „Fișierele cererii”. Adresa și telefonul clientului sunt parțial mascate (date fictive).
5. **Scena 6.** Secțiunile reale „Echipă” și „Permisiuni pe câmpurile ofertei” sunt comasate într-un singur
   tabel (rândurile = membrii cu badge-ul de rol, coloanele = Preț / Termen / Garanție) ca să încapă lizibil
   (≥ 30 px); „Termen” e forma scurtă din plan pentru „Termen de livrare”. Bifele = seed-ul implicit.
6. **Scena 7.** Pagina reală de mulțumire spune „Îți mulțumim pentru cerere!” și afișează numărul de
   8 caractere (A1F3C07E), nu „Mulțumim! Cererea #A1F3 a ajuns la noi”. „Inboxul firmei” e e-mailul intern real
   (subiect „Cerere nouă #REF — oraș”); destinatarul e scris generic („către echipa Mobila Unicat”) pentru că
   adresa reală vine din env. Clientul alege o piesă individuală (Bibliotecă) pentru că doar piesele au
   configurator 3D. Josefin Sans / Montserrat nu sunt disponibile offline → DM Sans (culorile și logo-ul
   poartă identitatea).
7. **Scena 8 — „Sold liber”.** Planul: `Disponibile 188 · Rezervate 12 · Sold liber 176`. În aplicație
   `GET /billing/wallet` întoarce `available = balance` (creditele rezervate sunt deja scoase din sold), deci
   pagina reală ar arăta 188 · 12 · 188; 176 ar scădea rezervarea de două ori. Valorile sunt în constanta
   `WALLET` din script. Planurile arată „Credite incluse” fără număr (15/50/120 vin din seed, ca prețurile)
   și liniile reale de acces (după 60 min / după 30 min / imediat).
8. **Scena 9.** Miniatura „Firmele partenere” a fost omisă: în 2 s ar fi concurat cu CTA-ul și nu putea
   respecta minimul de 30 px. S8 se termină la 39,75 s și S9 începe la 39,72 s (−0,28 s, în toleranța de ±0,3 s)
   ca CTA-ul să stea ~1,5 s complet pe ecran.

## Decizii necesare / întrebări deschise

1. **DECIZIE NECESARĂ: domeniul de la CTA** — `const SITE_URL = ''` la începutul scriptului; gol = doar wordmark.
2. **Formularul white-label ca ofertă pentru toate firmele** (scena 7) — azi există doar pentru Mobila Unicat.
   Dacă nu devine ofertă generală, scena 7 trebuie scoasă (31,0–36,0 s).
3. **„Sold liber”** — de confirmat că varianta 188 (semantica reală) e cea dorită, nu 176 din plan.
4. **Numele fictive** (Atelier Nord, Cristina V., Andrei P., Mihai D., Radu T., Ioana Marin, Ana M.) și
   sumele sunt exemple plauzibile; Mobila Unicat e singurul nume real.

## Note tehnice

- Nu am modificat `render.mjs`, `capture.mjs`, `lib/timeline.js`. Observații (nu buguri):
  - `tl.tween` rescrie tot `transform`-ul la fiecare cadru, deci două tween-uri pe același element se anulează.
    Scriptul folosește un registru propriu (`K(...)`) care compune segmentele pe proprietăți.
  - `tl.type` păstrează cursorul 600 ms după final — pentru câmpuri succesive am scris `typeIn` (cursor doar
    cât câmpul e activ).
- Fără `transition`/`@keyframes`/timere: tot e funcție de `t` (verificat: același `t` → același hash PNG
  indiferent de ordinea seek-urilor).
- Randarea completă a durat ~7 min (în paralel cu randarea video-ului 1).
