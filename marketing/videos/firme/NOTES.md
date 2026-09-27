# Video 2 — FIRME DE MOBILIER (v2) · note de producție

Livrabil: `marketing/videos/out/cozy-home-firme-9x16.mp4` — 1080×1920, 30 fps, **72,00 s** (2160 cadre),
H.264 High (yuv420p) + pistă AAC mută, 10,4 MB. Sursa: `firme/index.html` (cronologie deterministă, `lib/timeline.js`).
Înlocuiește v1 (42 s). Scena cu formularul white-label (a fost doar un test) a fost scoasă complet; logourile ei și
randarea 3D din v1 au fost șterse din `assets/shots/firme/`.

```
cd marketing/videos
node render.mjs firme --out out/cozy-home-firme-9x16.mp4                 # ~10,5 min (2160 cadre)
node render.mjs firme --stills-only --contact 24 --stills 9.2,15.2,29.2   # QA
```

Capturi (Playwright, owner.a@demo.ro = Andrei Albu / Atelier Nord, sesiune refolosită prin
`demo-env/tools/login.mjs`): `firme/_tools/cap-a.mjs` (fără modificări de stare), `cap-b.mjs`
(fișa de lucru 861163e7: atribuire, clarificare, ofertă + PDF), `cap-c.mjs` (chat de echipă, „Preia”
real, capturile de după). Capturile brute (PNG, DPR 3) stau în afara repo-ului (`RAW_DIR`, implicit scratchpad-ul sesiunii); `_tools/build-assets.py`
decupează cadrele folosite (JPEG q90 4:4:4, 1000 px lățime) în `assets/shots/firme/` (**~2 MB** în total).
`_tools/preview.py` = segmente de previzualizare, `_tools/cap-lib.mjs` = utilitare comune.

## Cum sunt prezentate capturile

- Telefon: ramă espresso 1024 px lată, ecran 1000 px; captura (viewport 430×932 CSS) e afișată la
  **2,5 px / CSS px**, fereastra orizontală CSS x 15…415 (se taie doar marginea de 15 px a paginii).
  Antetul aplicației e sticky, ca pe telefon (aceeași bandă de antet pentru toate paginile de firmă).
- Fereastra verticală vizibilă ≈ 330 CSS px sub antet (de la y 772 la 1590, apoi telefonul se
  estompează în hârtie, sub zona sigură de jos). Fiecare stare e un cadru decupat pe regiunea relevantă;
  schimbarea de cadru = fondu încrucișat 0,8 s (fără panoramări rapide; nu există nicio panoramare).
- Dimensiuni rezultate: text de corp 14–16 px CSS → 35–40 px; titluri de card 20–24 px → 50–60 px;
  `text-xs` 12 px → 30 px; **etichetele mono ale aplicației (10–10,5 px CSS: „SE OCUPĂ”, badge-urile
  „MICĂ · 4 CREDITE”) ajung la 25–26 px**. Ca ele să treacă de 30 px ar trebui ≥ 2,86 px/CSS px,
  adică un card de 398 px ar avea 1138 px — mai lat decât cadrul. Compromis: 2,5×; etichetele-cheie sunt
  evidențiate cu inele de alamă și repetate în linia mono de 44 px (scena 3).
- Titluri: Marcellus 84 px (cel mai mic text al videoului în afara capturilor e 44 px mono);
  blocul de text e ancorat jos la y ≈ 606, chiar deasupra telefonului; nimic în zona sigură sus 0–250 / jos 1600+.
- Indicatorul de atingere: cerc de alamă care apare cu 0,3 s înainte, apasă și dispare cu o undă.

## Cronologia finală (secunde)

Tranziții: fondu încrucișat 0,8 s centrat pe graniță [B−0,4; B+0,4]; titlul vechi dispare în
[B−0,4; B−0,12], cel nou intră în [B−0,1; B+0,4] (cuvinte în cascadă). „Acțiune” = atingere/tastare/
reîncadrare (0,6–0,9 s); după fiecare, 1,0–1,5 s în care nimic nu se mișcă.

| # | Interval | Text pe ecran | Ce se vede (real / recreat) | Acțiuni (t) · pauze |
|---|---|---|---|---|
| 1 | 0,0–4,4 | **Câte oferte trimiți degeaba?** | Recuzită ilustrată: telefon cu „Mulțumim, mai vedem…”, 3 foi PDF de ofertă zboară în cascadă (0,25 s), se sting în gri; tăietură pe ivoriu 3,9–4,4. | titlu 0–0,5 · telefon 0,6–1,15 · foi 1,15–2,1 · gri 2,8–3,3 · tăietură 3,9 |
| 2 | 4,4–10,4 | **Te înscrii. Te verificăm. Apari între firmele partenere.** | REAL: `/ro/register?role=company` (Tip de cont: „Firmă — producem mobilier la comandă” preselectat, termenii bifați) → REAL: cardul Atelier Nord din `/ro/partners` („Firmă verificată”, București, „Partener din aprilie 2023”, portofoliul) + pastila REALĂ „Status: Aprobată” decupată din „Firma mea” (autocolant). | titlu 4,4–4,9 · telefon 4,85–5,45 · atingere „Creează cont” 7,9 → cadru 7,95–8,7 · pauză 1,3 |
| 3 | 10,4–18,5 | **Cereri dimensionate, cu materiale și buget clar.** · `mărime · buget · distanță · sloturi` | REAL `/ro/marketplace` (200 credite): cardul „Mobilier baie suspendat · București”; cuvintele mono aprind pe rând „MICĂ · 4 CREDITE”, „SUB 5.000 RON”, „1.7 KM”, „Sloturi 0/3” → reîncadrare pe „Bucătărie în L cu insulă · București” (MARE · 25 CREDITE, 8.8 km). | inele 13,8–14,85 (cascadă 0,25) · pauză 1,2 · reîncadrare 16,05–16,85 · pauză 1,25 |
| 4 | 18,5–24,4 | **Vezi exact ce vrea clientul, înainte să preiei.** · `contact vizibil după preluare` | REAL `/ro/marketplace/ce41d9a4…`: fișa (descriere, Mărime: Mare · 25 credite, buget, 8.8 km, termen, Sloturi 0/3) → camera „01 Bucătărie 3.6 × 2.4 × 2.6 m”, „Corpuri și materiale” (MDF vopsit, Gola, Push, Aventos, insulă cu sertare). | reîncadrare 21,9–22,7 · pauză 1,3 |
| 5 | 24,4–30,3 | **Plătești credite doar pentru proiectele pe care le preiei.** · *Cel mult 3 firme pe cerere.* | REAL `/ro/marketplace/336fb0e8…`: „01 Baie”, corpuri, „Cost: 4 credite · 200 credite” + **Preia** → REAL (după preluarea făcută de mine) feed: „196 credite”, „Sloturi 1/3”, „PRELUATĂ DEJA DE FIRMA TA” (inele). | atingere „Preia” 27,8 → 27,85–28,6 · pauză 1,3 |
| 6 | 30,3–37,9 | **Fișă de lucru cu tot ce ai nevoie.** · `SLA · client · chat · fișiere` | REAL fișa 861163e7: WorkBar „Se ocupă: Neatribuit” (chenar chihlimbar), SLA, „Bugetul clientului 12.000 lei”, „Clientul tău Ana Popescu” → REAL „Se ocupă: Cristina Vlad” → REAL cardul „SLA și stare”: „Termen SLA … · în pauză (clarificare în curs)”, clarificarea „Bună ziua! Tavanul are 2,60 m pe toată lungimea peretelui? · Se așteaptă răspunsul clientului”. | atingere select 33,7 → 33,75–34,5 · pauză 1,2 · reîncadrare 35,7–36,5 · pauză 1,0 |
| 7 | 37,9–47,5 | **Ofertare rapidă: o singură fișă, PDF gata.** · `până la 3 versiuni · RON/EUR` | REAL builder „Trimite oferta” (preț pe cameră, Total —, Preț, Monedă RON) → se tastează „11800” (text suprapus peste câmpul real gol, DM Sans, aceeași poziție) → REAL: Total 11.800, preț blocat pe sumă → REAL: garanție 24 de luni, valabilitate 14, descriere, **Trimite** → REAL cardul „Atelier Nord · Versiunea 1 · Trimisă · Descarcă PDF”, 11.800,00 RON ≈ 2.269,23 EUR, 5 săptămâni + foaia **PDF reală** generată de backend (randată cu pypdfium2). | atingere+tastare 41,3–42,15 · pauză 1,0 · reîncadrare 43,15–43,95 · pauză 1,0 · atingere „Trimite” 44,95 → 45,0–45,75 (+PDF în cascadă 45,25) · pauză 1,15 |
| 8 | 47,5–53,4 | **Toate preluările și conversațiile, într-un loc.** | REAL `/ro/marketplace/claims` („Preluările mele”: baia nouă Mică · 4 credite, Dormitor → Cristina Vlad, „Neatribuită”) → REAL `/ro/marketplace/messages`, conversația „Bucătărie albă cu blat de stejar · București” (OFERTĂ TRIMISĂ, „Deschide fișa de lucru”, mesajele Andrei ↔ Ana). | reîncadrare 50,9–51,7 · pauză 1,3 |
| 9 | 53,4–59,5 | **Lucrezi în echipă, cu roluri și permisiuni.** · `chat intern, invizibil clientului` | REAL „Firma mea” → „Permisiuni pe câmpurile ofertei” (Proprietar / Manager / Angajat de încredere × Preț, Termen, Dată, Garanție) → REAL tab „Echipa firmei”: „Conversație internă — o văd doar membrii firmei tale. Clienții nu au acces aici.” + 2 mesaje reale Andrei Albu ↔ Cristina Vlad. | reîncadrare 56,8–57,6 · pauză 1,5 |
| 10 | 59,5–67,5 | **Abonament flexibil. Credite doar când preiei.** · `Stripe · factură automată` | REAL `/ro/marketplace/wallet`: 196 Disponibile · 4 Rezervate · 196 Sold liber; „Abonament · GOLD · ACTIV · Acces la cererile noi după 30 min” → Planuri SILVER / GOLD (Planul tău) / PLATINUM cu accesul (60 min / 30 min / imediat) → „Cumpără credite · … Plată securizată cu cardul (Stripe); prețurile includ TVA.” (inel). | reîncadrări 62,9–63,7 și 65,0–65,8 · pauze 1,3 / 1,3 |
| 11 | 67,5–72,0 | **Cozy Home** · *pentru firme* · **Înscrie-ți firma** · Verificare gratuită / Cereri calificate / Fără spam | Lockup-ul real (path-urile din `logo.tsx`), buton nuc cu reflex de alamă; ultimele 0,2 s → ivoriu (buclă curată). `SITE_URL` gol → fără URL. | cascadă 67,6–68,85 · reflex 70,2 |

Verificare „Ritm”: titlul stă ≥ 3,0 s înainte de prima acțiune în fiecare scenă (4,9→7,9; 10,8→13,8;
18,9→21,9; 24,8→27,8; 30,7→33,7; 38,3→41,3; 47,9→50,9; 53,8→56,8; 59,9→62,9); acțiunile 0,75–0,85 s;
pauze 1,0–1,5 s; tranziții 0,8 s; un singur element în mișcare (inelele/autocolantele/PDF-ul apar odată
cu fondul încrucișat sau în cascadă de 0,25 s); fără panoramări; fiecare text ≥ 2,5 s (cele mai scurte:
foaia PDF 3 din hook 1,65→~4,15 s și cadrul cu totalul tastat din S7, 41,85→43,95 s ≈ 2,1 s — acesta e
același cadru cu cel dinainte, cu o singură valoare schimbată). Abaterile de la granițele din PLAN sunt ≤ 0,5 s
(S2 începe la 4,4; S3 se termină la 18,5; S7 37,9–47,5; S9 se termină la 59,5; CTA începe la 67,5).

## Real vs. recreat

- **Real (capturat din stack-ul local)**: toate ecranele de firmă din scenele 2–10 (22 de cadre din 18 capturi),
  pastila „Status: Aprobată”, PDF-ul ofertei (fișierul generat de backend la „Descarcă PDF”).
- **Recreat**: recuzita din hook (foi PDF, chat generic „Ana M.”), CTA-ul, indicatorul de atingere,
  inelele de alamă, textul „11800” în timpul tastării (0,45 s, peste câmpul gol real; apoi fondu în
  captura reală cu valoarea tastată de Playwright).
- **Mascat la captură**: e-mailurile de login `…@demo.ro` (doar subșirul, blur 6 px — cardul clientului,
  echipa); **prețurile planurilor** Silver/Gold/Platinum (rândurile de preț au `display:none` în captură,
  regula din PLAN). Telefonul și adresa clientei (Ana Popescu, 0722 481 305, Str. Ion Câmpineanu 18) sunt
  date fictive din seed.

## Modificări făcute în DB-ul demo (nu am rulat reset-db.sh)

1. Preluarea 861163e7 (Dormitor: dulap și noptiere · București): **„Se ocupă” → Cristina Vlad**.
2. Aceeași preluare: **clarificare PENDING** „Bună ziua! Tavanul are 2,60 m pe toată lungimea peretelui?”
   → SLA în pauză (termen mutat la 29.09.2026 20:59:59); Ana a primit notificarea.
3. Aceeași preluare: **ofertă trimisă** (quote `6beffebe-c6b5-4997-bf39-b73e70af4a7f`, Versiunea 1,
   11.800 RON, 5 săptămâni, 24 de luni, valabilă 14 zile, cu defalcare pe camera „Dormitor”); PDF-ul
   generat o dată. Preluarea e acum OFFER_SENT.
4. **Chatul intern „Echipa firmei”** al Atelier Nord: 2 mesaje („Cristina, verifici stocul de MDF alb mat
   pentru dulapul din București?” — Andrei Albu; „Da, ajunge pentru tot dulapul. Programez releveul joi.” —
   Cristina Vlad, logată o dată ca `trusted1.a@demo.ro`).
5. **„Preia” real** pe `336fb0e8…` (Mobilier baie suspendat · București, clienta Sorina Matei): slot nou
   `cb72f0b5-01c3-4f2b-9cac-4bbc15a26149`, 4 credite rezervate → portofel 196 / 4 / 196, cererea 1/3.
6. Conversația cu Ana (Bucătărie albă) a fost deschisă → marcată citită pentru owner.a.
Toate se anulează cu `demo-env/reset-db.sh` (după ce ambii agenți au terminat).

## Abateri de la PLAN / brief (și de ce)

1. **Ritmul decide ce încape.** Cu regulile din „Ritm” (3 s de titlu, acțiune 0,6–0,9 s + 1,0–1,5 s pauză,
   fondu 0,8 s) o scenă de 6 s are loc pentru o singură acțiune, una de 8 s pentru două, S7 (9,6 s) pentru
   trei. De aceea:
   - **S7 nu mai arată „Versiunea 2 → Clientul a acceptat oferta. → Marchează ca livrată → Finalizată”**.
     Capturile reale există (`6b85f005` Versiunea 2 · Trimisă, `34be4ac5` „Clientul a acceptat oferta.” +
     „Marchează ca livrată”, `e797deb9` FINALIZATĂ), dar ar fi cerut încă ~4 s. „până la 3 versiuni” rămâne
     doar în linia mono. Vezi întrebarea 2.
   - **S2** nu mai arată formularul de onboarding „Înregistrează firma / Trimite spre verificare” (l-am
     capturat real, forțând în browser 404 pe `GET /companies/me` pentru owner.a — în DB nu există cont de
     firmă fără firmă — dar formularul are 450 px CSS, nu încape cu butonul în fereastră). Înscrierea e
     reprezentată de pagina reală de register (tip de cont Firmă), verificarea de pastila reală „Aprobată”.
     Trecerea „Creează cont → Aprobată + listat” e comprimată într-un fondu (verificarea adminului nu se vede).
   - **S6**: atingerea pe „Cere clarificare” nu apare; se vede starea reală de după (întrebarea trimisă,
     „în pauză (clarificare în curs)”). Chatul clientului din fișa 861163e7 e gol (n-am scris clientei
     ca să nu schimb contul Anei pentru agentul „clienți”); chatul real apare în S8.
   - **S9**: matricea de permisiuni (rolurile sunt coloanele) în loc de lista membrilor cu badge-uri; pe
     telefon a 4-a coloană („Angajat coordonat”) iese din ecran — comportamentul real (tabel derulabil).
   - **S10**: fără facturile MM 1038–1042 (rândul „Abonament GOLD · 482,79 lei” ar arăta prețul planului).
     „Trial: o lună Gold + 10 credite” nu există în UI → nu apare.
2. **S3/S4 — 3D și inspirație**: niciuna dintre cererile din feed-ul lui owner.a nu are piese configurate 3D,
   scene Studio sau pini de inspirație (în DB: `answers` null, 0 `request_studio_scenes`, 0
   `request_inspiration_photos`), deci „Vezi corpul în 3D” / „Vezi camera 3D” / inspirația nu pot fi
   capturate. N-am inventat date. În locul lor: „Corpuri și materiale” reale + linia `contact vizibil după
   preluare` (invarianta 4.2 — contactul lipsește din fișa de marketplace).
3. **S5 — cifre**: PLAN spune 12 credite / 200 → 188. Preluarea reală a fost pe cererea Mică de 4 credite
   (recomandarea din brief), deci 200 → **196**, 4 rezervate, „Sloturi 1/3”. Portofelul din S10 e cel de după
   preluare (196 · 4 · 196; `available = balance`, ca în v1).
4. **S8**: tabelul arată coloanele „Cerere / Preluată de / Atribuită lui” (etapa și SLA sunt în dreapta
   tabelului, derulabil pe telefon); a doua stare e o conversație deschisă în loc de lista cu tab-uri
   (lista are 3 rânduri „Niciun mesaj încă.” sus; tab-urile „Clienți / Echipa firmei” se văd în S9).
5. **Capturile sunt la DPR 3** (același viewport 430×932, același layout) ca zoom-ul de 2,5× să rămână clar.
6. **Antet unic**: toate paginile de firmă folosesc aceeași bandă de antet (din captura feed-ului, clopoțelul
   cu „1”); între capturi numărul de notificări a crescut la 5 din cauza acțiunilor mele.
7. **Stripe**: textul real „Plată securizată cu cardul (Stripe)” e în paragraful „Cumpără credite” al
   portofelului (Stripe e dezactivat local, butoanele ar duce la transfer bancar — nu le arăt), deci n-a fost
   nevoie de autocolant peste captură.
8. Hook-ul are acum 3 foi PDF (nu 5), ca fiecare să stea ≥ 2,5 s pe ecran.

## Probleme observate în aplicație (nu le-am reparat — în afara zonei mele)

- PDF-ul ofertei afișează statusul brut în engleză: „Versiunea 1 · **SENT**” (enum netradus în șablon).
- Fișa de lucru: sub data SLA scrie „chiar acum” lângă o dată viitoare (deja notat în DEMO-ENV §10) — se
  vede în S6.
- `input[type=date]` din builder apare „mm/dd/yyyy” în Chromium headless chiar cu `--lang=ro-RO`; cadrele
  sunt alese ca să nu-l arate.

## Decizii necesare / întrebări deschise

1. **DECIZIE NECESARĂ: domeniul de la CTA** — `const SITE_URL = ''` în `index.html`; gol = doar wordmark.
2. **Ciclul ofertei (Versiunea 2 → acceptată → livrată → finalizată)**: nu încape în 72 s cu ritmul cerut.
   Variante: (a) +6 s o scenă 7b dedicată (clip de 78 s); (b) scoaterea S8 și folosirea timpului pentru 7b;
   (c) un clip scurt separat „Ofertare rapidă”. Capturile reale sunt pregătite (`cap-a.mjs v2 exec done`).
3. **3D / inspirație în fișa cererii (S4)**: dacă sunt importante, e nevoie de o cerere în raza lui
   Atelier Nord publicată prin wizard cu o piesă configurată 3D și pini atașați (nu există în seed).
4. **Etichetele mono de 10 px** ale aplicației ies la ~25 px în video; dacă 30 px e strict și pentru ele,
   trebuie capturi la un viewport mai îngust (ex. 360 px) sau cadre tăiate pe jumătate de card.
