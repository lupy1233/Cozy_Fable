# Cozy Home — plan pentru cele două videouri promo (v2: ritm lent, capturi reale)

Scop: două clipuri 9:16 postabile pe Instagram Reels / TikTok / Facebook / YouTube Shorts, care prezintă
TOATE funcțiile platformei, fiecare pentru publicul lui.

| | Video 1 — CLIENȚI | Video 2 — FIRME DE MOBILIER |
|---|---|---|
| Obiectiv | mai mulți clienți care publică o cerere | mai multe firme care se înscriu și cumpără credite |
| Durată | **90 s** (limită 1:30) | **72 s** |
| Format | 1080×1920, 30 fps, H.264 MP4, pistă audio mută | idem |
| Promisiune | „Spui ce vrei. Firmele de mobilier concurează pentru tine.” | „Cereri reale, dimensionate, cu buget. Plătești doar când preiei.” |
| CTA final | „Începe o cerere — gratuit” | „Înscrie-ți firma” |

Schimbări față de v1 (feedback PO 2026-09-26): ritm mult mai lent; clipuri mai lungi; la clienți NU se mai
folosește landing-ul (nici mini-configuratorul din hero), ci **formularul real** de cerere și **Caietul de idei**;
la firme se scoate scena cu formularul white-label (Mobila Unicat a fost doar un test, nu devine opțiune generală)
și rămâne **ofertarea rapidă** din platformă; numele „Mobila Unicat” nu mai apare nicăieri.

Sunet: fără muzică (nu avem licență aici); textul de pe ecran duce mesajul. Muzica se adaugă la postare.

---

## Ritm (regula de bază pentru ambele clipuri)

- O singură idee pe scenă; titlul scenei intră primul și stă **minimum 3 s** înainte de prima acțiune în UI.
- O acțiune UI (tap, tastare, glisare) durează 0,6–0,9 s și e urmată de o **pauză de 1,0–1,5 s** în care nimic nu se mișcă.
- Un singur element în mișcare la un moment dat (excepție: cascade de carduri, la interval de 0,25 s).
- Nicio linie de text nu stă pe ecran mai puțin de **2,5 s**. Textele lungi se citesc cu voce tare: dacă nu se pot citi de două ori, scena e prea scurtă.
- Tranziții între scene: crossfade / glisare 0,8–1,0 s, ease in-out. Fără tăieturi dure (excepție: tăietura din hook).
- Panoramările/zoom-urile pe capturi reale: lente (≤ 60 px/s), niciodată simultan cu un tap.
- Cursorul/indicatorul de tap: cerc de alamă care apare 0,3 s înainte de acțiune și dispare după.

## Identitate vizuală (din `apps/frontend/src/app/globals.css` + `layout.tsx`)

- Fundal ivoriu `#F1EADF`, coală albă `#FFFFFF`, cerneală espresso `#1A1714`, text secundar `#766E63`
- Nuc / primary `#855232`, nuc adânc `#5C3B22`, nuc moale `#F0E5D7`; alamă ≈ `#B48431`; salvie ≈ `#5C7A57`; crimson ≈ `#9D3B2F`
- Fonturi: **Marcellus** (titluri), **DM Sans** (text/UI), **IBM Plex Mono** (etichete tehnice, cote)
- Limbaj „ATELIER”: coală de arhitect, colțare de plan, linii de cotă, sigiliu de alamă, fir de alamă între stații
- Toate textele în română cu diacritice. Nume de firme și persoane **fictive** (în capturile reale, numele din seed se redenumesc în baza locală înainte de captură: „A Mobila Premium” → „Atelier Nord”, „B DesignWood” → „DesignWood Studio”, „C CasaMea” → „CasaMea Mobilier”, „H VintageHaus” → „VintageHaus”).

## Sursa ecranelor: capturi REALE din stack-ul local complet

Stack-ul (Postgres + Redis + S3 mock + backend NestJS + frontend Next.js) rulează local cu seed-ul demo
(`docs/06-seed-scenarios.md`); detalii, conturi și rute în `DEMO-ENV.md`. Capturile se fac cu Playwright la
viewport de telefon 430×932 @2x (scripturi proprii per video, pornind de la `capture.mjs`), apoi sunt
încadrate în „telefon” și animate (panoramare lentă, tap, tranziții între stări).

Recreările HTML/CSS rămân doar pentru: recuzita din hook-uri, momente care nu se pot captura curat
(overlay-ul de publicare, sigiliul „ACCEPTATĂ”), și orice ecran pe care stack-ul local nu îl poate produce
(documentat în NOTES.md). Recreările folosesc etichetele reale din `ro.json` și clasele/culorile componentelor.

---

## Video 1 — CLIENȚI (90 s)

Fir: problema → te inspiri → începi cererea fără cont → alegi camere → răspunzi cu poze → cotele pe schiță →
3D → schița pe hârtie → estimare pe loc → publici gratuit → maxim 3 firme → compari → discuți & alegi →
livrare & recenzie → CTA.

| # | Timp | Scenă | Ce se vede (mișcare lentă) | Text pe ecran (RO) | Funcție |
|---|---|---|---|---|---|
| 1 | 0–4 | Hook | Bilețele cu prețuri scrise de mână și notificări de apel cad rar, apoi o coală de arhitect le mătură. | **Mobilă la comandă, fără 10 telefoane.** | poziționare |
| 2 | 4–12 | Caietul de idei | Captură reală `/ro/inspiration`: masonry cu pini; derulare lentă; tap pe un swatch de culoare (filtru) → grila se filtrează; tap pe un pin → lightbox cu „Idei asemănătoare”; „Salvează” → colecția „Dormitor”. | **Te inspiri din Caietul de idei.** · mono: `filtre · colecții · idei asemănătoare` | platforma de inspirație, filtre, colecții (boards), lightbox |
| 3 | 12–19 | Începi cererea | Captură reală `/ro/requests/new`, pasul „Cum pornim cererea?”: cele 3 carduri; tap pe „Știu ce vreau, dar nu am proiect”; stepper-ul avansează. | **Începi fără cont, în câteva minute.** · mic: `draftul se salvează singur` | draft anonim cu token, 3 moduri de pornire (inclusiv „Proiectare plătită”) |
| 4 | 19–26 | Camere & piese | Pasul „Ce camere vrei să mobilezi?”: tab-urile Camere / Piese individuale; tap „Dormitor”, tap „Dulap”; „Coșul cererii tale” se umple. | **Alegi camerele și piesele.** · mono: `10 camere · 10 piese` | coșul cererii, camere + piese individuale |
| 5 | 26–34 | Întrebări ghidate | Cartonașele cu ilustrații foto (materiale: MDF vopsit / furnir / PAL); tap pe „i” → cardul se întoarce: Avantaje / Dezavantaje / Preț mediu; apoi planșa de cote cu literele A / B / H — valorile tastate apar pe desen. | **Răspunzi cu poze, nu cu termeni tehnici.** · **Cotele apar pe schiță pe măsură ce le scrii.** | playing cards cu flip, planșe de dimensiuni |
| 6 | 34–42 | 3D în formular | Toggle „Configurează în 3D” în pasul camerei: corpul parametric; lățimea crește lent, apar 3 coloane, ușile se deschid (bară de haine, polițe), finisajul se schimbă. | **Îl vezi în 3D înainte să ceri oferte.** · mono: `L 180 · H 240 · A 60 cm` | configurator 3D stil Tylko integrat în cerere, snapshot PNG |
| 7 | 42–48 | Fișiere | Pasul „Adaugă poze sau planuri”: ghidul „Nu ai proiect? O schiță rapidă e de ajuns” (4 pași), o schiță pe hârtie urcă; badge „se scanează…” → „verificat”. | **Ai doar o schiță pe hârtie? E de ajuns.** | upload cu scanare antivirus, ghid de schiță |
| 8 | 48–55 | Detalii | Pasul „Date generale”: sliderul de buget cu „Estimare orientativă pe baza răspunsurilor tale: 8.500 – 12.000 lei”; cardurile de termen; adresa cu autocompletare; pinii salvați din Caietul de idei atașați la cerere. | **Primești o estimare pe loc.** · mic: `ideile salvate merg cu cererea` | buget estimat din scor, termen, adresă, inspirație atașată |
| 9 | 55–61 | Sumar & publicare | „Verifică și publică”: firul de semnătură cu bifele salvie; „Publică” → overlay „Publicăm cererea ta…” → cardul din „Cererile mele” cu status. | **Publici gratuit.** | review rail, publicare, „Cererile mele” |
| 10 | 61–66 | Firmele preiau | Sub card: 3 sloturi; primele două devin „ocupat” cu „Firmă verificată”, al treilea „liber”; clopoțelul „Cerere preluată de o firmă”. | **Cel mult 3 firme verificate o preiau.** · mic: `plătesc credite ca s-o vadă — interes real, nu spam` | claim max 3, firme verificate, notificări |
| 11 | 66–74 | Compari ofertele | Captură reală `/ro/requests/<id>/offers` (cererea cu 3 oferte): carduri cu „Versiunea N”, preț pe cameră, RON ≈ EUR, termen, garanție, „Valabilă până la…”, „Descarcă PDF”; derulare lentă între cele 3. | **Compari oferte structurate, negru pe alb.** · mono: `preț · termen · garanție · PDF` | oferte structurate, versiuni (max 3), RON+EUR, PDF |
| 12 | 74–80 | Discuți & alegi | Chat real cu firma (bule), „Cere modificare” → „Versiunea 2”; „Acceptă oferta” → sigiliu de alamă „ACCEPTATĂ”; celelalte conversații „doar pentru citire”. | **Discuți direct. Ceri modificări. Alegi.** | chat realtime, cerere de modificare, acceptare, read-only |
| 13 | 80–85 | Livrare & recenzie | „Comandă livrată” → „Confirmă livrarea” → 5 stele se umplu rar → „Recenzie publică”; notă „Sub 3 stele? Intervenim noi.” | **Confirmi livrarea. Lași recenzia.** | livrare confirmată, review, dispută automată |
| 14 | 85–90 | CTA | Logo Cozy Home, tagline, buton „Începe o cerere — gratuit”, linia de încredere pe 3 rânduri. | **Cozy Home** · *De la schița ta, la firma potrivită.* | — |

## Video 2 — FIRME DE MOBILIER (72 s)

Fir: problema → te înscrii și ești verificat → cereri dimensionate → fișa cererii → preiei cu credite →
fișa de lucru cu SLA → ofertare rapidă (o fișă, PDF, versiuni, acceptare) → preluări & mesagerie →
echipă → portofel & planuri → CTA.

| # | Timp | Scenă | Ce se vede (mișcare lentă) | Text pe ecran (RO) | Funcție |
|---|---|---|---|---|---|
| 1 | 0–4 | Hook | Foi PDF de ofertă zboară rar spre un telefon cu „Mulțumim, mai vedem…”; se sting în gri; tăietură pe ivoriu. | **Câte oferte trimiți degeaba?** | poziționare |
| 2 | 4–10 | Înscriere & verificare | Captură reală `/ro/register` cu opțiunea „Firmă — producem mobilier la comandă”; formularul firmei „Înregistrează firma” → „Trimite spre verificare” → pastila de status „Aprobată” + badge „Firmă verificată” + cardul din „Firmele partenere”. | **Te înscrii. Te verificăm. Apari între firmele partenere.** | onboarding, verificare, pagină publică parteneri |
| 3 | 10–18 | Cereri calificate | Captură reală `/ro/marketplace` (cont firmă): carduri cu badge-uri `Medie · 12 credite`, buget, distanță, „Sloturi 1/3”; derulare lentă; badge-urile se evidențiază pe rând cu linia mono. | **Cereri dimensionate, cu materiale și buget clar.** · mono: `mărime · buget · distanță · sloturi` | feed cu eligibilitate (rază, plan), scoring S/M/L, buget |
| 4 | 18–24 | Fișa cererii | Captură reală `/ro/marketplace/<id>`: fișa camerelor cu chips, „Vezi corpul în 3D” / „Vezi camera 3D”, inspirația clientului; contactul ascuns până la preluare. | **Vezi exact ce vrea clientul, înainte să preiei.** | fișă structurată, 3D read-only, inspirație |
| 5 | 24–30 | Preiei | Panoul de claim „Cost: 12 credite · 200 credite” → „Preia” → slotul 2/3 se umple; 200 → 188, „12 credite rezervate”. | **Plătești credite doar pentru proiectele pe care le preiei.** · **Cel mult 3 firme pe cerere.** | claim tranzacțional, credite rezervate, cost = buget minim / 1.000 |
| 6 | 30–38 | Fișa de lucru | Captură reală `/ro/marketplace/claims/<id>`: WorkBar („Se ocupă” → alegi angajatul; „Termen pentru ofertă (SLA)”; „Bugetul clientului”), cardul clientului, fișierele, „Clarificări” → „Cere clarificare” → „SLA în pauză”; chatul cu clientul. | **Fișă de lucru cu tot ce ai nevoie.** · mono: `SLA · client · chat · fișiere` | fișă de lucru, atribuire, SLA cu pauză, chat |
| 7 | 38–47 | Ofertare rapidă | Offer builder real: prețul pe fiecare cameră se tastează, totalul se adună singur, RON/EUR, termen, garanție, valabilitate → „Trimite” → cardul „Versiunea 1” cu „Descarcă PDF” → clientul cere modificare → „Versiunea 2” (`până la 3 versiuni`) → „Clientul a acceptat oferta.” → „Marchează ca livrată”. | **Ofertare rapidă: o singură fișă, PDF gata.** · mono: `până la 3 versiuni · RON/EUR` | ofertă structurată cu total automat, PDF, versiuni, acceptare, livrare |
| 8 | 47–53 | Preluări & mesagerie | Captură reală `/ro/marketplace/claims` (tabel cu status, SLA, necitite) și `/ro/marketplace/messages` (tab-uri Clienți / Echipa firmei, „doar citire”). | **Toate preluările și conversațiile, într-un loc.** | lista preluărilor, mesagerie master-detail |
| 9 | 53–60 | Echipă | Captură reală „Firma mea”: echipa cu badge-uri de rol (Proprietar / Manager / Angajat de încredere / Angajat coordonat), matricea de permisiuni pe câmpurile ofertei, chatul intern „Echipa firmei”. | **Lucrezi în echipă, cu roluri și permisiuni.** · mono: `chat intern, invizibil clientului` | echipe, roluri, permisiuni, chat de echipă |
| 10 | 60–67 | Portofel & planuri | Captură reală `/ro/marketplace/wallet`: „Disponibile / Rezervate / Sold liber”, planurile SILVER / GOLD / PLATINUM (gating), „Cumpără credite”, „Plată securizată Stripe”, „Trial: o lună Gold + 10 credite la aprobare”. | **Abonament flexibil. Credite doar când preiei.** · mono: `Stripe · factură automată` | abonamente, gating, pachete de credite, Stripe, facturare |
| 11 | 67–72 | CTA | Logo, „pentru firme”, buton „Înscrie-ți firma”, „Verificare gratuită · Cereri calificate · Fără spam”. | **Cozy Home pentru firme** | — |

---

## Reguli de conținut (verificate în cod/docs)

- NU folosi cifrele „340+ firme / 2.8k proiecte / 94%” — inventate (audit 2026-08-19), nu se randează.
- Rating-uri ale firmelor nu există (mereu null) — doar „Firmă verificată”.
- Reguli din `docs/03-business-rules.md` care pot apărea: max 3 firme per cerere; până la 3 versiuni de ofertă; SLA 3 zile lucrătoare (S/M) / 5 (L);
  cost preluare = 1 credit per 1.000 lei din bugetul minim estimat; trial 1 lună Gold + 10 credite la aprobare; recenzie sub 3 stele → dispută.
- Prețurile planurilor (Silver 149 / Gold 399 / Platinum 899 lei) vin din seed — NU apar în video; doar tier-urile.
- Fără „Mobila Unicat”, fără formularul white-label, fără landing page în video-ul de clienți.
- În capturile reale nu apar date personale reale: seed-ul e fictiv; se verifică fiecare cadru (e-mailuri, telefoane).
- Portofel: `available` = `balance` în API (`credits.service.ts`), deci „Disponibile 188 · Rezervate 12 · Sold liber 188” e afișarea reală.

## Decizii necesare (nu blochează livrarea)

1. **Domeniul / handle-ul afișat la CTA** — nu e definit în repo; `const SITE_URL` la începutul fiecărui `index.html`; gol → doar wordmark.

---

## Producție

```
marketing/videos/
  PLAN.md               ← acest plan (v2)
  README.md             ← cum randezi / modifici
  DEMO-ENV.md           ← stack-ul local complet: pornire, conturi, rute cu date seed
  demo-env/             ← scripturi start/stop pentru Postgres, Redis, S3 mock, backend, frontend
  render.mjs            ← HTML → cadre → MP4
  capture.mjs           ← capturi reale din aplicația locală (telefon 430×932 @2x)
  lib/timeline.js       ← cronologie deterministă
  assets/fonts/         ← Marcellus, DM Sans, IBM Plex Mono
  assets/shots/         ← capturi reale folosite în scene (clienti/, firme/)
  clienti/index.html    ← Video 1 (90 s)
  firme/index.html      ← Video 2 (72 s)
  out/                  ← MP4 finale + JSON
```

Comenzi:
```
cd marketing/videos
node render.mjs clienti --out out/cozy-home-clienti-9x16.mp4
node render.mjs firme   --out out/cozy-home-firme-9x16.mp4
node render.mjs clienti --stills 6,15,30 --contact 24 --stills-only   # QA vizual
```

## Recomandări de postare

- 9:16 pentru Reels/TikTok/Shorts; textul mare în „zona sigură” (sus 250 px, jos 320 px libere).
- Muzică din biblioteca platformei la postare; clipul e gândit pentru redare pe mut.
- Descriere sugerată (clienți): „Mobilă la comandă fără zeci de telefoane. Te inspiri, descrii vizual, primești până la 3 oferte de la firme verificate, compari și alegi. Gratuit.”
- Descriere sugerată (firme): „Cereri reale, dimensionate și cu buget. Preiei doar ce vrei, plătești credite doar când preiei, ofertezi dintr-o singură fișă. Înscrie-ți firma.”
