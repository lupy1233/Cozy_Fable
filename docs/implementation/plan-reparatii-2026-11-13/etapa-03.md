# Etapa 3 — Bugetul și fișa firmei

Locurile 16–17. Firma vede doar ce a spus clientul: bugetul ales de el, piese fără materiale inventate, fără coduri interne.

- Mărime: 6 zile de lucru
- Module atinse: backend/requests, frontend/configurator, frontend/marketplace, frontend/requests, shared/piece3d, shared/questionnaire/flows, shared/request
- Tabele atinse: request_items, request_rooms, requests
- Presupuneri: Costul în credite nu depinde de suma aleasă pe glisor, ci de punctajul camerelor; recalibrarea lui e la nr. 21. Textele pieselor se salvează la publicare, deci cererile deja publicate rămân cu textul vechi.
- Gata când: O cerere în modul „am nevoie de ajutor” nu mai arată „PAL” la piese. Bugetul apare la firmă doar dacă l-a ales clientul, cu aceeași sumă ca în Sumar.

## 16. Bugetul: ales dinainte, trepte prea joase, afișat diferit (`b11`, P1)

- Mărime: 3 zile · risc mediu
- De ce contează: Glisorul pornește pe o valoare pe care clientul nu a ales-o și care intră în costul în credite. O spălătorie de 2,4 m primește o estimare de 25.000–75.000 lei sub care nu se poate coborî. Sumarul arată altă treaptă decât pasul de buget. Firma vede estimarea sub numele „Bugetul clientului”.
- Cauza: Când apare estimarea, formularul pune singur minimul ei ca buget al clientului, iar glisorul nu coboară sub acest minim; fără estimare (modul „Am nevoie de ajutor”) pune „Sub 5.000 RON”. Sumarul și pagina cererii arată treapta veche (sub 5.000 / 5.000–15.000 / peste 15.000), mult sub sumele estimate, în timp ce firma vede suma exactă sub numele „Bugetul clientului”.
- Ce s-a văzut în cod (altfel decât în audit): Costul în credite nu depinde de suma aleasă pe glisor, ci de punctajul camerelor. Estimările prea mari (o spălătorie de 2,4 m la 25.000 lei) vin din punctaje și se repară la nr. 21. Restul e ca în audit: glisorul pornește singur și nu coboară sub estimare.
- **După răspunsurile PO (2026-11-13):** Treptele de buget dispar de pe ecrane, iar firmele filtrează cererile cu un glisor de sumă (o zi în plus). Când clientul alege un buget sub estimare, îi spunem că șansele scad și că firmele pot ocoli cererea. Estimarea adevărată va veni din aplicația de ofertare; ce fac până atunci cu bugetul pus singur de formular alegi la întrebarea nouă, fără de care nu pot începe problema.
- Risc: Dacă se cere alegere obligatorie, ciornele vechi cu buget pus automat trebuie tratate (se cere alegerea din nou), altfel unele nu mai trec de pas.

**Pași**

1. Bugetul nu mai primește nicio valoare până nu o alege clientul: glisorul fără cursor pus și „Continuă” cere o sumă sau „Prefer să nu spun” (sau varianta aleasă de PO).
2. Glisorul coboară după decizia PO (de exemplu de la o treime din estimare), cu o notă când suma e sub estimare; textul spune „Alege suma” și explică de unde vine estimarea.
3. Sumarul, pagina cererii și lista firmelor arată suma aleasă (în lei, același format peste tot); treptele rămân doar pentru filtre și punctaj, ca acum.
4. La firmă, eticheta devine „Bugetul declarat de client” doar când clientul a ales; estimarea automată, dacă se arată, are eticheta „Estimare din răspunsuri”.
5. În modul „Am nevoie de ajutor”, aceeași regulă: fără treaptă pusă din oficiu.
6. Recalibrarea punctajelor pentru spălătorie / balcon e o schimbare de setări din Admin (fără cod) și merge la d3, care se ocupă de costul în credite.

**Unde în cod**

- apps/frontend/src/components/configurator/details-step.tsx:154 — fără valoare salvată, bugetul se setează automat pe minimul estimării
- apps/frontend/src/components/configurator/details-step.tsx:94 — implicit „Sub 5.000 RON”; :81 estimarea doar din camerele completate (în „Am nevoie de ajutor” nu există)
- apps/frontend/src/components/configurator/budget-slider.tsx:59 — glisorul începe la minimul estimării și merge până la de 3 ori minimul
- packages/shared/src/request.schemas.ts:82 — pragurile treptelor (5.000 / 15.000); :75 costul în credite din punctajul camerelor, nu din buget
- apps/frontend/src/components/configurator/review-facts-card.tsx:47 — Sumarul arată treapta plus „Bugetul tău estimat”
- apps/frontend/src/app/[locale]/marketplace/claims/[claimSlotId]/page.tsx:535 — firma vede suma de pe glisor ca buget

**Cum se verifică**

- Teste pe pasul de buget: fără atingere nu se poate continua (sau rămâne „Prefer să nu spun”), coborâre sub estimare, „Am nevoie de ajutor” fără treaptă implicită.
- Test pe Sumar și pe pagina cererii: aceeași sumă ca pe glisor.
- Test că punctajul și costul în credite nu se schimbă pentru aceeași cerere.

**Legături**

- nr. 21 (`d3`): Estimarea minimă și costul în credite vin din același punctaj; recalibrarea se face o singură dată.
- nr. 17 (`d1`): Firma vede pe fișă un buget pe care clientul nu l-a ales — aceeași cauză.
- nr. 9 (`b2`): Date generale se pierd la Înapoi; bugetul ales trebuie să rămână salvat.
- nr. 42 (`i1`): „lei” pe pasul de buget și „RON” în Sumar.

**Întrebări și răspunsuri**

- **[b11-1] Ce se întâmplă cu bugetul dacă clientul nu atinge glisorul?**
  - Context: Azi formularul pune singur minimul estimării (sau „Sub 5.000 RON”) și firma îl vede ca buget al clientului.
  - Variante: 1) Alegere obligatorie: o sumă sau „Prefer să nu spun” · 2) Implicit „Prefer să nu spun” · 3) Rămâne estimarea, dar marcată „neconfirmată” la firmă
  - **Răspunsul PO (altceva):** „aici o sa avem in felul urmator, bazat pe dimesniuni si materiale o sa se faca un estimat cu ajutorul aplicatiei de ofertare pe care o sa o implementam ulterior in aplicatie”
- **[b11-2] Poate clientul declara un buget mai mic decât estimarea aplicației?**
  - Context: Azi glisorul începe exact la estimarea minimă; un client cu buget mai mic poate alege doar „Prefer să nu spun”.
  - Variante: 1) Da, glisorul coboară până la o treime din estimare, cu o notă · 2) Da, sumă scrisă liber de la 1.000 lei · 3) Nu, minimul rămâne estimarea, cu o explicație
  - **Răspunsul PO:** Da, glisorul coboară până la o treime din estimare, cu o notă (recomandarea). Clientul își spune bugetul real; firma vede că e sub estimare. Precizare PO: „bazat pe estimarea realista pe care o sa o facem o sa si anuntam clientul ca sunt sanse mici pentru a ne incadra in bugetul dat de catre client si firmele sun mai probabil sa nu accepte acea cerere”
- **[b11-3] Ce facem cu cele trei trepte de buget (sub 5.000, 5.000–15.000, peste 15.000 lei)?**
  - Context: Aproape orice bucătărie sau dressing cade în „peste 15.000”; treptele servesc azi la filtre și la mărimea proiectului.
  - Variante: 1) Le păstrăm doar pentru filtre; clientul și firma văd suma aleasă · 2) Trepte noi, mai sus (ex. sub 10.000, 10–30.000, 30–60.000, peste 60.000) · 3) Rămân ca acum, și pe ecrane
  - **Răspunsul PO (altceva):** „nu punem trepte ci lasam firmele sa aleaga dintr-un slider suma”

## 17. Pe fișa firmei apar lucruri pe care clientul nu le-a spus (`d1`, P1)

- Mărime: 3 zile · risc mediu
- De ce contează: În modul „am nevoie de ajutor” toate piesele apar cu „PAL”. Apar coduri interne („Interior: HANGING_RODS”, „SIX locuri”), text fără diacritice și dimensiuni calculate prezentate ca ale camerei.
- Cauza: Lista de piese pentru firmă se scrie la publicare ca text simplu, în română fără diacritice, cu valori implicite (PAL, mâner) acolo unde clientul n-a răspuns și cu codurile interne lipite direct în text. Antetul camerei pune laolaltă trei numere calculate și le arată ca „lungime × lățime × înălțime” a camerei.
- Ce s-a văzut în cod: În modul „am nevoie de ajutor”, camera fără răspunsuri trece validarea, dar textul pieselor se generează tot din fluxul obișnuit, care pune PAL implicit. Numele și descrierile pieselor se salvează ca text gata făcut în tabelul request_items: cererile deja publicate își păstrează textul vechi până la următoarea editare. Dimensiunile din antet nu sunt ale camerei: lungimea e suma metrilor liniari (plus lățimea patului), lățimea e adâncimea standard de corp (0,6 m), înălțimea e tavanul sau 2,6 m implicit.
- **După răspunsurile PO (2026-11-13):** Camerele cu „am nevoie de ajutor” fără răspunsuri nu mai primesc piese puse din oficiu, deci costă mai puțin de preluat (cu 1–3 credite pe cameră).
- Risc: Multe fluxuri ating aceleași teste de generare. O greșeală schimbă și scorul (piese lipsă → mai puține credite), deci verific că scorul rămâne neschimbat acolo unde nu vrem să se schimbe.

**Pași**

1. La camerele din modul „am nevoie de ajutor” fără niciun răspuns nu mai generez piese și materiale. Cardul camerei arată „Detaliile se stabilesc cu firma” (scorul după decizia PO).
2. Rescriu cu diacritice toate numele și descrierile generate (bucătărie, living, dormitor, dressing, birou, baie, hol, spălătorie, balcon, cămară, piese 3D) și pun „×” în dimensiuni.
3. Înlocuiesc codurile interne cu etichete în română: module dressing, locuri la masă („6 locuri”, „8+ locuri”), televizor („TV pe perete / pe comodă / nedecis”), „Polițe deschise” vs „Culoare deschisă”.
4. În antetul camerei nu mai afișez „L × l × H”. Arăt „Mobilier: ~5,6 m liniari” doar când există, plus înălțimea tavanului doar dacă a fost dată de client.
5. Elimin piesele inventate din dormitor/dressing (ex. „Pat tapitat — PAL — MANER” când materialul și sistemul nu au fost alese): piesa păstrează doar ce a răspuns clientul.
6. Actualizez testele de generare a pieselor din shared (instantanee) și verific pagina cererii, piața și fișa de lucru.

**Unde în cod**

- apps/backend/src/modules/requests/configurator.service.ts:70-83 — în modul de proiectare plătită răspunsurile pot lipsi, dar piesele se generează oricum din valorile implicite
- packages/shared/src/questionnaire/flows/kitchen.v3.ts:76-124 — „Corpuri baza” / „Corpuri suspendate” cu PAL implicit, fără diacritice; lățimea „camerei” = adâncimea standard 0,6 m
- packages/shared/src/questionnaire/flows/dressing.v3.ts:160-167 — „Interior: HANGING_RODS, SHELVES…” scrise cu codurile interne
- packages/shared/src/questionnaire/flows/guided-pieces/piece-table.ts:126 și guided-pieces/v3.ts:223 — „SIX locuri”, „TV: TV_ON_WALL”
- packages/shared/src/questionnaire/piece3d/config.ts:937-981 și piece3d/catalog-config.ts:114-130 — rezumatul 3D fără diacritice, „x” în loc de „×”, „deschis” cu două sensuri
- apps/frontend/src/components/configurator/room-spec-card.tsx:108-115 și 195-206 — antetul „L × l × H m” și numele/descrierea piesei afișate exact cum au fost salvate

**Cum se verifică**

- Instantanee pentru textul generat pe fiecare flux, fără coduri interne și cu diacritice.
- Cerere „am nevoie de ajutor” cu o cameră fără răspunsuri: fără piese, cardul arată „Detaliile se stabilesc cu firma”.
- Scorul unei cereri obișnuite e identic înainte și după schimbarea textelor.

**Legături**

- nr. 38 (`b10`): Fișa cererii și Sumarul folosesc aceleași texte generate; rânduri repetate și valori greșite se repară în același loc.
- nr. 32 (`d5`): Pagina cererii (client) folosește același card de cameră.
- nr. 43 (`d2`): Același rezumat 3D (deschidere, uși) se rescrie o singură dată.
- nr. 28 (`c1`): Ce înseamnă „material” în fiecare flux schimbă textul „Material dorit”.
- nr. 42 (`i1`): Vocabularul unificat trebuie folosit în textele noi; altfel le rescriu de două ori.
- nr. 55 (`i2`): Textul generat rămâne în română și în interfața în engleză.

**Alegeri mărunte făcute fără PO (se pot schimba)**

- Firmele care folosesc interfața în engleză trebuie să vadă piesele cererii în engleză? → Nu, doar română corectă. Repar diacriticele și codurile în 3 zile. În engleză piesele rămân în română.

**Întrebări și răspunsuri**

- **[d1-1] La camerele din „am nevoie de ajutor” fără răspunsuri, firma plătește același cost în credite ca azi?**
  - Context: Azi camera goală primește piese implicite (de ex. două corpuri PAL la bucătărie), care adaugă puncte la cost. Dacă scot piesele, costul acestor cereri scade cu 1–3 credite pe cameră.
  - Variante: 1) Costul rămâne ca azi · 2) Costul scade
  - **Răspunsul PO:** Costul scade (altfel decât recomandarea: Costul rămâne ca azi). Cererile de proiectare devin mai ieftine de preluat; costul reflectă doar ce a spus clientul.

