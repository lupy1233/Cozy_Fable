# Cozy Home — plan pentru cele două videouri promo (9:16, 30–45 s)

Scop: două clipuri scurte, postabile pe Instagram Reels / TikTok / Facebook / YouTube Shorts,
care prezintă TOATE funcțiile platformei, fiecare pentru publicul lui:

| | Video 1 — CLIENȚI | Video 2 — FIRME DE MOBILIER |
|---|---|---|
| Obiectiv | mai mulți clienți care publică o cerere | mai multe firme care se înscriu și cumpără credite |
| Durată țintă | 40 s (limită 45 s) | 42 s (limită 45 s) |
| Format | 1080×1920, 30 fps, H.264 MP4, pistă audio mută | idem |
| Promisiune | „Spui ce vrei. Firmele de mobilier concurează pentru tine.” | „Cereri reale, dimensionate, cu buget. Plătești doar când preiei.” |
| CTA final | „Începe o cerere — gratuit” | „Înscrie-ți firma” |

Sunet: clipurile se livrează fără muzică (fără licență disponibilă aici); textul de pe ecran duce
mesajul, cum se consumă majoritatea reel-urilor pe mut. Muzica se adaugă la postare
(biblioteca Instagram/TikTok) — vezi „Recomandări de postare” la final.

---

## Identitate vizuală (din `apps/frontend/src/app/globals.css` + `layout.tsx`)

- Fundal ivoriu `#F1EADF`, coală albă `#FFFFFF`, cerneală espresso `#1A1714`, text secundar `#766E63`
- Nuc / primary `#855232` (butoane), nuc adânc `#5C3B22`, nuc moale `#F0E5D7`
- Alamă `hsl(38 57% 45%)` ≈ `#B48431` — detalii premium, firul care leagă stațiile
- Salvie `hsl(111 17% 41%)` ≈ `#5C7A57` — bifă/complet; Crimson `hsl(7 54% 40%)` ≈ `#9D3B2F` — alertă
- Fonturi: **Marcellus** (titluri), **DM Sans** (text/UI), **IBM Plex Mono** (etichete tehnice, cote, „№ 0001”)
- Limbaj vizual „ATELIER”: coală de arhitect, colțare de plan, linii de cotă, sigiliu de alamă, fir de alamă care se desenează
- Logo: casa cu lumânare de alamă + wordmark „COZY HOME” cu litere spațiate (vezi `public/` în frontend)
- Toate textele în română cu diacritice.

Ecranele de produs se randează în două feluri:
1. **Capturi reale** din frontend-ul pornit local (fără backend): landing cu mini-configuratorul
   funcțional (`/ro`), Studio 3D cu configuratorul de corpuri (`/ro/studio`), ghidul de schiță
   (`/ro/sketch-guide`). Se fac cu `capture.mjs` la viewport de telefon 430×932 @2x.
2. **Recreări HTML/CSS fidele** (aceleași clase/tokens ca în componentele reale, citite din `.tsx`)
   pentru ecranele care au nevoie de backend: feed marketplace, fișa de lucru, ofertă, chat, portofel.
   Avantaj: le putem anima (prețul care se adună, slotul care se ocupă, sigiliul care se aplică).

---

## Video 1 — CLIENȚI (40 s)

Fir narativ: problema (haos, telefoane) → descrii vizual → 3D → schiță + estimare → publici gratuit →
maxim 3 firme verificate → compari oferte structurate → chat & alegi → livrare & recenzie → CTA.

| # | Timp | Scenă | Ce se vede (mișcare) | Text pe ecran (RO) | Funcție acoperită |
|---|---|---|---|---|---|
| 1 | 0.0–3.0 | Hook | Fundal ivoriu; 4–5 „bilețele” cu prețuri scrise de mână și notificări de apel cad dezordonat, apoi sunt „măturate” de o coală de arhitect curată cu colțare. | **Mobilă la comandă, fără 10 telefoane.** | poziționare |
| 2 | 3.0–8.0 | Descrii vizual | Captură reală a mini-configuratorului din hero: se bifează pe rând „Dulap” → „160 cm” → „Furnir stejar” → „Mânere”; schița izometrică se transformă; sub ea se tastează linia de spec. | **Descrii vizual ce vrei** · spec tastat: `Dulap 160 cm · Furnir stejar · Mânere` | configurator ghidat, 10 camere + 10 piese, cartonașe cu ilustrații |
| 3 | 8.0–13.0 | 3D | Corp de dulap parametric (capturi din Studio 3D sau recreare CSS 3D): lățimea crește, apar 3 coloane, ușile se deschid și se văd polițele și bara de haine; paletă de finisaje. | **Îl configurezi în 3D** · mono: `L 180 · H 240 · A 60 cm` | configurator 3D stil Tylko, Studio 3D „mod Sims” |
| 4 | 13.0–17.0 | Schiță + estimare | Fotografie de schiță pe hârtie „urcă” în zona de upload; badge „se scanează…” → „verificat” (salvie). Alături sliderul de buget: „Estimare orientativă pe baza răspunsurilor tale: 8.500 – 12.000 lei”. | **Ai doar o schiță pe hârtie? E de ajuns.** · **Primești o estimare pe loc.** | upload cu scanare antivirus, ghid de schiță, buget estimat din scor (ofertare rapidă pentru client) |
| 5 | 17.0–22.0 | Publici | Butonul „Publică cererea” apasă → overlay „Publicăm cererea ta…” → cardul cererii „Dulap dormitor · București” cu badge „Publicată”. Sub el, 3 sloturi: primul devine „ocupat” cu insigna „Firmă verificată”, al doilea la fel, al treilea rămâne „liber”. | **Publici gratuit.** · **Cel mult 3 firme verificate o preiau.** | draft anonim, publicare gratuită, claim max 3, firme verificate |
| 6 | 22.0–28.0 | Compari ofertele | Trei carduri de ofertă intră în cascadă: „Atelier Nord · Versiunea 2 · 9.800 lei ≈ 1.885 €”, „Mobila Unicat · Versiunea 1 · 10.400 lei”, „Lemn & Formă · Versiunea 3 · 9.200 lei”. Fiecare: preț pe cameră, termen 5 săpt., garanție 24 luni, „Valabilă până la…”, buton „Descarcă PDF”. | **Compari oferte structurate, negru pe alb.** · mono: `preț · termen · garanție · PDF` | ofertă structurată, versiuni (max 3), RON+EUR, PDF, valabilitate |
| 7 | 28.0–33.0 | Chat & alegi | Bule de chat: firmă „Putem face ușile push-to-open, +300 lei.” / client „Perfect, trimiteți varianta.” → badge „Versiunea 3”. Butonul „Acceptă oferta” apasă → sigiliu de alamă „ACCEPTATĂ” se ștanțează; celelalte două carduri devin gri cu „Conversație închisă · doar citire”. | **Discuți direct. Ceri modificări. Alegi.** | chat realtime, cerere de modificare, acceptare, chat read-only pentru ceilalți |
| 8 | 33.0–37.0 | Livrare & recenzie | Card „Comandă livrată” → „Confirmă livrarea” → 5 stele se umplu pe rând (alamă) → „Recenzie publică”. Notă mică: „Sub 3 stele? Intervenim noi.” | **Confirmi livrarea. Lași recenzia.** | livrare confirmată de client, review, dispute automat sub 3 stele |
| 9 | 37.0–40.0 | CTA | Logo Cozy Home mare pe ivoriu, tagline, buton nuc „Începe o cerere”, sub el linia de încredere. | **Cozy Home** · *De la schița ta, la firma potrivită.* · **Începe o cerere — gratuit** · `Gratuit pentru clienți · Firme verificate · Cel mult 3 oferte` | — |

Funcții menționate discret (text mic sau iconiță, fără scenă proprie): Caietul de idei (inspirație
Pinterest-style) — apare ca strip de 4 imagini în scena 2 sau 4; notificări (clopoțel cu „Ofertă nouă”)
în scena 6; „Cererile mele” cu statusuri în scena 5.

## Video 2 — FIRME DE MOBILIER (42 s)

Fir narativ: problema (ofertezi degeaba) → cereri dimensionate cu buget → preiei, max 3 firme →
fișă de lucru cu SLA → ofertare rapidă (o fișă, PDF) → echipă & roluri → formular de ofertare rapidă
pe site-ul tău → planuri, credite, Stripe → CTA.

| # | Timp | Scenă | Ce se vede (mișcare) | Text pe ecran (RO) | Funcție acoperită |
|---|---|---|---|---|---|
| 1 | 0.0–3.0 | Hook | Un teanc de „oferte” (foi PDF) zboară spre un telefon care afișează „Mulțumim, mai vedem…”; foile se fac gri. Tăietură pe ivoriu curat. | **Câte oferte trimiți degeaba?** | poziționare |
| 2 | 3.0–9.0 | Cereri calificate | Feed marketplace (recreare fidelă `marketplace/page.tsx`): 3 carduri intră de jos: „Bucătărie în L + insulă · București” cu badge-uri `Medie · 12 credite`, `12.000 – 18.000 lei`, `14 km`, `Sloturi 1/3`; „Dressing walk-in · Cluj-Napoca · Mare · 25 credite · 25.000 – 32.000 lei · 9 km · Sloturi 0/3”; „Bibliotecă living · Timișoara · Mică · 4 credite · 4.000 – 6.000 lei · 22 km · Sloturi 2/3”. Un card se deschide: fișa camerei cu chips `4 coloane · 2 uși · 12 polițe`, buton „Vezi camera 3D”. | **Cereri dimensionate, cu materiale și buget clar.** · mono: `mărime · buget · distanță · sloturi` | feed cu eligibilitate (rază, plan), scoring S/M/L, buget estimat, fișă structurată, 3D read-only |
| 3 | 9.0–14.0 | Preiei | Panoul de claim: „Cost: 12 credite · Sold 200 credite” → butonul „Preia” apasă → slotul 2 din 3 se umple (SlotTrack), creditele se rezervă (200 → 188). Text: „nu 30 de firme, cel mult 3”. | **Plătești credite doar pentru proiectele pe care le preiei.** · **Cel mult 3 firme pe cerere.** | claim tranzacțional, credite rezervate, cost = buget minim / 1.000 |
| 4 | 14.0–20.0 | Fișa de lucru | WorkBar: „Se ocupă: Andrei P.” (select), „Termen pentru ofertă (SLA): 3 zile lucrătoare” cu cronometru, „Bugetul clientului: 12.000 – 18.000 lei”. Card client cu inițiale, telefon, adresă. Chat: „Bună! Blatul e inclus în buget?” → „Cere clarificare” → SLA „în pauză”. | **Fișă de lucru cu tot ce ai nevoie.** · `SLA · client · chat · fișiere` | fișă de lucru, atribuire angajat, SLA cu pauză la clarificare, chat |
| 5 | 20.0–26.0 | Ofertare rapidă | Offer builder (recreare `offer-builder.tsx`): se tastează prețul pe cameră `Bucătărie 13.400` + `Insulă 2.600` → totalul se adună singur `16.000 lei ≈ 3.077 €`; termen `6 săpt.`, garanție `24 luni`, valabilitate `14 zile` → „Trimite oferta” → apare cardul „Versiunea 1 · PDF” cu iconița de descărcare. | **Ofertare rapidă: o singură fișă, PDF gata.** · mic: `până la 3 versiuni · RON/EUR` | ofertă structurată cu total automat, PDF, versiuni, reofertare |
| 6 | 26.0–31.0 | Echipă | Card „Echipa firmei”: badge-uri de rol `Proprietar` (nuc) · `Manager` (salvie) · `Angajat de încredere` · `Angajat coordonat`; matricea de permisiuni (Preț / Termen / Garanție × roluri) cu bife; tab „Echipa firmei” în mesagerie cu o bulă internă „Verifică stocul de MDF înainte de ofertă”. | **Lucrezi în echipă, cu roluri și permisiuni.** · `chat intern, invizibil clientului` | echipe și roluri, permisiuni pe câmpurile ofertei, chat de echipă criptat |
| 7 | 31.0–36.0 | Formular pe site-ul tău | Telefon cu formularul „ofertare rapidă” în brandul unei firme (exemplu real: Mobila Unicat — roșu `#EF3B31`, navy `#343E52`, Josefin Sans): clientul alege camere, configurează 3D, trimite **fără cont** → „Mulțumim! Cererea #A1F3 a ajuns la noi” → în dreapta apare inbox-ul firmei/e-mail „Cerere nouă” cu fișa completă. | **Același formular, pe site-ul tău.** · `clienții configurează · tu primești fișa completă` | aplicația de ofertare rapidă (white-label, repo `cozy-mobilaunicat`) |
| 8 | 36.0–40.0 | Planuri & credite | Portofel: trei cifre serif „Disponibile 188 · Rezervate 12 · Sold liber 176”; cardurile de plan `SILVER · GOLD · PLATINUM` (TierBadge gradient) cu „credite incluse” și „Acces imediat la cererile noi” pe Platinum; badge „Plată securizată Stripe”; linia „Trial: o lună Gold + 10 credite la aprobare”. | **Abonament flexibil. Credite doar când preiei.** · `Stripe · factură automată` | abonamente, gating per plan, pachete de credite, Stripe Checkout, facturare |
| 9 | 40.0–42.0 | CTA | Logo Cozy Home, buton nuc „Înscrie-ți firma”, sub el „Verificare gratuită · Cereri calificate · Fără spam”. | **Cozy Home pentru firme** · **Înscrie-ți firma** | — |

Funcții menționate discret: verificarea firmei (badge „Firmă verificată” pe cardul firmei în scena 3),
retragerea preluării cu rambursare (rând mic în scena 4), pagina publică „Firmele partenere” cu
portofoliu (miniatură în scena 9).

---

## Reguli de conținut (verificate în cod/docs)

- NU folosi cifrele vechi „340+ firme / 2.8k proiecte / 94%” — sunt inventate (audit 2026-08-19) și nu se randează.
- Rating-uri ale firmelor nu există încă (mereu null) — nu arăta stele la firme, doar „Firmă verificată”.
- Reguli din `docs/03-business-rules.md` care pot apărea în text: max 3 firme per cerere; până la 3 versiuni de ofertă;
  SLA 3 zile lucrătoare (S/M) / 5 (L); cost preluare = 1 credit per 1.000 lei din bugetul minim estimat;
  trial 1 lună Gold + 10 credite la aprobare; recenzie sub 3 stele → dispută gestionată de admin.
- Prețurile planurilor (Silver 149 / Gold 399 / Platinum 899 lei) vin din seed — NU le pune în video; arată doar tier-urile.
- Numele de firme din exemple sunt fictive, în afară de „Mobila Unicat” (partener real, folosit în scena 7 a video-ului 2).
- Sumele din exemple sunt plauzibile, nu promisiuni; nu apar cuvinte ca „garantat”, „cel mai ieftin”.

## Decizii necesare (nu blochează livrarea; se pot schimba dintr-o constantă în HTML)

1. **Domeniul / handle-ul afișat la CTA** — nu e definit în repo (`.env.example` dă doar exemplul `cozyhome.ro`).
   În HTML există `const SITE_URL` la începutul fiecărui `index.html`; până la confirmare CTA-ul afișează wordmark-ul, nu domeniul.
2. **Formularul white-label ca ofertă pentru toate firmele** — azi există doar pentru Mobila Unicat (`cozy-mobilaunicat`).
   Video-ul îl prezintă ca funcție disponibilă firmelor, conform cererii; dacă nu e încă ofertă generală, scena 7 se scoate (`--from/--to` sau se ascunde scena).

---

## Producție

Fiecare video = o pagină HTML cu o cronologie deterministă (`lib/timeline.js`), randată cadru cu cadru
cu Playwright/Chromium și codată H.264 cu ffmpeg (`render.mjs`). Nu există dependență de timp real,
deci randarea e reproductibilă și fiecare cadru poate fi inspectat (`--stills`, `--contact`).

```
marketing/videos/
  PLAN.md               ← acest plan
  README.md             ← cum randezi / modifici
  render.mjs            ← HTML → cadre → MP4
  capture.mjs           ← capturi reale din aplicația locală (telefon 430×932 @2x)
  lib/timeline.js       ← cronologie deterministă (scene, tween, type, count, WAAPI seek)
  assets/fonts/         ← Marcellus, DM Sans, IBM Plex Mono (self-hosted)
  assets/shots/         ← capturi reale folosite în scene
  clienti/index.html    ← Video 1
  firme/index.html      ← Video 2
  out/                  ← MP4 finale + JSON cu metadate
```

Comenzi:
```
cd marketing/videos
node render.mjs clienti --out out/cozy-home-clienti-9x16.mp4
node render.mjs firme   --out out/cozy-home-firme-9x16.mp4
node render.mjs clienti --stills 2,7,12 --contact 16 --stills-only   # QA vizual
```

## Recomandări de postare

- 9:16 pentru Reels/TikTok/Shorts; textul mare stă în „zona sigură” (fără UI-ul platformei: sus 250 px, jos 320 px).
- Adaugă muzică din biblioteca platformei la postare; clipul e gândit pentru redare pe mut.
- Prima secundă are hook text, fără logo — logo-ul vine la final.
- Descriere sugerată (clienți): „Mobilă la comandă fără zeci de telefoane. Descrii vizual, primești până la 3 oferte de la firme verificate, compari și alegi. Gratuit.”
- Descriere sugerată (firme): „Cereri reale, dimensionate și cu buget. Preiei doar ce vrei, plătești credite doar când preiei, ofertezi dintr-o singură fișă. Înscrie-ți firma.”
