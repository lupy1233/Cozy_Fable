# Etapa 5 — Restul problemelor grave de mărime medie

Locurile 20–26. Costul în credite primește ponderile care lipsesc, clientul primește contactele firmei după acceptare, 3D-ul nu mai șterge configurația, iar o sesiune pierdută duce la login și înapoi.

- Mărime: 16,75 zile de lucru · schimbă baza de date
- Module atinse: admin/sizing, backend/auth, backend/fulfillment, backend/notifications, backend/prisma-seed, backend/quotes, backend/requests, backend/sizing, frontend/auth, frontend/configurator, frontend/configurator-3d, frontend/lib, frontend/marketplace-claims, frontend/requests, shared/piece3d, shared/questionnaire, shared/questionnaire/flows, shared/request.schemas
- Tabele atinse: claim_slots, companies, company_locations, project_sizing_config, refresh_tokens, request_items, request_rooms, requests, subscription_plan_features, subscriptions, users
- Presupuneri: La nr. 20, 21 și 24 intră acum partea care nu cere versiune nouă de formular; restul vine în etapele 6 și 10. O singură sesiune pe cont rămâne regula scrisă, dacă nu hotărăști altfel la nr. 25.
- Gata când: O canapea nu mai costă mai puțin decât două noptiere. După acceptare clientul vede datele de contact ale firmei. Adâncimea 40 urmată de 60 readuce barele de haine.

## 20. „Altă piesă” nu are descriere și dimensiuni; coșul promite opțiuni inexistente (`c10`, P1)

- Mărime: 1 zi · risc mic
- De ce contează: Cardul spune „o descrii liber”, dar formularul cere doar nume, material, cantitate și deschidere, iar limitele nu se aplică. Coșul promite birou pe colț, perete media, vitrine și pantofar rabatabil.
- Cauza: Formularul „Altă piesă” cere doar nume, material, cantitate și căsuțe de deschidere, deși cardul promite descriere liberă. Patru carduri din coș descriu opțiuni pe care configuratorul 3D nu le mai are (birou pe colț, perete media, vitrine, pantofar rabatabil cu bancă).
- Ce s-a văzut în cod: Confirmat. Precizare: descrierea piesei există deja în datele salvate (până la 2000 de caractere), doar că formularul nu are câmp pentru ea; dimensiunile nu există nicăieri. Numele are limita 150 în validare, dar câmpul nu o arată.
- Împărțită în două: Acum intră textele din coș, câmpul „Detalii” și listele curățate. Dimensiunile vin în etapa 6, cu versiunea nouă a formularului.
- Risc: Dimensiunile ajung la firmă ca text în descriere, nu ca numere; dacă vreodată trebuie filtrate, va fi nevoie de coloane noi.

**Pași**

1. Acum, fără versiune nouă: rescriu în ro/en cele patru descrieri din coș (comodă TV, bibliotecă, birou, pantofar) și subtitlul 3D al pantofarului ca să spună doar ce se poate alege.
2. Acum, fără versiune nouă: adaug pe fiecare rând un câmp „Detalii” (descrierea care există deja) și limita vizibilă de 150 de caractere la nume.
3. Acum, fără versiune nouă: în lista de material arăt doar materialele oferite azi (fără MDF vechi), iar la „Altul” clientul scrie în „Detalii”; la deschidere arăt doar Mâner / Push / Uși glisante (validarea acceptă în continuare valorile vechi).

**Unde în cod**

- apps/frontend/src/components/configurator/step-renderer.tsx:527 — piesa noua porneste cu description: '' dar nu are camp
- apps/frontend/src/components/configurator/step-renderer.tsx:546 — materialele din toata lista (inclusiv MDF vechi)
- apps/frontend/src/components/configurator/step-renderer.tsx:563 — toate cele 6 sisteme (inclusiv Buton presiune, Gola, Aventos)
- packages/shared/src/request.schemas.ts:102 — piesa are nume, material, sisteme, descriere, cantitate; fara dimensiuni
- packages/shared/src/questionnaire/flows/pieces.ts:11 — fluxul „Altă piesă” v1, singura versiune
- apps/frontend/src/messages/ro.json:3652 — „Orice altă piesă — o descrii liber”; 3658–3664 descrierile care promit prea mult

**Cum se verifică**

- Test de componentă: rândul are „Detalii”, iar textul ajunge în descrierea piesei pe fișa firmei.
- Test de derivare „Altă piesă” v2: 120 × 80 × 40 cm → descrierea conține dimensiunile; fără dimensiuni → nimic în plus.
- Test de conținut: descrierile din coș nu mai conțin „pe colț”, „perete media”, „vitrine”, „rabatabil”.

**Legături**

- nr. 28 (`c1`): Lista de material de pe rând urmează regula unică.
- nr. 51 (`c7`): „Decide firma” la material și deschidere.
- nr. 44 (`l1`): Dacă PO alege să readucă opțiunile (birou în L, perete media), munca e în configuratorul 3D, nu în texte.

**Întrebări și răspunsuri**

- **[c10-1] La „Altă piesă”, dimensiunile sunt opționale sau obligatorii?**
  - Context: Azi nu există deloc. Fără ele firma nu poate da preț; cu ele obligatorii, clientul care nu a măsurat se blochează.
  - Variante: 1) Opționale (lățime, înălțime, adâncime în cm) · 2) Obligatorii măcar lățimea și înălțimea
  - **Răspunsul PO:** Opționale (lățime, înălțime, adâncime în cm) (recomandarea). Clientul completează ce știe; firma vede dimensiunile în descriere.
- **[c10-2] Cardurile din coș spun doar ce se poate alege azi, sau readucem opțiunile promise?**
  - Context: Biroul pe colț, peretele media, vitrinele și pantofarul rabatabil cu bancă nu există în configuratorul 3D.
  - Variante: 1) Rescriem textele · 2) Readucem opțiunile în 3D
  - **Răspunsul PO:** Rescriem textele (recomandarea). O zi de lucru; clientul nu mai e dezamăgit.

## 21. Costul în credite iese strâmb (`d3`, P1)

- Mărime: 2,5 zile · risc mare
- De ce contează: Șapte tipuri de piese nu au pondere (o canapea costă mai puțin decât două noptiere). Mărimea se calculează pe baze diferite de la cameră la cameră. Cu „Am deja un proiect” camera contează ca „sub 2 m”.
- Cauza: Costul în credite e suma punctelor din tabelul de ponderi (1 punct = 1.000 lei din bugetul minim = 1 credit). Un tip de piesă fără rând în tabel contează zero. Mărimea camerei se măsoară diferit: la birou/baie/hol din lățimea pieselor, la spălătorie/balcon/cămară din lungimea peretelui sau a balconului, iar cu „Am deja un proiect” dimensiunile lipsesc și camera contează ca „sub 2 m”.
- Ce s-a văzut în cod: Seed-ul are ponderi de tip doar pentru 10 piese. Cele 7 piese noi (bufet, corp suspendat, mască de baie, mobilier de hol, canapea, fotoliu, taburet) nu apar nicăieri în backend, în afară de enum și titlu, iar migrarea lor a adăugat doar valorile de enum. Pe producție nu am verificat (doar citire de cod); trebuie văzut în Admin → Mărime proiect. Plafonul 3..25 din audit nu e hotărât: implicit e min 1 și fără plafon, iar docs/03 îl marchează DECIZIE NECESARĂ.
- Împărțită în două: Acum intră ponderile care lipsesc și regula pentru „Am deja un proiect”. Mărimea la spălătorie, balcon și debara se face la nr. 50, iar punctele pe configurația canapelei în etapa 10.
- **După răspunsurile PO (2026-11-13):** Cu „Am deja un proiect” rămâne un câmp opțional „lungime aproximativă”; lăsat gol înseamnă tot „sub 2 m”. Costul rămâne minim 1 credit, fără maxim, și așa închid hotărârea care lipsea din regulile de produs. La ponderile celor 7 piese am înțeles că le va da estimarea din aplicația de ofertare; ce pun până atunci alegi la întrebarea nouă, fără de care nu pot pune ponderile.
- Risc: Schimbă direct cât plătesc firmele și bugetul minim arătat clientului. O pondere greșită pe producție scumpește sau ieftinește toate cererile noi până la corectare.

**Pași**

1. Adaug cele 7 ponderi de tip în seed și, pe producție, prin Admin → Mărime proiect (fără deploy și fără migrare), cu valorile aprobate de PO.
2. Pentru camerele cu proiect propriu fără dimensiuni aplic regula aleasă de PO (mărime implicită pe tip de cameră sau lungime aproximativă cerută opțional).
3. Teste pe calculul de scor: canapea > pereche de noptiere, balcon de 6 m cu un raft ≠ balcon mobilat, bucătărie cu proiect propriu ≥ „2–4 m”.
4. Actualizez docs/03 (nota despre ponderi) și CHANGELOG. Cererile deja publicate și sloturile preluate nu se recalculează: costul e înghețat la preluare.

**Unde în cod**

- apps/backend/prisma/seed.ts:9-34 — ponderi de tip doar pentru 10 piese; lipsesc PIECE_SIDEBOARD, PIECE_WALL_CABINET, PIECE_BATHROOM_VANITY, PIECE_ENTRYWAY, PIECE_SOFA, PIECE_ARMCHAIR, PIECE_OTTOMAN
- apps/backend/src/modules/sizing/sizing.service.ts:55 — ce lipsește din tabel valorează 0
- packages/shared/src/questionnaire/flows/guided-pieces/catalog-v1.ts:17 — pasul 3D al celor 7 piese nu adaugă nimic la scor (locuri, șezlong, țesătură)
- packages/shared/src/questionnaire/flows/laundry.v2.ts:66, balcony.v2.ts:66, pantry.v2.ts:30-32 — mărimea vine din perete/balcon/laturi, nu din mobilierul ales
- packages/shared/src/questionnaire/engine.ts:164 și mapping.ts:15-19 — cu proiect propriu dimensiunile se sar, iar lungimea 0 dă „sub 2 m”
- apps/backend/prisma/seed.ts:77-83 — blaturile de bucătărie au pondere 0 (PAL = granit)

**Cum se verifică**

- Teste pe calculul de scor cu tabelul din seed: canapea 3 locuri, fotoliu, taburet, pereche de noptiere, bufet.
- Balcon 6 m cu un singur raft vs balcon mobilat: mărimi diferite în versiunea nouă; cererile pe versiunea veche dau același scor ca azi.
- Previzualizarea din Admin → Mărime proiect arată costul nou.

**Legături**

- nr. 50 (`c5`): „Ce se măsoară diferă de la o cameră la alta” cere aceleași versiuni noi de flux la spălătorie, balcon și cămară.
- nr. 28 (`c1`): La piesele tapițate singurul lucru care mișcă azi scorul e „materialul structurii”; sensul întrebării de material se hotărăște acolo.
- nr. 43 (`d2`): „Push” implicit adaugă puncte de sistem.
- nr. 16 (`b11`): Bugetul minim afișat clientului vine din același scor; treptele de buget se reglează după ponderi.
- nr. 49 (`c9`): Întrebările noi pentru o ofertă corectă pot primi puncte proprii.

**Întrebări și răspunsuri**

- **[d3-1] Ce pondere de tip primesc cele 7 piese noi?**
  - Context: Azi valorează 0: o canapea de 3 locuri iese 4 credite, o pereche de noptiere 5. Propunerea pornește de la ponderile existente (dulap 3; comodă TV, bibliotecă, birou, pat 2; comodă, masă, pantofar, noptieră, băncuță 1).
  - Variante: 1) Canapea 3, bufet 2, baie 2, hol 2, corp susp. 1, fotoliu 1, taburet 1 · 2) Toate 1 · 3) Alte valori, le dau eu
  - **Răspunsul PO (altceva):** „am scris mai sus cum se calculeaza”
- **[d3-2] Cât contează o cameră cu „Am deja un proiect” la care clientul nu a dat dimensiuni?**
  - Context: Azi contează ca „sub 2 m” (1 punct față de 5 la peste 4 m): o bucătărie în U de 8 m cu proiect tehnic e mai ieftină de preluat decât aceeași bucătărie descrisă prin formular. Decizia PO din 2026-07-31 a făcut dimensiunile opționale, fără să spună nimic despre cost.
  - Variante: 1) „2–4 m” implicit · 2) Cerem lungimea aproximativă · 3) Rămâne „sub 2 m”
  - **Răspunsul PO:** Cerem lungimea aproximativă (altfel decât recomandarea: „2–4 m” implicit). Un câmp opțional „lungime aproximativă” rămâne și cu proiect propriu; dacă e gol, avem tot „sub 2 m”.
- **[d3-3] Costul unei preluări are un minim și un maxim?**
  - Context: Azi minimul e 1 credit și nu există maxim. În regulile de produs plafonul e trecut ca hotărâre care lipsește; strategia de preț propunea între 3 și 25 de credite.
  - Variante: 1) Între 3 și 25 de credite · 2) Rămâne minim 1, fără maxim · 3) Alte limite
  - **Răspunsul PO:** Rămâne minim 1, fără maxim (altfel decât recomandarea: Între 3 și 25 de credite). Costul urmează doar punctajul. Proiectele foarte mari pot costa mai mult decât vor firmele să plătească.

## 22. După acceptare: fără contactele firmei, fără etape, stări greșite (`e1`, P1)

- Mărime: 6 zile · risc mediu · schimbă baza de date
- De ce contează: Clientul nu primește datele de contact ale firmei. Firma a putut marca „livrat” la un minut după acceptare. Fișa firmei rămâne „Ofertă trimisă” și după livrare, iar pagina clientului arată în continuare „Expiră”.
- Cauza: După acceptare clientul primește doar numele firmei și conversația, pentru că regula scrisă despre contacte merge doar într-un sens (de la client la firmă), iar firma nu are telefon sau e-mail în profil. Fișa firmei afișează starea preluării (care rămâne „Ofertă trimisă” până la final), nu starea proiectului, iar pagina clientului arată termenul de expirare și când el nu mai contează.
- Ce s-a văzut în cod: Toate cele cinci constatări se văd în cod. În plus: starea „În execuție” există în listă, dar nimic din aplicație nu mută cererea în ea. Firma nu are în baza de date niciun telefon sau e-mail propriu, deci „contactele firmei” trebuie hotărâte (ale cui?).
- **După răspunsurile PO (2026-11-13):** Firma bifează etape vizibile clientului (măsurători, contract, producție, montaj), fără ca ele să blocheze livrarea. „Livrat” se poate apăsa doar după un număr minim de zile de la acceptare; pornesc cu 7, valoare care se schimbă din Admin. Cam 3 zile în plus și date noi în baza de date.
- Risc: Contactele firmei ajung la client: o greșeală de verificare le-ar putea arăta și clienților altor firme sau înainte de acceptare.

**Pași**

1. Pe fișa firmei, când oferta e cea acceptată, insigna și blocul de termen afișează starea cererii (Acceptată / Livrată — așteaptă confirmarea clientului, cu data finalizării automate la 14 zile / Finalizată) și un bloc „Ce urmează” pentru firmă.
2. Pe pagina clientului, câmpul „Expiră” se ascunde după preluare și se înlocuiește cu „Acceptată pe …” după acceptare.
3. Adaug în răspunsul către client, doar pentru firma câștigătoare, datele de contact hotărâte de PO și le afișez în panoul „Ce urmează” (verificare în API, nu doar ascundere în UI).
4. La „Marchează ca livrată”, dialogul firmei explică ce urmează (clientul confirmă sau se finalizează automat în 14 zile) și, după decizia PO, se aplică pragul de timp.
5. Etapele de execuție se fac doar dacă PO le alege (vezi întrebarea); varianta minimă nu atinge baza de date.
6. Texte noi RO/EN pentru insigne, „Ce urmează” la firmă și „Acceptată pe”.

**Unde în cod**

- apps/frontend/src/app/[locale]/_components/client-fulfillment.tsx:79 — panoul „Ce urmează” primește doar numele firmei și legătura spre conversație
- apps/backend/prisma/schema.prisma:433 — firma nu are câmp de telefon sau e-mail (doar adresă, CUI, e-mail de facturare)
- apps/backend/src/modules/fulfillment/fulfillment.service.ts:48 — „Marchează ca livrată” verifică doar rolul și starea; niciun prag de timp și nicio etapă
- apps/frontend/src/app/[locale]/marketplace/claims/[claimSlotId]/page.tsx:299 — insigna de sus arată starea preluării (OFFER_SENT); la :486 blocul SLA rămâne „Oferta a fost trimisă”
- apps/frontend/src/app/[locale]/requests/[id]/page.tsx:186 — „Expiră” se afișează în orice stare a cererii
- apps/backend/src/modules/requests/request-expiration.processor.ts:34 — doar cererile nepreluate expiră, deci termenul nu mai are efect după preluare

**Cum se verifică**

- Test backend: contactele firmei apar doar pentru clientul cererii, doar pentru firma cu oferta acceptată și doar după acceptare.
- Verific pe local fișa firmei în stările Acceptată, Livrată, Finalizată și pagina clientului fără „Expiră” după preluare.

**Legături**

- nr. 6 (`e2`): Același panou de după acceptare la client și același dialog de livrare.
- nr. 8 (`a5`): Dacă contactul arătat clientului e al responsabilului, responsabilul trebuie să existe sigur pe preluare.
- nr. 45 (`g1`): Mesajele de livrare și finalizare către firmă și client se fac în același loc.
- nr. 57 (`g2`): Datele noi („Acceptată pe”, finalizare automată) folosesc formatul românesc reparat acolo.

**Întrebări și răspunsuri**

- **[e1-1] Ce date de contact ale firmei primește clientul după ce acceptă oferta?**
  - Context: Azi clientul vede doar numele firmei și conversația. Firma nu are telefon sau e-mail în profil; există doar conturile oamenilor din firmă (e-mail, telefon opțional).
  - Variante: 1) Datele persoanei responsabile de cerere · 2) Un telefon și un e-mail ale firmei, cerute la înscriere și editabile în „Firma mea” · 3) Niciun contact, doar conversația din aplicație
  - **Răspunsul PO:** Datele persoanei responsabile de cerere (recomandarea). Nume, e-mail, telefon dacă l-a completat, plus adresa și CUI-ul firmei. Fără schimbări în baza de date; clientul vorbește cu omul care lucrează la proiect.
- **[e1-2] Vrei etape de execuție după acceptare (măsurători, contract, producție, montaj)?**
  - Context: Azi după acceptare există doar „Marchează ca livrată” și „Proiectul s-a blocat?”. Etapele ar cere date noi în baza de date.
  - Variante: 1) Nu acum: doar „Ce urmează” la ambele părți și un dialog clar la livrare · 2) Etape informative pe care firma le bifează, vizibile clientului, fără să blocheze livrarea · 3) Etape obligatorii: „livrat” se poate apăsa doar după ultima etapă
  - **Răspunsul PO:** Etape informative pe care firma le bifează, vizibile clientului, fără să blocheze livrarea (altfel decât recomandarea: Nu acum: doar „Ce urmează” la ambele părți și un dialog clar la livrare). Date noi + migrare; clientul vede progresul; +2–3 zile.
- **[e1-3] Când are voie firma să marcheze proiectul ca livrat?**
  - Context: Azi firma poate apăsa „livrat” chiar la un minut după acceptare; clientul are apoi 14 zile să confirme, altfel se finalizează automat.
  - Variante: 1) Oricând, dar cu un dialog care spune clar ce urmează și termenul de 14 zile · 2) Doar după un număr minim de zile de la acceptare (de exemplu 7) · 3) Doar începând cu data de livrare promisă în ofertă, minus câteva zile
  - **Răspunsul PO:** Doar după un număr minim de zile de la acceptare (de exemplu 7) (altfel decât recomandarea: Oricând, dar cu un dialog care spune clar ce urmează și termenul de 14 zile). Regulă nouă de produs; o firmă care livrează repede trebuie să aștepte.

## 23. Regulile din 3D șterg configurația și nu explică de ce (`b7`, P1)

- Mărime: 3 zile · risc mediu
- De ce contează: La dulap, adâncimea 40 scoate barele de haine și ele nu revin la 60. Opțiunile interzise dispar fără motiv, deși textele de explicație există deja. Valorile în afara limitelor sunt corectate tacit.
- Cauza: La fiecare schimbare, configurația e „curățată” după regulile geometrice, iar ce se scoate (bare, sertare, casetiere, uși glisante) se pierde definitiv, pentru că următoarea schimbare pornește de la varianta deja curățată. Opțiunile imposibile sunt doar ascunse, iar numerele scrise în afara limitelor sunt mutate pe limită fără niciun semn.
- Ce s-a văzut în cod: Totul se vede în cod. În plus, auditul nu pomenește că și ușile glisante trec singure înapoi pe „Batante” când numărul de coloane iese din 2–3, tot fără mesaj. Cele două texte de explicație există în ro.json/en.json și nu le afișează nimeni. Singurul afișat e cel despre ușile glisante.
- Risc: Diferența dintre „intenție” și configurația curățată poate face ca modelul 3D, Sumarul și ce ajunge la firmă să nu mai fie aceeași configurație, dacă nu salvez mereu varianta curățată.

**Pași**

1. În pasul 3D păstrez „intenția” clientului (configurația dinaintea curățării) și aplic fiecare schimbare peste ea, apoi curăț doar pentru afișare și salvare. Așa, la 60 cm adâncime barele, sertarele și casetierele revin.
2. Adaug în shared o funcție care compară configurația dinainte cu cea de după curățare și întoarce ce s-a scos și de ce (bară → adâncime, sertare → 160 cm, casetieră → lățime, glisante → 2–3 coloane).
3. Afișez acele motive ca o linie scurtă în panoul zonei/opțiunilor, cu textele existente drawersTooHigh și hangingNeeds, plus texte noi pentru casetiere și coloane.
4. Butoanele Coloane „−” / „+” dezactivate primesc motivul sub ele („fiecare coloană are 22–100 cm”, „ușile glisante merg doar la 2–3 coloane”).
5. La câmpurile de dimensiune, când valoarea e corectată, afișez lângă câmp „Minimul e 60 cm — am pus 60”. Câmpul golit arată „Am păstrat valoarea anterioară”.
6. Teste unitare în shared pentru funcția de comparare și teste de component pentru dus-întors 40 → 60 cm la dulap, 100 → 160 cm la birou și 30 cm la noptieră.

**Unde în cod**

- packages/shared/src/questionnaire/piece3d/config.ts:611-648 — barele de haine se șterg sub 55 cm adâncime, iar sertarele peste 160 cm devin zonă deschisă (direct în configurația salvată)
- packages/shared/src/questionnaire/piece3d/config.ts:521-529 — numărul de coloane/casetiere e tăiat după lățime, iar ușile glisante revin tacit la batante
- apps/frontend/src/components/configurator/piece3d/configurator3d-step.tsx:360-363 — fiecare schimbare se aplică peste configurația deja curățată, nu peste ce a vrut clientul
- apps/frontend/src/components/configurator/piece3d/configurator3d-step.tsx:531-584 — opțiunile Sertare / Bară de haine / Polițe sunt ascunse fără nicio explicație
- apps/frontend/src/components/configurator/piece3d/configurator3d-step.tsx:102-107 — câmpul de dimensiune: valoarea în afara limitelor e mutată pe limită, iar câmpul golit revine la valoarea veche, fără mesaj
- apps/frontend/src/messages/ro.json:3817-3818 — textele drawersTooHigh și hangingNeeds există, dar nu sunt folosite în niciun component

**Cum se verifică**

- Dulap: adâncime 40 → 60, barele de haine revin pe aceleași coloane.
- Birou: lățime 100 → 160, revin 2 casetiere.
- Mesajul de motiv apare când opțiunea e ascunsă și dispare când nu mai e cazul.
- Valoarea 5 la lățimea dulapului arată mesajul de minim, iar „1,2” e tratat conform deciziei.

**Legături**

- nr. 1 (`b1`): Același tip de câmp de dimensiune: „1,2” cu virgulă e azi aruncat și revine la valoarea veche. Mesajul de corectare și citirea virgulei se fac la un loc.
- nr. 41 (`c4`): Detecția „pare că ai scris în metri” ține de unitățile amestecate.
- nr. 44 (`l1`): Același fișier și aceleași reguli (sertare, coloane); regula nouă pentru înălțimea sertarelor trebuie explicată la fel.
- nr. 43 (`d2`): Același pas 3D și același mod de a trata configurația implicită.

**Alegeri mărunte făcute fără PO (se pot schimba)**

- Când clientul scrie „1,2” într-un câmp în centimetri, îl transformăm singuri în 120 cm? → Da, transformăm și spunem. Sub 10 citim valoarea ca metri și afișăm „Am înțeles 120 cm”. Clientul vede imediat și poate corecta.

## 24. Ușile dulapului se întreabă de două ori în dormitor (`c3`, P1)

- Mărime: 0,25 zile · risc mic
- De ce contează: „Ce uși are dulapul?” și „Deschidere — dulap” se pot contrazice („Batante” și apoi „Glisante”). Firma le vede pe amândouă, iar primul răspuns nu intră nici în piesele cererii, nici în cost.
- Cauza: Dormitorul întreabă tipul ușilor dulapului (glisante / batante), apoi, pe alt ecran, sistemul de deschidere, unde „Glisante” apare din nou. Doar a doua întrebare ajunge în piesă și în cost, așa că cele două răspunsuri se pot contrazice.
- Ce s-a văzut în cod: Confirmat: răspunsul „Ce uși are dulapul?” nu intră nici în piesa salvată, nici în cost; firma îl vede doar ca etichetă pe fișă, lângă „Glisante” / „Mâner” venit din a doua întrebare. La dulapul de hol nu există deloc întrebarea despre uși.
- Împărțită în două: Acum intră doar redenumirea opțiunii „Glisante”. Întrebarea unică despre uși vine în etapa 6, cu versiunea nouă a formularului.
- Risc: Costul în credite al dulapurilor cu uși glisante crește față de azi (GLISANTE are 3 puncte, MÂNER 1), când clientul alegea „Mâner”.

**Pași**

1. Acum, fără versiune nouă: redenumesc în ro/en „Glisante” din lista de deschidere în „Uși glisante (culisante)” și scot din descriere sertarele (același text e folosit în toate fluxurile).

**Unde în cod**

- packages/shared/src/questionnaire/flows/bedroom.v2.ts:103 — intrebarea wardrobeDoorType (SLIDING / HINGED)
- packages/shared/src/questionnaire/flows/bedroom.v2.ts:220 — deriveRoom nu citeste wardrobeDoorType
- packages/shared/src/questionnaire/flows/per-piece.ts:47 — systemsWardrobe: Mâner / Push / Glisante, obligatoriu, minim 1
- packages/shared/src/questionnaire/flows/dressing.v3.ts:52 — modelul bun: SLIDING se transforma automat in GLISANTE
- apps/frontend/src/components/configurator/room-spec-card.tsx:166 — fisa firmei arata si eticheta usilor, si sistemul de pe piesa (linia 200)

**Cum se verifică**

- Test de derivare: dormitor versiune nouă, uși glisante → piesa „Dulap dormitor” cu GLISANTE; batante + Push → PUSH.
- Test: la uși glisante ecranul de deschidere al dulapului nu apare și un răspuns trimis pentru el e respins.
- Cererile publicate pe dormitorul v2 se rezumă și se editează ca înainte.

**Legături**

- nr. 27 (`c2`): Regula unică de deschidere (fără „Glisante” în lista comună) e aceeași schimbare.
- nr. 53 (`c14`): Ecranul dulapului se regrupează în aceeași versiune a dormitorului.

**Întrebări și răspunsuri**

- **[c3-1] La dulap, ușile se întreabă o singură dată, iar deschiderea doar la uși batante?**
  - Context: Azi clientul poate răspunde „Batante” și apoi „Glisante”; firma primește două răspunsuri care se bat cap în cap.
  - Variante: 1) Da: „Ce uși are dulapul?” + mâner / push doar la batante · 2) Scoatem „Ce uși are dulapul?”
  - **Răspunsul PO:** Da: „Ce uși are dulapul?” + mâner / push doar la batante (recomandarea). Un ecran mai puțin la ușile glisante; costul ține cont de ușile glisante.

## 25. O autentificare nouă închide celelalte sesiuni, iar paginile tac (`f3`, P1)

- Mărime: 2 zile · risc mediu
- De ce contează: Cine intră de pe telefon e scos de pe laptop. După aceea paginile arată liste goale sau „eroare neașteptată” în loc să ducă la login, iar acțiunile eșuează fără mesaj.
- Cauza: Prin decizie, o autentificare nouă închide sesiunile de pe celelalte dispozitive. Aplicația nu are un loc comun care să observe „sesiunea s-a pierdut”, așa că fiecare pagină arată ce poate: listă goală, „eroare neașteptată” sau nimic.
- Ce s-a văzut în cod: O singură sesiune pe cont nu e o greșeală: e invarianta 3.13 și decizia Î12 (FINALĂ). Bănuiala auditului despre o cursă între două reîmprospătări în aceeași pagină nu se confirmă: reîmprospătarea e deja una singură pe pagină; partea cu paginile care tac e reală.
- Risc: O redirecționare globală pusă greșit poate trimite la login și pe paginile publice sau poate face buclă pe pagina de login.

**Pași**

1. În api.ts, când refresh-ul eșuează, semnalez o singură dată „sesiune pierdută” (eveniment global) și arunc eroarea ca până acum.
2. Un ascultător global (în providers) golește datele contului și duce omul la /login?redirect=<pagina curentă>&reason=expired, unde apare „Te-ai autentificat pe alt dispozitiv sau sesiunea a expirat — intră din nou”.
3. Același ascultător e apelat și din use-socket la auth_expired, ca deconectarea de pe alt dispozitiv să fie anunțată pe loc.
4. Paginile care confundă 401 cu „nu există” (marketplace/[id], requests/[id], claims) tratează separat 401 față de 403/404.
5. Doar dacă PO alege mai multe sesiuni: login-ul revocă numai familiile peste limită (cele mai vechi) și trimite auth_expired doar acelor sesiuni (după sid), nu tuturor.
6. Actualizez 02 §3.13 și 07 Î12 dacă PO schimbă regula.

**Unde în cod**

- apps/backend/src/modules/auth/token.service.ts:37 — la login se revocă toate sesiunile active ale contului
- apps/frontend/src/lib/api.ts:57 — după un refresh eșuat eroarea 401 merge mai departe la pagină, fără nimic global
- apps/frontend/src/lib/providers.tsx:12 — clientul de interogări nu are tratare comună a erorilor 401
- apps/frontend/src/hooks/use-auth.ts:20 — „cine sunt eu” rămâne în memorie 60 s, deci gărzile paginilor nu observă imediat pierderea
- apps/frontend/src/app/[locale]/marketplace/[id]/page.tsx:46 — orice eroare, inclusiv 401, se afișează ca „Nicio cerere disponibilă”
- apps/frontend/src/hooks/use-socket.ts:57 — pe auth_expired doar golește datele, fără mesaj și fără login

**Cum se verifică**

- Test unitar api.ts: refresh eșuat emite o singură dată evenimentul, chiar cu mai multe cereri simultane.
- Test de componentă: la evenimentul global, routerul merge la /login?redirect=…&reason=expired.
- Manual cu două browsere: login pe al doilea, apoi o acțiune în primul → mesaj și login cu întoarcere.
- Dacă se aleg mai multe sesiuni: test backend că a N+1-a autentificare revocă doar cea mai veche.

**Documente de adus la zi**

- 02-technical-invariants.md §3.13 (contrazice): „O singură sesiune activă per user: login nou pe alt device invalidează sesiunea anterioară.” — doar dacă PO alege mai multe sesiuni.
- 07-decisions-log.md Î12 (contrazice): Decizia B: o singură sesiune activă — doar dacă PO alege altfel.

**Legături**

- nr. 35 (`f4`): aceeași gardă comună „fără sesiune → login → înapoi”
- nr. 14 (`f1`): întoarcerea după login trece prin aceeași funcție sigură de redirect
- nr. 36 (`g3`): conversația care nu arată erori: tot o eroare 401/rețea înghițită fără mesaj

**Întrebări și răspunsuri**

- **[f3-1] Un cont poate fi folosit în același timp pe mai multe dispozitive (de exemplu telefon și laptop)?**
  - Context: Azi, printr-o decizie scrisă, cine intră de pe telefon e scos de pe laptop. Partea cu paginile care tac se repară oricum; aici e vorba doar de regula în sine.
  - Variante: 1) Da, până la 5 dispozitive; al șaselea îl scoate pe cel mai vechi · 2) Nu, rămâne o singură sesiune, dar cu mesaj clar · 3) Da, fără limită
  - **Răspunsul PO:** Da, până la 5 dispozitive; al șaselea îl scoate pe cel mai vechi (recomandarea). Telefon și laptop merg împreună; se schimbă o regulă tehnică și o decizie scrisă, amândouă finale; aproximativ încă o zi de lucru.

## 26. Clientul fără nicio firmă în zonă nu află asta (`a6`, P1)

- Mărime: 2 zile · risc mic
- De ce contează: O cerere dintr-un oraș fără firme active pe rază primește „Cererea e vizibilă firmelor verificate din zona ta” și așteaptă șapte zile până expiră.
- Cauza: Aplicația nu verifică niciodată dacă există vreo firmă activă pe raza adresei clientului, așa că îi spune mereu că cererea e vizibilă firmelor din zonă.
- Ce s-a văzut în cod: Nimic din cod nu numără firmele care acoperă o adresă; cardul „Cine vede cererea” spune intenționat „vizibilă” fără să țină cont de rază. Numărarea e ieftină: aceeași distanță calculată în baza de date, peste locațiile firmelor aprobate cu abonament activ.
- Risc: Numărul poate ieși diferit de ce vede o firmă anume dacă interogarea nu folosește exact aceeași formulă de rază și aceleași condiții de abonament ca piața.

**Pași**

1. Backend: o interogare care numără firmele aprobate, cu abonament activ cu acces la piață, cu cel puțin o locație care acoperă punctul aproximat al cererii (aceeași formulă ca piața), fără excluderi.
2. Rezultatul intră în răspunsul cardului „Cine vede cererea” și într-o cale pentru Sumar (pe ciornă, când adresa are coordonate).
3. Sumar și pagina cererii: dacă rezultatul e zero, mesaj clar („Momentan nu avem firme partenere care lucrează în zona ta…”) cu ce urmează, după decizia PO.
4. La publicarea unei cereri fără nicio firmă: notificare către admin (eveniment prin outbox), ca echipa să poată căuta o firmă.
5. Teste pentru numărare (în rază / în afara razei / firmă suspendată / fără abonament).

**Unde în cod**

- apps/backend/src/modules/requests/requests.service.ts:535-557 — cardul „Cine vede cererea”: „fără rază — clientul nu știe firmele din zonă”
- apps/backend/src/modules/marketplace/marketplace.service.ts:219-243 — calculul distanței și al razei, doar pentru o firmă dată
- apps/frontend/src/messages/ro.json:1336-1337 — „Cererea e vizibilă firmelor verificate din zona ta…”
- apps/backend/src/modules/requests/requests.service.ts:360 — la publicare se scrie doar schimbarea de stare, fără nicio verificare de acoperire

**Cum se verifică**

- Test de integrare: cerere în Cluj cu firme doar în București → zero; în București → cel puțin una.
- Test: firmă suspendată sau fără abonament nu se numără.

**Documente de adus la zi**

- 03-business-rules.md §4.2 nota E-client-9 (cardul „Cine vede cererea”) (de actualizat): Cardul primește informația despre acoperire.

**Legături**

- nr. 3 (`a1`): Același card și aceleași texte pentru client.
- nr. 45 (`g1`): Notificarea către admin/client e un eveniment nou de pe lista de notificări.
- nr. 10 (`b3`): Mesajul de la Sumar stă pe ecranul de după „Publică cererea”, care se repară la b3.

**Întrebări și răspunsuri**

- **[a6-1] Ce îi spunem clientului despre firmele din zona lui?**
  - Context: Azi i se spune mereu că cererea e vizibilă firmelor din zonă, chiar și când nu e nicio firmă pe rază.
  - Variante: 1) Doar avertisment când nu e nicio firmă · 2) Numărul exact („3 firme lucrează în zona ta”) · 3) Trepte („câteva firme” / „multe firme”)
  - **Răspunsul PO:** Doar avertisment când nu e nicio firmă (recomandarea). Clientul nu e mințit; nu dezvăluim cât de puține firme avem în alte zone.
- **[a6-2] Lăsăm clientul să publice cererea când nu există nicio firmă în zonă?**
  - Context: Azi publicarea trece și cererea așteaptă degeaba până expiră.
  - Variante: 1) Da, cu avertisment, iar echipa Cozy Home e anunțată să caute o firmă · 2) Da, cu avertisment, fără altă acțiune · 3) Nu, publicarea se oprește până apare o firmă
  - **Răspunsul PO:** Da, cu avertisment, iar echipa Cozy Home e anunțată să caute o firmă (recomandarea). Clientul nu pierde cererea; echipa poate recruta firme acolo unde e cerere.

