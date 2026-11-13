# SX — conturi noi, concurenta intre firme, tabelul de comparare (local, 2026-11-12)

Mediu: `http://localhost:3000` (Next dev), Playwright + Edge headless. WebGL: `ANGLE (NVIDIA, NVIDIA GeForce GTX 1070 Direct3D11)` — ruleaza pe GPU.
Scripturi: `AUDIT\scripts\SX\`, capturi: `AUDIT\shots\SX\<scenariu>\` (fiecare PNG are langa el un `.txt` cu textul paginii, consola si retea >= 400; `_notes.txt` = jurnalul scenariului).

## 1. Scenarii

| ID | Ce face | Rezultat | Pe scurt |
|---|---|---|---|
| SX-01 | vizitator → Baie → Sumar → cont nou → confirmare e-mail → login → publicare | TRECUT cu frecari | ciorna supravietuieste; dar dupa confirmarea e-mailului omul ajunge pe Panou, care spune „nu ai nicio cerere”, fara nicio mentiune a ciornei |
| SX-02 | resetare parola owner.b + firma B cu abonament expirat | PARTIAL | resetarea merge; firma expirata isi pierde lista de preluari (403), desi are 4 oferte in curs; nicaieri data expirarii |
| SX-03 | Living, 3 firme, tabel de comparare, mesaje, acceptare | PARTIAL | a treia firma imposibila (B expirata); prima incercare a picat: dupa PRIMA oferta cererea dispare din marketplace (`claims_open_after_first_offer=false`), deci firma D n-a mai putut prelua; refacut cu ambele preluari INAINTE de oferte. Tabelul nu aduce la acelasi numitor RON/EUR, zile/saptamani, fara TVA; PDF-ul ofertei da 500 |
| SX-04 | refuz in lant | NEACOPERIT | n-am apucat (timp consumat cu blocajele din SX-03 si o repornire a serverului) |
| SX-05 | firma (owner.d) publica o cerere | PICAT (defect confirmat) | serverul accepta publicarea; cererea apare in marketplace-ul aceleiasi firme cu buton „Preia cererea…”; firma n-o mai gaseste in „Cererile mele” (pagina da eroare) |
| SX-06 | ziduri intre roluri prin URL direct | PARTIAL | zidurile tin (nicio scurgere de date), dar mesajele sunt seci / gresite si vizitatorul pe link adanc NU e dus la login sau e dus fara intoarcere |

## 2. Constatari

### SX-01 — client nou, de la vizitator la cerere publicata
Pasi: 6 ecrane de formular (Pornire, Camere, 5 ecrane de intrebari Baie, Fisiere, Date generale, Sumar) → buton „Autentifica-te pentru a publica” (duce la `/login?redirect=/requests/new`) → Creeaza cont (`/register`) → ecran „Contul a fost creat” → e-mail „Confirmă adresa de email — Cozy Home” (RO, diacritice, link valabil 24 h, merge) → `/verify-email` „Emailul a fost confirmat — Mergi la autentificare” → `/login` → **`/dashboard`** → (manual) „Cerere noua” → dialog „Ai o cerere inceputa — Continua de unde am ramas” → Sumar → „Publica cererea” → `/ro/requests/3993c82a-…` (IN_MARKETPLACE, SMALL, 10 credite, expira 19 nov). In total ~9 ecrane dupa Sumar pana la publicare, plus o vizita in casuta de e-mail.

**SX-01** · P1 · UX/defect · `/verify-email` → `/login` → `/dashboard`
- Ce se intampla: drumul de intoarcere la ciorna se pierde la confirmarea e-mailului. Butonul de pe Sumar trimite la `/login?redirect=/requests/new`, iar login → register pastreaza `redirect`; dar linkul din e-mail deschide `/verify-email`, al carui buton „Mergi la autentificare” e `href="/login"` fara `redirect` (`apps/frontend/src/app/[locale]/(auth)/verify-email/page.tsx:33` si `:50`). Dupa login omul ajunge pe Panou, care spune „Nu ai nimic de făcut acum” si „Încă nu ai nicio cerere. Creează prima…” — desi are o cerere completa care asteapta doar „Publica”.
- Ce ar trebui: dupa confirmare + login, clientul ajunge direct pe Sumarul ciornei (sau Panoul ii arata „Ai o cerere gata de publicare — Publica acum”).
- Dovada: `shots/SX/SX-01/17-visitorsx1-verified.png`, `18-visitorsx1-after-login.png`; ciorna exista (`19-visitorsx1-new-after-login.png`, dialogul „Ai o cerere începută”).
- Propunere: puneti `redirect` in linkul de verificare (sau in tokenul de verificare) si folositi-l pe `/verify-email`; pe Panou, card „Ciorna ta e gata de publicare” cand exista ciorna anonima legata de browser; ideal, autentificare automata dupa confirmare.

**SX-02** · P2 · inconsecventa · Date generale vs Sumar, rubrica „Buget”
- Ce se intampla: pe pasul Date generale scrie „Estimare orientativă pe baza răspunsurilor tale: 10.000 lei – 30.000 lei”, cursorul e pe „10.000 lei”, scala 10.000–30.000. Pe Sumar si pe pagina cererii: „Buget 5.000 – 15.000 RON — Bugetul tău estimat: 10.000 RON”. In DB: `budget_range=FROM_5K_TO_15K`, `budget_estimate_ron=10000`. Clientul n-a ales „5.000–15.000” nicaieri.
- Ce ar trebui: intervalul afisat pe Sumar sa fie cel vazut / ales pe pasul Buget (sau pasul Buget sa arate de la inceput intervalul in care va fi incadrat).
- Dovada: `shots/SX/SX-01/11-visitorsx1-details-stuck.png` (de la incercarea 3, `SX-01-try3`) vs `11-visitorsx1-unknown-8.png` (Sumar) si `22-sx1-published.png`.
- Propunere: aliniati textul estimarii (10–30k) cu bucket-urile de buget; afisati pe Sumar „Buget: ~10.000 lei (interval 5–15k pentru firme)” sau eliminati una dintre exprimari. Si: 10.000–30.000 lei estimat pentru un corp de lavoar de 80 cm + dulap oglinda de 60 cm pare mult — de verificat formula.

**SX-03** · P2 · UX · e-mailuri catre client
- Ce se intampla: dupa publicare clientul nu primeste niciun e-mail („Cererea ta e publicata, iti scriem cand o preia o firma”); singurul e-mail din Mailpit este cel de confirmare a adresei. Expeditorul e `no-reply@marketplace-mobilier.local` fara nume afisat (local; de verificat pe productie).
- Ce ar trebui: confirmare de publicare cu link spre cerere si data de expirare.
- Dovada: `_notes.txt` („e-mailuri client acum: Confirmă adresa de email — Cozy Home”).

**SX-04** · P3 · text · pagina cererii, antetul camerei
- Ce se intampla: camera Baie are in antet `1.4 × 0.6 × 2.6 m`, desi clientul a dat latime lavoar 0,8 m, latime dulap oglinda 0,6 m, tavan 2,6 m. „1.4” e suma latimilor, „0.6” pare o adancime care nu a fost intrebata. Arata ca dimensiunile camerei, ceea ce nu sunt.
- Dovada: `shots/SX/SX-01/22-sx1-published.png`. De verificat cum se calculeaza.
- Propunere: la camerele fara dimensiuni proprii, nu afisati „L × l × H”; afisati lista pieselor cu latimile.

**SX-05** · P3 · UX · formular Date generale, „Preferinte de contact”
- Ce se intampla: canalul implicit e „Email” si vizitatorul trebuie sa scrie o adresa de e-mail (validata) — apoi la inregistrare o scrie din nou. Daca scrie telefonul in camp (cum am facut prima data), apare „Introdu o adresă de email validă” fara sa fie evident ca trebuie schimbat canalul din lista din stanga.
- Dovada: `shots/SX/SX-01-try3/11-visitorsx1-details-stuck.png`.
- Propunere: pre-completati din cont dupa autentificare; recunoasteti automat telefon vs e-mail.

Ce a mers bine: ciorna anonima a supravietuit inregistrarii si autentificarii (acelasi browser); e-mailul de confirmare e in romana, cu diacritice, cu buton si link text, linkul merge; dialogul „Ai o cerere începută” e limpede; pagina cererii publicate explica bine cine vede ce.
Neverificat: ciorna deschisa din ALT browser / de pe telefon dupa confirmare (linkul din e-mail deschis pe telefon nu are ciorna — e foarte probabil ca omul sa o piarda).

### SX-02 — resetare parola + firma B cu abonament expirat
Resetarea: `/login` → „Ai uitat parola?” → `/forgot-password` → e-mail „Resetare parolă — Cozy Home” (RO, link 60 min, o singura folosire) → `/reset-password` (parola + confirmare) → „Parola a fost schimbată” → login → `/dashboard`. A mers din prima. Firma B: in DB doua abonamente `ACTIVE` cu `expires_at` 2026-09-20 (GOLD) si 2026-08-06 (PLATINUM), 250 credite disponibile + 2 rezervate, preluari: 4 `OFFER_SENT`, 3 anulate, 1 retrasa, 2 SLA depasit.

**SX-06** · P1 · defect · `/ro/marketplace/claims` (lista „Preluări”) la firma cu abonament expirat
- Ce se intampla: lista „Preluările mele” e inlocuita complet cu „Abonamentul tău a expirat — Preluarea cererilor necesită un abonament activ” (API `GET /api/v1/claims/mine` → 403), desi firma are 4 preluari cu oferta trimisa, la care clientii asteapta raspuns. In acelasi timp fisa unei preluari se deschide fara probleme prin link direct (`/ro/marketplace/claims/bc21aba5-…`, cu formular de reofertare activ), iar pagina „Mesaje” listeaza toate conversatiile si permite scrierea. Deci regula nu e nici „totul blocat”, nici „doar preluarile noi blocate” — ci un amestec in care firma isi pierde lista de lucru.
- Ce ar trebui: abonamentul expirat blocheaza preluarile NOI; lista preluarilor existente ramane vizibila (eventual cu banda „Abonament expirat la 20 sept. — poti termina lucrarile in curs”).
- Dovada: `shots/SX/SX-02/08-ownerb-_ro_marketplace_claims.png` (+ `.txt`: `403 GET /api/v1/claims/mine`), `12-ownerb-old-claim-direct.png`, `09-ownerb-_ro_marketplace_messages.png`.
- Propunere: scoateti gardul de abonament de pe `GET /claims/mine` (pastrati-l pe `POST /claims`); acelasi mesaj de stare pe toate paginile firmei.

**SX-07** · P2 · UX/text · Panou, Marketplace, Portofel, Firma mea (firma B)
- Ce se intampla: nicaieri nu scrie CAND a expirat abonamentul si ce se intampla cu creditele si preluarile in curs. Panoul spune „Nimic urgent acum. Te anunțăm când apare ceva.” cu buton „Mergi la marketplace” (care e blocat), langa o pastila rosie „Fără abonament activ” si „Fără responsabil: 1” in rosu. Marketplace: „Abonamentul tău a expirat” (fara data); Portofel: „Nu ai un abonament activ”; Firma mea: „Nu ai un abonament activ” — trei formulari diferite. In clopotel nu e nicio notificare despre expirare (doar penalizari / SLA vechi); in Mailpit niciun e-mail de expirare la owner.b (de verificat daca exista job de avertizare).
- Ce ar trebui: un singur mesaj, peste tot: „Abonamentul GOLD a expirat pe 20 sept. 2026. Creditele tale (250) raman in cont, dar nu le poti folosi pana reactivezi. Preluarile in curs le poti termina.” + avertizare cu 7 zile / 1 zi inainte (notificare + e-mail).
- Dovada: `06-ownerb-_ro_dashboard.png`, `07-ownerb-_ro_marketplace.png`, `10-ownerb-_ro_marketplace_wallet.png`, `11-ownerb-_ro_company.txt`, `13-ownerb-bell.png`.

**SX-08** · P2 · text · Portofel, „Cumpără credite”
- Ce se intampla: firma fara abonament poate apasa „Cumpără” pe pachete de credite; mesajul galben spune ca nu le poate folosi pana nu activeaza un plan. E corect, dar butoanele nu sunt dezactivate si nici nu e spus explicit „poti cumpara acum, le folosesti dupa reactivare”. Risc de plata fara folos. (Nu am apasat — ar fi o plata.)
- Dovada: `10-ownerb-_ro_marketplace_wallet.png`.

**SX-09** · P2 · inconsecventa · fisa de lucru (preluare veche B)
- Ce se intampla: insigna de sus spune „OFERTĂ TRIMISĂ”, iar oferta spune „Versiunea 1 · Expirată” si „Ofertă expirată”. Termenul de livrare apare „30 zile” (fara „lucrătoare” / „calendaristice”). In formularul de reofertare, campul „Data livrării” arata `mm/dd/yyyy` (format american) pe pagina in romana.
- Dovada: `12-ownerb-old-claim-direct.png`.
- Propunere: stare „Ofertă expirată — reofertează” in insigna; „30 de zile lucrătoare”; format `zz.ll.aaaa` (input date cu `lang="ro"`).

**SX-10** · P3 · securitate/UX · resetarea parolei
- Ce se intampla: dupa schimbarea parolei nu pleaca niciun e-mail „Parola ta a fost schimbată — daca nu ai fost tu, scrie-ne” (in Mailpit doar e-mailul cu linkul). Ecranul de succes nu autentifica automat si nici nu duce inapoi unde era omul.
- Dovada: `_notes.txt` SX-02 („e-mailuri dupa resetare: Resetare parolă — Cozy Home”).

Ce a mers bine: e-mailul de resetare e clar, in romana, cu durata de valabilitate; Marketplace si Portofel spun limpede ca preluarea cere abonament si au buton spre planuri.

### SX-03 — trei firme pe aceeasi cerere si tabelul de comparare
Cereri: prima `c8b6f0ef-…` (doar A a apucat sa oferteze; ramane cu o oferta, starea OFFERS_RECEIVED), a doua `a534649f-…` (A + D, acceptata A). Ambele cu „[TEST AUDIT SX-03]”. Credite: A rezerva 10 la fiecare preluare (in paralel alti agenti miscau portofelul A, deci cifrele absolute „inainte/dupa” nu sunt curate; tranzactiile pe preluare sunt). D: 199 → 189 disponibile / 10 rezervate; dupa acceptarea lui A, preluarea D = `CANCELLED_REQUEST_ACCEPTED`, oferta D = `SUPERSEDED`, tranzactii `RESERVE:10, CONSUME:10` (regula „pierzatorii nu primesc creditele inapoi” aplicata). Preluarea A dupa acceptare: doar `RESERVE:10` (de verificat cand se consuma).
Contorul de locuri: A a vazut „Sloturi 0/3”, D dupa preluarea lui A „Sloturi 1/3” — corect.

**SX-11** · P1 · produs/defect · marketplace, setarea `claims_open_after_first_offer=false`
- Ce se intampla: firma A a preluat si a trimis oferta in ~3 minute; cererea a trecut in `OFFERS_RECEIVED` si a disparut din marketplace pentru toate celelalte firme (D: `404 GET /api/v1/marketplace/requests/<id>` → „Nicio cerere disponibilă momentan.”), cu 2 locuri din 3 inca libere. Clientul ramane cu O oferta. Asta contrazice direct promisiunea „Trei firme. Trei oferte. Una lângă alta.” si pedepseste clientul pentru ca prima firma a fost rapida. Firma D nu primeste nicio explicatie (cererea pe care o vazuse dispare).
- Ce ar trebui: locurile raman deschise pana la 3 preluari (sau pana la o fereastra de timp, de ex. 48 h), indiferent de prima oferta.
- Dovada: `shots/SX/SX-03/17-ownerd-mk-detail.txt` (404), `system_settings.claims_open_after_first_offer=false`, filtrul din `apps/backend/src/modules/marketplace/marketplace.service.ts:234` (`claimableStatuses(openAfterFirstOffer)`).
- Propunere: PO sa decida valoarea implicita (recomandat `true`); daca ramane `false`, pe pagina clientului sa scrie „Ai o oferta; alte firme nu mai pot prelua” si pe detaliul firmei „Cererea a primit deja oferte”, nu „Nicio cerere”. **DECIZIE NECESARA (PO).**

**SX-12** · P1 · defect · `/ro/requests/<id>/offers`, „Descarcă PDF”
- Ce se intampla: ambele PDF-uri de oferta (A si D) raspund `500 INTERNAL_ERROR` (`GET /api/v1/client/quotes/<id>/pdf`, `traceId b685f7d7-b1c3-4108-a29f-9ef2eae88a99`), corp JSON de 157 B servit ca `application/pdf`. Clientul apasa „Descarcă PDF” si primeste un fisier stricat. (Pe productie — de verificat; local poate fi lipsa unui font / MinIO.)
- Dovada: `_notes.txt` SX-03, `shots/SX/SX-03/offer-0.pdf` si `offer-1.pdf`.

**SX-13** · P1 · UX/inconsecventa · tabelul „Ofertele, una lângă alta”
- Ce se intampla (desktop 1366): rubrici doar Total / Termen / Garanție / Valabilitate. A: „18.500 RON” cu insigna „cel mai mic”; D: „3.900 EUR” fara echivalent in lei pe rand (echivalentul apare doar in fisa ofertei: „≈ 3.557,69 EUR” la A, curs implicit ~5,20, fara sursa / data cursului). Termen: „6 săptămâni” vs „30 de zile lucrătoare” — in realitate egale, dar nimic nu le aduce la acelasi numitor si nu exista „cel mai rapid”. TVA: nicio rubrica; D a scris in descriere „pretul NU include TVA”, A „TVA inclus” — in tabel apar ca si cum ar fi comparabile (D real = 3.900 × 1,21 ≈ 4.719 EUR ≈ 24.500 lei). Nici transport / montaj / proiectare nu au rubrici. Dialogul de acceptare recunoaste golul: „Înainte să confirmi, întreabă firma în conversație dacă prețul include TVA”. Antetul spune „Aceleași rubrici pentru fiecare firmă” — adevarat, dar rubricile esentiale lipsesc.
- Ce ar trebui: rand „Total în lei (cu TVA)” calculat; termen convertit in zile lucratoare / data estimata; rubrici obligatorii in formularul de oferta: TVA inclus da/nu, transport, montaj, proiectare; insigne „cel mai mic” / „cel mai rapid” calculate pe valori normalizate, cu cursul afisat.
- Dovada: `shots/SX/SX-03/36-sx1-two-offers-offers.png`, `43-sx1-accept-dialog.png`; DB: `quote_versions.delivery_term` = text liber „6 săptămâni” / „30 de zile lucrătoare”, `warranty` = „24 de luni” (salvate ca text, nu se pot normaliza ulterior).
- Propunere: campuri structurate (`vat_included`, `transport`, `assembly`, termen numeric + unitate) in oferta si un rand „Comparabil” in tabel.

**SX-14** · P2 · UX · tabelul de comparare pe telefon (390×844)
- Ce se intampla: tabelul are coloana D taiata la marginea dreapta („D A…”, „3.9…”), fara indiciu ca se poate derula orizontal; filele „A Mobila Premium · ofertă primită / D Atelier Bucov · …” se rup pe doua randuri si butonul „N” (devtools Next, doar local) le acopera.
- Dovada: `shots/SX/SX-03/37-sx1-two-offers-offers-mobile.png`.
- Propunere: pe telefon, carduri pe rubrica (Total: A … / D …) sau coloana firmei fixa + umbra de derulare.

**SX-15** · P2 · text · formate de data in engleza pe paginile RO
- Ce se intampla: dialogul de acceptare „Valabilă până la 11/26/2026”; „Acordul vostru — Acceptată pe 11/12/2026”; campul „Data livrării” din formularul de oferta `mm/dd/yyyy`. In alte locuri aceeasi pagina scrie „26 noiembrie 2026”.
- Dovada: `43-sx1-accept-dialog.png`, `44-sx1-after-accept.png`, `14-ownera-offer-sent.png`.

**SX-16** · P2 · UX · formularul de oferta al firmei
- Ce se intampla: pe o cerere de o camera apar doua campuri de pret: „1. Living” (pret pe camera, placeholder 0) si inca un „Preț” intr-o caseta separata; daca il lasi gol: „Prețul introdus nu este valid.”. Nu e clar care e totalul si care e obligatoriu. Campul „Tarif de proiectare” nu exista daca clientul n-a bifat proiectare cu plata — firma D nu putea cere tarif de proiectare deloc (am pus informatia in descriere).
- Dovada: `shots/SX/SX-03/14-ownera-offer-sent.png`.

**SX-17** · P3 · text · dupa acceptare
- Ce se intampla: in tabel randul „Valabilitate” devine „Acceptată” / „Înlocuită” (o stare pusa pe randul unei date); „Înlocuită” e jargon pentru „Nealeasă”. Clientul nu primeste e-mail de confirmare a alegerii (A primeste „Oferta ta a fost acceptată” — la toti cei 5 membri ai firmei A —, D primeste „Clientul a ales altă ofertă … Creditele rezervate s-au consumat (ai ofertat, iar clientul a ales altă firmă).” — mesaj limpede, bun).
- Dovada: `44-sx1-after-accept.png`, `_notes.txt` SX-03 (lista e-mailurilor).

Ce a mers bine: dialogul de preluare explica limpede rezervarea, retragerea gratuita 30 min si faptul ca creditele nu se restituie daca clientul alege alta firma; conversatiile sunt separate pe firma; firmele nu vad oferta celeilalte (fisa A arata doar oferta A); clientul primeste e-mailuri la fiecare preluare si oferta; panoul „Ofertă acceptată — ce urmează?” e foarte bun.
Neverificat: clopotelul firmelor dupa acceptare; ce vede D pe fisa dupa pierdere.

### SX-05 — cont de firma care publica o cerere
**SX-18** · P1 · defect (securitate de rol) · `POST /api/v1/requests/drafts/<token>/publish`
- Ce se intampla: autentificat ca `owner.d@demo.ro` (rol `COMPANY_USER`) am completat `/ro/requests/new` (Baie) si „Publică cererea” → `201`, cererea `a40bb082-6082-49da-9129-eaad680bbe9f` e `IN_MARKETPLACE`, `client_user_id` = owner.d. Firma ajunge pe `/ro/requests/<id>` (pagina clientului, cu „← Cererile mele”, editare, stergere; doua `403 GET …/visibility`). In marketplace-ul firmei D cererea apare (≈1 km) cu buton „Preia cererea…” — firma isi poate prelua propria cerere (n-am apasat, ar consuma credite). Pagina „Cererile mele” (`/ro/requests`) la firma: „Nu am putut încărca datele” — deci firma nu-si mai gaseste cererea decat prin link.
- Ce ar trebui: serverul refuza publicarea pentru alt rol decat CLIENT (403 cu mesaj omenesc), iar formularul ii spune firmei de la inceput „Cererile se publica din cont de client”.
- Dovada: `shots/SX/SX-05/10-ownerd-firm-after-publish.txt`, `12-ownerd-marketplace_a40bb082-….png`, `13-ownerd-requests.png`. Cererea a ramas publicata (de sters de coordonator).

### SX-06 — ziduri intre roluri
| Cine | URL | Rezultat |
|---|---|---|
| client | `/ro/marketplace`, `/ro/admin`, `/ro/marketplace/claims/<preluare A>` | redirect tacut la `/ro/dashboard`, fara niciun mesaj |
| client | `/ro/requests/<cererea Anei>` | „Nicio cerere. ← Cererile mele” |
| firma D | `/ro/marketplace/claims/<preluare A>` | „Oferta nu a fost găsită. ← Preluările mele” |
| firma D | `/ro/requests/<cererea clientului SX>` | „Nicio cerere.” |
| firma D | `/ro/admin` | redirect tacut la `/ro/dashboard` |
| vizitator | `/ro/marketplace/claims/<id>`, `/ro/dashboard` | `/ro/login` FARA `?redirect=` → dupa login ajunge pe Panou, nu inapoi |
| vizitator | `/ro/requests/<id>` | ramane pe pagina: „Nu am putut încărca datele. Încearcă din nou peste câteva momente. Reîncearcă” (nu e trimis la login) |
| vizitator | `/ro/marketplace/<id>` | „Nicio cerere disponibilă momentan.” (nu e trimis la login) |

**SX-19** · P2 · UX · linkuri adanci pentru vizitator
- Ce se intampla: linkurile din e-mailuri (ex. „Vezi oferta” → `/ro/requests/<id>/offers`, „Deschide lucrarea” → `/ro/marketplace/claims/<id>`) deschise intr-un browser fara sesiune fie arata o eroare falsa („Nu am putut încărca datele… Reîncearcă”, „Nicio cerere disponibilă”), fie duc la login fara `redirect`, iar dupa autentificare omul ajunge pe Panou si trebuie sa caute singur. Exact drumul cel mai des: clic din e-mail pe telefon.
- Ce ar trebui: orice pagina cu cont → `/login?redirect=<pagina>` → inapoi.
- Dovada: `shots/SX/SX-06/08-visitor-…`, `09-visitor-marketplace_claims.png`, `10-visitor-…`.

**SX-20** · P3 · text · mesaje de „nu ai acces”
- Ce se intampla: redirecturile tacute (client pe `/ro/admin` → Panou) si mesajele „Nicio cerere.” / „Oferta nu a fost găsită.” (pe o pagina de PRELUARE) nu spun nimic despre motiv. Nu e scurgere de date (bine), dar omul care a primit un link gresit nu intelege ce s-a intamplat.
- Propunere: „Pagina e doar pentru firme / pentru administratori” / „Cererea nu exista sau nu e a ta”.

Bonus vazut in trecere:
- **SX-21** · P3 · firma D pe Panou: „Valoarea totală a ofertelor 31.000,00 lei” — D are oferte in EUR (3.900 EUR); de verificat daca adunarea amesteca monede (`14-ownerd-dashboard.txt`, SX-05).
- Pe pagina cererii, antetul camerei Baie cu o singura piesa: `0.8 × 0.6 × 2.6 m` — „0.6” nu a fost dat de nimeni (vezi SX-04).

## 3. Top 10
1. **SX-11** — dupa prima oferta cererea dispare din marketplace; „trei oferte una langa alta” nu se intampla. DECIZIE PO pe `claims_open_after_first_offer`.
2. **SX-18** — serverul lasa un cont de firma sa publice cereri si sa si le preia singur.
3. **SX-13** — tabelul de comparare nu aduce la acelasi numitor moneda, termenul si TVA-ul; lipsesc rubricile TVA / transport / montaj; oferta salveaza termen si garantie ca text liber.
4. **SX-12** — PDF-ul ofertei da 500.
5. **SX-06** — firma cu abonament expirat nu-si mai vede preluarile in curs (403 pe lista), desi fisele merg prin link.
6. **SX-01** — dupa confirmarea e-mailului clientul nou nu e dus inapoi la ciorna; Panoul spune ca nu are nicio cerere.
7. **SX-19** — linkurile adanci (din e-mailuri) pentru cine nu e autentificat: erori false sau login fara intoarcere.
8. **SX-07** — firma expirata nu afla cand a expirat, ce se intampla cu creditele si preluarile; zero avertizari inainte.
9. **SX-14 / SX-15** — tabelul taiat pe telefon; date in format american pe paginile RO.
10. **SX-02** — bugetul aratat la pasul Buget (10–30k) difera de cel de pe Sumar (5–15k).

## 4. Conturi si date create
- Cont nou: `audit.sx.1@example.test` (CLIENT, confirmat), parola = parola demo locala.
- Parola resetata: `owner.b@demo.ro` → parola demo locala.
- Cereri cu eticheta mea: SX-01 `3993c82a-7480-4b5f-9788-d00e14636629` (Baie, IN_MARKETPLACE); SX-03 `c8b6f0ef-010f-4ac5-9119-d79d8ec10acd` (Living, o oferta A), SX-03 `a534649f-9647-46d5-a9d2-899afab9385b` (Living, A acceptata, D pierduta); SX-05 `a40bb082-6082-49da-9129-eaad680bbe9f` (publicata de owner.d — de sters).
- Preluari: A `4f193431-…` (pe c8b6f0ef, OFFER_SENT, responsabil Andrei A), A `e5410fd2-…` (acceptata), D `afef9dd0-…` (pierduta, credite consumate). Toate au responsabil.
