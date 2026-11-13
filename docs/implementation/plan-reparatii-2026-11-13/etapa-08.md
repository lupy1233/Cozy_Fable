# Etapa 8 — Formular și texte: afișare, validare, telefon

Locurile 38–43. Fișa cererii și Sumarul fără rânduri repetate, mesaje de validare limpezi, centimetri peste tot, un singur vocabular, o bară de continuare pe telefon.

- Mărime: 20,5 zile de lucru
- Module atinse: backend/notifications, frontend/configurator, frontend/configurator-3d, frontend/configurator/piece3d, frontend/marketplace, frontend/messages, frontend/requests, frontend/requests-offers, shared/piece3d, shared/questionnaire, shared/questionnaire/flows
- Tabele atinse: request_items
- Presupuneri: Unitățile (nr. 41) sunt doar afișare: valorile se salvează deja la fel, deci cererile vechi se văd automat în noul format. Glosarul (nr. 42) se aplică și textelor versiunilor vechi de formular, deci trebuie să fie adevărat și pentru ele.
- Gata când: Pe telefon, „Continuă” e mereu pe ecran. Aceeași dimensiune apare la fel în formular, în Sumar și pe fișa firmei.

## 38. „Fișa cererii” și Sumarul: valori greșite, rânduri repetate, numărători diferite (`b10`, P2)

- Mărime: 2,5 zile · risc mic
- De ce contează: Valorile invalide apar în fișă ca acceptate. Patru rânduri identice „Ce sistem de deschi…”. „Vezi toate răspunsurile” repetă ce e deja afișat. Contorul de progres sare.
- Cauza: Panoul „Fișa cererii” și Sumarul folosesc ca etichetă titlul întreg al întrebării și afișează orice valoare scrisă, fără să verifice dacă e bună. Cele două numărători măsoară lucruri diferite (ecrane vs întrebări obligatorii) și își schimbă totalul pe măsură ce apar întrebări noi.
- Ce s-a văzut în cod: „Vezi toate răspunsurile” repetă tot ce e deasupra pentru că rezumatul scurt arată toate întrebările de cameră, iar materialele și deschiderile pe piese apar doar în lista completă.
- Risc: Doar afișare; riscul e ca o etichetă scurtă să lipsească pe o cameră și să apară titlul întreg (rezerva rămâne).

**Pași**

1. În Fișă, o dimensiune în afara intervalului apare cu roșu și „de corectat” (aceeași verificare ca pe ecran), nu ca valoare acceptată; la fel cota de pe schiță.
2. Etichete scurte de rezumat („Formă”, „Material fronturi — bază”, „Deschidere — suspendate”), citite din texte noi cu titlul întrebării ca rezervă; răspunsul „Altul” se unește cu textul clientului pe un singur rând („Material: Altul — sticlă…”), în Fișă și în Sumar.
3. Rândurile fără denumire din „Altă piesă” nu se mai afișează; „Fișiere” arată numărul de fișiere încărcate în loc de „opțional”.
4. În Sumar, rezumatul scurt arată piesele, materialele și deschiderile, iar „Vezi toate răspunsurile” adaugă doar rândurile ascunse; linkul dispare când nu ascunde nimic.
5. O singură numărătoare vizibilă, cu etichetă: sus „Ecranul 3 din 12”, fără total până după alegerea pieselor; în Fișă textul devine „6 din 19 răspunsuri obligatorii”; „N secțiuni” din coș devine „câteva întrebări”.

**Unde în cod**

- apps/frontend/src/components/configurator/review-rail.tsx:125 — dimensiunile se afișează așa cum au fost scrise, fără marcaj de valoare greșită
- apps/frontend/src/components/configurator/review-rail.tsx:113 — eticheta rândului = titlul întreg al întrebării, tăiat la :262
- apps/frontend/src/components/configurator/review-rail.tsx:141 — piesele fără denumire devin virgule; :344 „Fișiere — opțional” chiar cu fișiere încărcate; :203 numărătoarea întrebărilor; :299 „N secțiuni”
- apps/frontend/src/components/configurator/room-flow-runner.tsx:183 — numărătoarea ecranelor „07/20”
- apps/frontend/src/components/configurator/review-room-card.tsx:37 — rezumatul scurt = toate întrebările fără piese; :84 lista completă reia de la început
- apps/frontend/src/components/configurator/room-answer-summary.tsx:58 — eticheta = titlul întrebării, deci „Ce material ai în minte?” apare de două ori

**Cum se verifică**

- Teste pe Fișă: dimensiune invalidă marcată, rânduri goale ascunse, „Altul” pe un singur rând, fișiere numărate.
- Test pe cardul din Sumar: lista extinsă nu repetă rândurile scurte.
- Verificare a etichetelor scurte pe toate tipurile de cameră, în RO și EN.

**Legături**

- nr. 39 (`b9`): Aceeași verificare per câmp alimentează și marcajul roșu din Fișă.
- nr. 62 (`c11`): Etichetele scurte și titlurile întrebărilor rescrise trebuie să folosească aceleași cuvinte.
- nr. 42 (`i1`): Vocabularul unitar pentru același lucru intră în etichetele noi.
- nr. 41 (`c4`): Unitățile afișate în Fișă (m / cm) trebuie aliniate.
- nr. 33 (`d4`): Cardul camerei din Sumar e același loc unde intră imaginea 3D.

## 39. Mesaje de validare neclare sau greșite (`b9`, P2)

- Mărime: 2,5 zile · risc mediu
- De ce contează: Câmp gol la dimensiuni: „Dimensiunea e în afara intervalului permis”. La carduri: „Completează acest câmp”. Limita de fișiere din mesaj nu e cea reală. Textele lungi sunt tăiate la 120 de caractere fără contor. Sesiunea expirată dă „eroare neașteptată”.
- Cauza: Verificarea răspunsurilor dă un singur mesaj pe tot ecranul, ales din câteva texte generale: un câmp de dimensiune gol primește același mesaj ca o valoare prea mare, iar o listă de carduri primește mesajul pentru câmpuri. Câteva texte de eroare au rămas în urma regulilor (limita de fișiere, „pasul Contact”, regula de editare), iar sesiunea expirată nu are text în lista de erori a formularului.
- Ce s-a văzut în cod: Toate constatările se văd în cod. În plus: la „Altă piesă” o denumire prea scurtă dă „Răspunsul nu are formatul așteptat” pentru că mesajul specific al regulii se pierde pe drum; limita reală de fișiere este 10 + 8 pe cameră, nu 10.
- Risc: Schimbarea verificării per câmp atinge toate ecranele de dimensiuni; o greșeală poate lăsa un ecran blocat sau poate lăsa să treacă un câmp gol.

**Pași**

1. La dimensiuni, verificarea pe fiecare câmp: câmp gol → „Completează {câmpul}” sub câmp cu contur roșu; în afara intervalului → mesajul de interval existent; mesajul de jos devine un rezumat („2 câmpuri necompletate”) și focusul merge pe primul câmp greșit.
2. Mesajul de răspuns lipsă depinde de tipul întrebării: o alegere → „Alege o opțiune”, mai multe → „Alege cel puțin o opțiune”, piese → „Adaugă cel puțin o piesă”, text → „Completează câmpul”; în „Altă piesă”, eroarea arată rândul și câmpul (denumire prea scurtă).
3. În Date generale, câmpurile goale arată „Completează adresa / județul / orașul / e-mailul”, iar „prea scurt” rămâne doar pentru textele de 1–2 caractere (doar în interfață, regulile din pachetul comun rămân).
4. Contor „87/120” sub câmpurile text cu limită și „maximum 5.000 de caractere” la mesajul pentru firme (cu limită pusă și pe câmp); în „Altă piesă”: limita de 150 pe denumire, plafon la cantitate și butonul „Adaugă piesa” dezactivat la maximum, cu numărul permis afișat.
5. Texte corectate: limita de fișiere cu numărul real (10 + 8 pe cameră), „pasul Contact” → „secțiunea Preferințe de contact din Date generale”, regula de editare „o dată după preluare, înainte de prima ofertă”, „Alege suma” în loc de „intervalul”.
6. Sesiune expirată la publicare: mesaj „Sesiunea a expirat — intră din nou în cont; cererea rămâne salvată” și buton de autentificare care întoarce la Sumar (ciorna e deja salvată).

**Unde în cod**

- packages/shared/src/questionnaire/engine.ts:93 — la dimensiuni, câmpul lipsă și valoarea în afara intervalului dau același mesaj „în afara intervalului”
- apps/frontend/src/components/configurator/room-screens.ts:18 — un singur mesaj pe ecran; răspuns lipsă → „Completează acest câmp” indiferent de tipul întrebării; mesajele care nu încep cu „validation.” devin „formatul așteptat”
- apps/frontend/src/components/configurator/step-renderer.tsx:394 — marcajul roșu per câmp apare doar la valori în afara intervalului, nu la câmp gol; :482 limita de 120 fără contor; :538 denumirea piesei fără limită; :593 „Adaugă piesa” fără plafon
- apps/frontend/src/components/configurator/details-step.tsx:195 — mesajul pentru firme fără limită de caractere; :110 câmpurile goale afișează „prea scurt”
- apps/frontend/src/components/configurator/review-step.tsx:377 — eroarea de sesiune expirată nu există în textele formularului → „eroare neașteptată”
- apps/frontend/src/messages/ro.json:1251 — „limita de 10 atașamente”; :3983 și :4002 „pasul Contact”; :3744 regula de editare; :1158 „Alege intervalul”

**Cum se verifică**

- Teste pe verificarea pașilor: câmp gol vs valoare în afara intervalului, alegere unică vs multiplă, „Altă piesă” cu rând gol și peste limită.
- Test pe Date generale: câmpuri goale → mesaje „Completează…”.
- Test pe Sumar: răspuns de sesiune expirată → mesajul nou și butonul de autentificare.

**Legături**

- nr. 1 (`b1`): Același câmp de dimensiune: virgula zecimală trebuie reparată înainte de mesajele per câmp.
- nr. 2 (`b5`): Limita reală de fișiere și mesajele de fișier respins sunt în același loc.
- nr. 20 (`c10`): Același formular „Altă piesă” (limite, câmpuri lipsă).
- nr. 41 (`c4`): Intervalul din mesaj („0.8–6 m”) folosește punct și unități amestecate.
- nr. 25 (`f3`): Sesiunile închise de o autentificare nouă sunt o cauză des întâlnită a „sesiunii expirate”.

## 40. Pe telefon: ecrane foarte lungi, butoane departe, tabel tăiat (`j1`, P2)

- Mărime: 6 zile · risc mediu
- De ce contează: Ecranul de fronturi are 6.600 px. „Continuă” și „Publică” sunt ultimele pe pagină. Textul lung fără spații scoate Sumarul din ecran. În 3D panoul zonei apare sub ecran. Tabelul de comparare are a doua coloană tăiată.
- Cauza: Ecranele au fost așezate pentru desktop: butonul principal e la capătul paginii, cardurile se pun câte unul pe rând sub 640 px, iar coloana de publicare și scena 3D se lipesc doar pe ecrane mari. Pe telefon, tabelul de comparare e doar derulabil, fără coloana firmei fixată.
- Ce s-a văzut în cod (altfel decât în audit): Tabelul de comparare se poate derula în lateral pe telefon, dar nimic nu arată asta. Restul e ca în audit: nicio bară de continuare lipită jos și ecrane foarte lungi.
- Risc: Bara lipită poate acoperi câmpuri sau mesaje de eroare de la capătul paginii. Scena 3D lipită sus poate face pagina greu de derulat pe telefoane mici.

**Pași**

1. Reparații mici de CSS (~0,5 zile): despărțirea textului lung și lățimea minimă pe valori în Sumar și în Fișa cererii; cote mai mari în schița 2D pe telefon; ținte tactile de minim 40–44 px la butoanele +/−, mostre și pilule din 3D.
2. Bară lipită jos pe telefon (~1,5 zile): Înapoi / Continuă pe ecranele de întrebări, „3 camere · 3 piese · Începe →” în coș și „Publică” în Sumar. Pe desktop rămâne ca azi.
3. Reașezare pe telefon (~1 zi): cardurile de opțiuni în două coloane, cu imagine mai mică, iar Fișa cererii pliată implicit.
4. Reașezare pe telefon (~1,5 zile): tabelul de comparare devine carduri pe rubrică (Total: A … / D …) sub 640 px, cu filele pe un singur rând derulabil.
5. Reașezare pe telefon (~1,5 zile): scena 3D lipită sus (~40% din ecran) cu comenzile dedesubt, iar după atingerea unei zone pagina coboară la panoul zonei.
6. Verific la 390 × 844 fiecare ecran atins (fără derulare orizontală, butonul principal mereu vizibil) și testele de component existente.

**Unde în cod**

- apps/frontend/src/components/configurator/room-flow-runner.tsx:259-274 — Înapoi / Continuă la capătul pasului, nelipite
- apps/frontend/src/components/configurator/room-cart-step.tsx:310-322 — „Începe” doar la capătul coșului de piese
- apps/frontend/src/components/configurator/review-step.tsx:333-373 — pe telefon coloana „Gata de publicare” vine după toate camerele, galerie și „Înapoi”
- apps/frontend/src/components/configurator/step-renderer.tsx:208 — cardurile de opțiuni: o coloană sub 640 px
- apps/frontend/src/components/configurator/room-answer-summary.tsx:57-66 — valoarea din Sumar nu se rupe (text lung fără spații)
- apps/frontend/src/app/[locale]/_components/offers-comparison.tsx:170-175 — tabel cu lățime minimă 520/720 px, derulabil fără indiciu

**Cum se verifică**

- La 390 × 844: lățimea paginii egală cu ecranul pe toate ecranele, inclusiv Sumarul extins cu text de 120 de caractere fără spații.
- Butonul principal vizibil fără derulare pe ecranele de material, saltea, coș și Sumar.
- Comparare cu 2 și 3 oferte pe telefon: toate valorile se văd.
- 3D pe telefon: după atingerea unei zone, panoul ei e pe ecran.

**Legături**

- nr. 29 (`a3`): Tabelul de comparare își schimbă conținutul (același numitor). Varianta pe carduri se face după ce rubricile sunt fixate.
- nr. 19 (`a4`): Butoanele de refuz/comparare a variantelor intră în același tabel.
- nr. 44 (`l1`): Scena 3D se reașază și pe desktop; încadrarea camerei depinde de noua înălțime.
- nr. 53 (`c14`): Mai puține ecrane pe piesă scurtează și drumul pe telefon; bara lipită se pune o singură dată.
- nr. 58 (`m1`): Țintele tactile și bara fixă țin și de accesibilitate (ordinea focusului).

**Alegeri mărunte făcute fără PO (se pot schimba)**

- Pe telefon, în Sumar, butonul „Publică” stă într-o bară lipită jos sau cardul de publicare urcă înaintea răspunsurilor? → Bară lipită jos. Butonul e mereu la îndemână, iar clientul vede răspunsurile înainte să publice.

## 41. Unități amestecate: metri în camere, centimetri în 3D, metri cu punct în Sumar (`c4`, P2)

- Mărime: 3 zile · risc mic
- De ce contează: Salteaua are variante în cm, dar mărimea la comandă în metri. Sumarul arată „2.4 m” pentru valori scrise în cm. Există trei controale diferite pentru dimensiuni. Pe fișa firmei apar două seturi de dimensiuni care nu se potrivesc.
- Cauza: În date totul e în metri, dar fiecare ecran afișează altfel: câmpurile camerelor în unitatea aleasă (implicit cm), Sumarul și fișa firmei mereu în metri cu punct, iar piesele 3D în cm, cu trei controale construite separat. Pasul de 10 cm din specificație face ca valori ca 85 cm sau 40 cm să pară greșite în browser.
- Ce s-a văzut în cod: Toate dimensiunile se salvează deja într-o singură unitate (metri, inclusiv la piesele 3D), iar câmpurile camerelor pornesc deja în cm. Problema e doar de afișare: Sumarul și fișa firmei scriu mereu „m” cu punct, iar piesele 3D au trei controale diferite. Comutatorul m / cm / mm a fost cerut de PO (CHANGELOG, feedback 8.2).
- **După răspunsurile PO (2026-11-13):** Comutatorul m / cm / mm rămâne. Sumarul și pagina cererii îi arată clientului unitatea aleasă de el; firma vede mereu centimetri.
- Risc: Doar afișare; riscul e să rămână un ecran (de ex. pagina cererii sau PDF-ul) cu formatul vechi.

**Pași**

1. Adaug în apps/frontend/src/lib un singur formatator de dimensiuni (metri → cm, virgulă în română prin formatarea după limbă, „×” între valori), pe același cititor de numere introdus la b1.
2. Îl folosesc în Sumar, în fișa firmei, în „Fișa cererii”, în legenda planșei și în rezumatul pieselor 3D, ca toate să arate „45,5 cm” (sau unitatea aleasă, după răspunsul PO).
3. La câmpurile camerelor ignor pasul din specificație (accept orice valoare la 1 cm / 0,5 cm), ca 40 cm sau 85 cm să nu mai apară marcate greșit; validarea rămâne doar pe interval.
4. Fac o singură componentă de dimensiune pentru piesele 3D (glisor + câmp + „cm” + intervalul vizibil, aceeași etichetă) și o folosesc în cele trei panouri.
5. La saltea scriu unitatea în etichete („90 × 200 cm”) — doar text; ce se salvează nu se schimbă, deci cererile vechi și fișa firmei se afișează corect fără migrare.
6. Teste pentru formatator (ro/en, zecimale, valori întregi) și o verificare vizuală a Sumarului și a fișei firmei pe o cerere veche.

**Unde în cod**

- apps/frontend/src/components/configurator/room-answer-summary.tsx:63 — Sumarul scrie valoarea brută + „ m” (fără conversie, cu punct)
- apps/frontend/src/components/configurator/room-spec-card.tsx:218 — fișa firmei: aceleași dimensiuni în „m”; :114 antetul „L × l × H m” (de rezolvat cu d1)
- apps/frontend/src/components/configurator/review-rail.tsx:110 — „Fișa cererii” urmează comutatorul, cu punct zecimal
- apps/frontend/src/components/configurator/step-renderer.tsx:341-435 — câmpul camerelor, comutatorul m/cm/mm (:377), pasul din specificație (:419)
- apps/frontend/src/components/configurator/piece3d/configurator3d-step.tsx:84-147, furniture-controls.tsx:23-35, catalog-controls.tsx:8-18 — trei controale de dimensiune diferite pentru piesele 3D
- packages/shared/src/questionnaire/flows/common.ts:100-126 — sloturile sunt în metri cu pas 0,05 / 0,1 m

**Cum se verifică**

- Teste unitare pentru formatator: 0,455 m → „45,5 cm” în română, „45.5 cm” în engleză.
- Verific aceeași cerere în formular, „Fișa cererii”, Sumar, pagina cererii și fișa firmei: aceeași unitate peste tot.

**Legături**

- nr. 1 (`b1`): Același câmp de dimensiuni și același cititor de numere cu virgulă; formatatorul se construiește peste el.
- nr. 17 (`d1`): Antetul „L × l × H m” de pe fișa firmei e scos sau refăcut la d1; c4 aliniază restul dimensiunilor de pe același card.
- nr. 38 (`b10`): „Fișa cererii” și Sumarul se repară acolo; formatatorul unic se folosește în aceleași componente.

**Întrebări și răspunsuri**

- **[c4-1] Păstrăm comutatorul m / cm / mm sau trecem totul pe centimetri?**
  - Context: Azi câmpurile pornesc în cm, dar clientul poate comuta pe m sau mm, iar Sumarul și fișa firmei arată mereu metri. Comutatorul a fost cerut de tine în iulie.
  - Variante: 1) Doar centimetri, fără comutator · 2) Păstrăm comutatorul, iar Sumarul urmează alegerea clientului
  - **Răspunsul PO:** Păstrăm comutatorul, iar Sumarul urmează alegerea clientului (altfel decât recomandarea: Doar centimetri, fără comutator). Clientul vede unitatea aleasă peste tot; firma vede tot cm, ca să compare cererile ușor.

## 42. Vocabular amestecat pentru același lucru (`i1`, P2)

- Mărime: 4 zile · risc mediu
- De ce contează: „Comandă nouă”, „Configurează-ți proiectul”, „Cum pornim cererea?”. Patru nume pentru proiectarea cu plată. „Mesaj pentru firme” devine „Detaliile proiectului”. Jargon la firmă: „Sloturi”, „SLA”. Proiectarea plătită nu spune cât costă.
- Cauza: Textele au fost scrise în etape diferite și nu există o listă cu termenii aleși, așa că același lucru are trei-patru nume în formular, în Sumar, pe pagina cererii și la firmă.
- Ce s-a văzut în cod: „atelier” nu apare în textele vizibile. Pe lângă audit: „marketplace” apare în zeci de texte pentru clienți și firme.
- **După răspunsurile PO (2026-11-13):** Numele rămâne „Proiectare cu plată”, iar textele spun drumul descris de tine: firmele răspund întâi cu prețul proiectării și ce include, apoi clientul alege firma. Cât din acest drum construiesc acum alegi la întrebarea nouă; provizoriu am socotit o zi în plus.
- Risc: Multe texte schimbate deodată: testele care caută texte exacte pică și pot rămâne locuri uitate cu termenul vechi.

**Pași**

1. Glosar decis de mine: „cerere” până la acceptare (niciodată „comandă”); „Cerere nouă” ca titlu al formularului, fără „Comandă nouă” și „Configurează-ți proiectul”; „Am deja un proiect”; „Mesaj pentru firme” peste tot; „Adresa montajului”; „Date generale”; „Mărime”; „lei” (nu RON); ultimul pas „Verifică și publică”.
2. La firmă: „Sloturi” → „Locuri ocupate {active} din {max}”; „SLA” → „Termen de răspuns”; „Anulată (neatribuită)” → „Anulată: nu a fost atribuită la timp”.
3. Proiectarea cu plată: un singur termen (după PO) și un singur rând în Sumar (scot dublura „Ajutor pentru planificarea mobilierului”); „cu proiectantul” → „cu firma”.
4. Coșul: „Ce vrei să mobilezi?” cu subtitlu care pomenește camerele și piesele.
5. Aplic glosarul în ro.json și en.json (doar texte, fără versiune nouă de flux) și îl scriu ca fișier în docs/ pentru textele viitoare.
6. Trec prin e-mailurile din backend cu aceiași termeni.

**Unde în cod**

- apps/frontend/src/messages/ro.json:3497 — „Configurează-ți proiectul”, :3499 „Comandă nouă”, :3546 „Cum pornim cererea?” (antetul formularului)
- apps/frontend/src/messages/ro.json:1091 — „Proiectare cu plată inclusă”; :1135 „Include proiectare cu plată”; :3559 „Proiectare plătită”; :3713 „Ajutor pentru planificarea mobilierului”
- apps/frontend/src/messages/ro.json:1379 — „Sloturi {active}/{max}”; :1463 „Termen ofertă (SLA)”; :1628 „Termen pentru ofertă (SLA)”
- apps/frontend/src/messages/ro.json:1087 — „Detalii generale” față de :3524 „Date generale”
- apps/frontend/src/messages/ro.json:3714 — „Detaliile proiectului” pentru ce în formular e „Mesaj pentru firme”
- apps/frontend/src/messages/ro.json:3723 — „trimiți cererea în marketplace” (jargon pentru client)

**Cum se verifică**

- Căutare automată în ro.json după termenii interziși (comandă înainte de acceptare, SLA, sloturi, RON, atelier) — zero rezultate în afara excepțiilor.
- Rulez testele de componentă care verifică texte și le actualizez.
- Parcurgere vizuală: formular, Sumar, pagina cererii, fișa firmei.

**Legături**

- nr. 55 (`i2`): „marketplace”, „SLA” și „sloturi” sunt și anglicisme
- nr. 62 (`c11`): aceeași întrebare scrisă în cinci feluri — aceeași trecere prin texte
- nr. 38 (`b10`): rândul dublat al proiectării cu plată din Sumar
- nr. 60 (`i3`): regulile pentru firme folosesc tot „termen de răspuns” și „marketplace”
- nr. 59 (`m2`): cheile vechi rămase nefolosite după glosar se curăță la m2

**Întrebări și răspunsuri**

- **[i1-1] Cum numim proiectarea pe care clientul o plătește firmei și ce îi spunem despre cost?**
  - Context: Azi are patru nume și scrie doar „contra cost”; regulile spun că firma pune costul proiectării ca linie separată în ofertă.
  - Variante: 1) „Proiectare cu plată”, costul apare separat în ofertă · 2) „Proiectare cu plată” plus o plajă orientativă de preț · 3) „Ajutor la proiectare”
  - **Răspunsul PO (altceva):** „cand un client apasa pe proiectare cu plata atuni fiecare firma o sa vina mai intai cu un raspuns legat de pretul proiectarii si ce include dupa care clientul alege cu ce firma merge mai departe pentru a proiecta impreuna piesele de mobilier”
- **[i1-2] Cum numim locul unde firmele găsesc cererile (azi „marketplace”)?**
  - Context: Cuvântul apare la client („trimiți cererea în marketplace”) și în meniul firmelor; e numele unui ecran principal.
  - Variante: 1) Firmele: „Cereri disponibile”; clientul: „cererea ajunge la firmele din zonă” · 2) „Piața de cereri” peste tot · 3) Rămâne „Marketplace”
  - **Răspunsul PO:** Firmele: „Cereri disponibile”; clientul: „cererea ajunge la firmele din zonă” (recomandarea). Fără englezisme; meniul firmei se schimbă.
- **[i1-3] Cum numim lucrul după ce clientul a acceptat o ofertă?**
  - Context: Azi apar „comandă”, „lucrare” și „cerere” pentru același lucru după acceptare (de ex. „Comanda livrată”).
  - Variante: 1) „Comandă” după acceptare, „cerere” înainte · 2) „Lucrare” după acceptare · 3) „Proiect” după acceptare
  - **Răspunsul PO:** „Comandă” după acceptare, „cerere” înainte (recomandarea). Clar pentru client: a acceptat, deci a comandat; „comandă” la plățile firmei devine „plată”.

## 43. Valorile implicite din 3D ajung la firmă fără să fi fost alese (`d2`, P2)

- Mărime: 2,5 zile · risc mediu
- De ce contează: Dulapul are „Batante” selectat, dar nicio ușă. Comoda TV ajunge la firmă cu „Fronturi cu mâner”, deși nu are fronturi. „Push” apare selectat, dar nu se trimite. Configurația implicită trece drept răspuns.
- Cauza: Când clientul intră pe pasul 3D, configurația de pornire e salvată imediat ca răspuns. Interfața arată „Push” și „Batante” ca alese, deși configurația nu le conține. Opțiunea „Batante” doar schimbă felul ușilor, nu pune uși. Deschiderea fronturilor se arată și la piesele fără fronturi.
- Ce s-a văzut în cod: Mai e un efect pe care auditul doar îl atinge: lipsa „Push” scoate și sistemul de deschidere din calculul costului. O piesă lăsată pe implicit primește 0 puncte de sistem, față de 2 când clientul apasă „Push”.
- Risc: Schimbarea configurației implicite (uși la dulap, fronturi la comoda TV) schimbă modelul pe care clienții îl au deja în ciorne: ciornele existente își păstrează configurația, dar comportamentul diferă între clienți vechi și noi.

**Pași**

1. Lipsa deschiderii se tratează peste tot ca „Push”: la generarea piesei pentru firmă, în descriere și în Sumar (după decizia PO despre cost).
2. Selectorul „Deschidere fronturi” se ascunde, iar deschiderea nu se scrie nicăieri, când piesa nu are nicio zonă cu ușă sau sertare.
3. Opțiunea pentru uși la dulap se schimbă după decizia PO (uși pe toate zonele sau „Fără uși” implicit), iar configurația implicită a comodei TV primește fronturi dacă PO alege asta.
4. Sumarul afișează mereu deschiderea și baza (soclu/picioare), cu etichete: „Saltea 160 × 200”, „Depozitare: fără”, „Persoane: 6”. Culoarea apare ca nume aproximativ plus mostră, nu cod hex. Rândul se numește „Configurația piesei”.
5. Marchez configurația neatinsă: pasul ține minte dacă clientul a schimbat ceva, iar firma vede „dimensiuni orientative” sau i se cere o confirmare, după decizia PO.
6. Teste pentru generarea piesei (PUSH implicit, fără deschidere la piesele fără fronturi) și pentru Sumar.

**Unde în cod**

- apps/frontend/src/components/configurator/piece3d/configurator3d-step.tsx:355-358 — configurația implicită se salvează singură ca răspuns
- apps/frontend/src/components/configurator/piece3d/configurator3d-step.tsx:789-824 — pilula Push arată „ales” când nu e nimic ales; „Batante” e doar modul ușilor, apare și fără nicio ușă
- packages/shared/src/questionnaire/flows/guided-pieces/v3.ts:136-137 și catalog-v1.ts:24-26 — sistemul PUSH se trimite firmei doar dacă a fost apăsat
- packages/shared/src/questionnaire/piece3d/config.ts:974-975 — descrierea pentru firmă scrie deschiderea doar dacă a fost apăsată
- apps/frontend/src/components/configurator/piece3d/config-chips.ts:23,35-42,54-57 — Sumar: „Fronturi cu mâner” fără fronturi, culoare în cod hex, „6”/„Fără”/„160 × 200” fără etichetă
- packages/shared/src/questionnaire/piece3d/config.ts:264-275 — comoda TV pornește doar cu zone deschise

**Cum se verifică**

- Comodă TV implicită: Sumarul și firma nu mai văd „Fronturi cu mâner”.
- Bufet lăsat pe implicit: firma vede „deschidere push”, iar sistemul PUSH apare pe piesă.
- Dulap: „Batante” cu cel puțin o ușă, sau „Fără uși” ales implicit, după decizie.
- Pas trecut fără nicio atingere: firma vede marcajul de valori orientative.

**Legături**

- nr. 17 (`d1`): Același rezumat 3D pentru firmă.
- nr. 23 (`b7`): Același pas 3D; marcajul „neatins” și intenția clientului se țin în același loc.
- nr. 21 (`d3`): Push implicit adaugă puncte de sistem, deci schimbă costul în credite.
- nr. 51 (`c7`): „Nu știu / decide firma” e același tip de semnal ca „dimensiuni orientative”.
- nr. 33 (`d4`): Imaginea 3D din Sumar se pune peste același rând „Configurația piesei”.

**Întrebări și răspunsuri**

- **[d2-1] Ce facem când clientul trece de pasul 3D fără să schimbe nimic?**
  - Context: Azi firma primește dulapul de 240 × 240 × 60 cm sau masa de 6 persoane ca și cum clientul le-ar fi ales. Nimic nu arată că sunt valori de pornire.
  - Variante: 1) Marcăm „orientativ” la firmă · 2) Cerem o confirmare · 3) Lăsăm ca azi
  - **Răspunsul PO:** Marcăm „orientativ” la firmă (recomandarea). Clientul nu are pas în plus. Firma vede „Dimensiuni orientative — clientul nu le-a modificat”.
- **[d2-2] Cum pornesc dulapul și comoda TV în ce privește ușile și fronturile?**
  - Context: Dulapul pornește fără nicio ușă, dar cu „Batante” aprins. Comoda TV pornește doar cu zone deschise. Clientul crede că a ales uși, iar firma primește o piesă fără fronturi.
  - Variante: 1) Cu uși / sertare implicit · 2) „Fără uși” ca a treia opțiune
  - **Răspunsul PO:** Cu uși / sertare implicit (recomandarea). Dulapul pornește cu uși batante pe toate zonele, comoda TV cu un rând de sertare. Ce vede clientul corespunde cu ce ajunge la firmă.
- **[d2-3] Deschiderea „Push” lăsată pe implicit intră și în costul în credite?**
  - Context: Azi „Push” implicit nu se trimite și nu se punctează. Dacă îl tratăm ca ales, piesa primește 2 puncte de sistem, adică până la 2 credite în plus pentru firmă.
  - Variante: 1) Da, se punctează · 2) Se afișează, dar nu se punctează
  - **Răspunsul PO:** Da, se punctează (recomandarea). Ce vede firma și ce plătește se potrivesc; piesele cu fronturi devin cu 1–2 credite mai scumpe.

