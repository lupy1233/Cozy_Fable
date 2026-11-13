# Etapa 6 — Formularul, prima versiune nouă: material și deschidere

Locurile 27–28, cu 51 și 53 urcate lângă ele și cu a doua parte din 4, 20 și 24. O singură regulă pentru material, o singură întrebare de deschidere doar unde există uși sau sertare, „decide firma” ca ieșire și mai puține ecrane pe piesă.

- Mărime: 18,5 zile de lucru · versiune nouă de formular
- Module atinse: backend/prisma seed, e2e, frontend/configurator, frontend/illustrations, frontend/requests (fisa firmei), frontend/review, shared/questionnaire
- Tabele atinse: project_sizing_config, request_items, request_rooms
- Presupuneri: Cererile publicate și ciornele în curs rămân pe versiunea veche; doar camerele adăugate după lansare primesc întrebările noi. Costul în credite se schimbă pentru cererile noi; firmele trebuie anunțate. Nicio schimbare a bazei de date: „decide firma” se salvează cu valorile care există deja.
- Gata când: Rafturile, cuierul și oglinda nu mai cer „deschidere”. Toate cele 28 de fluxuri se parcurg până la Sumar pe versiunea nouă, iar o cerere veche se poate edita pe versiunea ei.

## A doua parte din problema 4 (`c6`) — 1,25 zile

Blatul primește „Nu știu, decide firma” la bucătărie și un set propriu de blaturi la spălătorie și balcon.

## A doua parte din problema 20 (`c10`) — 1 zi

„Altă piesă” primește dimensiuni în centimetri, iar listele ei de material și deschidere urmează regula unică.

## A doua parte din problema 24 (`c3`) — 0,75 zile

La dulap, ușile se întreabă o singură dată, iar deschiderea apare doar la uși batante. Aceeași regulă la dulapul de hol.

## Costul fix al versiunii noi — 3 zile

Fișierele versiunii noi, testele pe toate fluxurile, imaginile, parcurgerea celor 28 de fluxuri în browser și lansarea. Costul e același oricâte întrebări se schimbă, de aceea le strâng la un loc.

## 27. „Deschidere” e obligatorie la piese fără uși și întrebată în patru feluri (`c2`, P1)

- Mărime: 3,25 zile · risc mediu · versiune nouă de formular
- De ce contează: Obligatorie la rafturi, cuier, oglindă, măsuță, băncuță și pat fără ladă. Opțională la 3 piese, absentă la baie și la dressingul cu uși batante, întrebată de două ori la comoda TV, bibliotecă și comodă. Răspunsul fals intră în costul în credite.
- Cauza: Întrebarea de deschidere e pusă automat la fiecare piesă bifată, chiar și la rafturi, cuier, oglindă, măsuță sau pat fără depozitare, și nu are nicio opțiune de tip „fără uși”. La piesele 3D (comodă TV, bibliotecă, comodă) deschiderea se alege și în 3D, și pe un ecran separat, iar la baie și la dressingul cu uși batante nu se întreabă deloc.
- Ce s-a văzut în cod: Confirmat în cod pentru toate cazurile din audit. În plus: aceeași funcție construiește deschiderea în 7 camere (dormitor, living, birou, hol, spălătorie, balcon, depozitare), iar spălătoria și balconul scot deja deschiderea la blat și rafturi; biroul și holul nu. Răspunsul intră în cost: deschiderea cu punctajul cel mai mare dintre cele alese (Mâner 1, Push 2, Glisante 3).
- **După răspunsurile PO (2026-11-13):** Clientul poate bifa mai multe feluri de deschidere, ca azi; costul îl ia pe cel mai scump. Adaug opțiunea „Rabatabilă, pe pistoane (în sus sau în jos)” la piesele cu corpuri suspendate: bucătărie, corp suspendat, bufet, comodă TV. Spune dacă lista de piese e alta.
- Risc: Costul în credite scade la piesele fără fronturi și urcă la dulapurile glisante; cererile vechi își păstrează costul, deci două cereri asemănătoare pot costa diferit o vreme.

**Pași**

1. Acum, fără versiune nouă: textul de sub întrebare (common.pieceSystems.subtitle) devine „Pentru ușile și sertarele piesei. Dacă piesa nu are, alege varianta cea mai apropiată sau scrie în detalii.” — doar ca paleativ; regula se schimbă în versiunea nouă.
2. În versiunea nouă: un nou constructor de pași per piesă primește pentru fiecare piesă un semn „are fronturi: da / nu / poate”; la „nu” (rafturi, cuier, oglindă, blat, măsuță) pasul dispare, la „poate” (birou, bancă, altceva) apare cu „Fără uși sau sertare”.
3. La pat, deschiderea apare doar la depozitare cu sertare; la lada rabatabilă și fără depozitare dispare.
4. Opțiuni comune peste tot: Mâner / Push (fără mâner) / Decide firma (c7); Gola și Aventos rămân doar la bucătărie; ușile glisante devin tip de uși (c3), nu deschidere.
5. Piesele 3D: o singură sursă, alegerea din 3D; scot ecranul separat de la comoda TV, biblioteca și comoda.
6. Baia și dressingul cu uși batante primesc ecranul de deschidere (împreună cu c9 din altă grupă).

**Unde în cod**

- packages/shared/src/questionnaire/flows/per-piece.ts:47 — pasul systems* pentru orice piesa, minim 1, Mâner / Push / Glisante
- packages/shared/src/questionnaire/flows/laundry.v2.ts:58 — filtrul NO_SYSTEMS_STEPS (exista doar la spalatorie si balcon)
- packages/shared/src/questionnaire/flows/guided-pieces/builder.ts:37 — deschiderea la piesele ghidate e optionala
- packages/shared/src/questionnaire/flows/guided-pieces/v3.ts:105 — al doilea ecran de deschidere doar la 3 piese; v3.ts:121 il aduna cu alegerea din 3D
- packages/shared/src/questionnaire/flows/bathroom.v2.ts:153 — baia: piesele nu primesc niciodata deschidere
- packages/shared/src/questionnaire/engine.ts:367 — deschiderea intra in cost (cel mai mare punctaj)

**Cum se verifică**

- Test în engine: hol versiune nouă cu cuier + oglindă → niciun pas de deschidere; cu bancă → pas cu „Fără uși sau sertare” care lasă piesa fără sisteme.
- Test: pat fără depozitare → fără deschidere; pat cu sertare → deschidere vizibilă.
- Test: comoda TV versiune nouă → o singură sursă (3D), sistemul piesei = alegerea din 3D.
- Test de cost: aceeași cerere pe versiunea veche și pe cea nouă, diferența explicată.

**Documente de adus la zi**

- 03-business-rules.md §4.1 (de actualizat): Scrie „sisteme (push/glisante/buton presiune)” pe piesă; noua regulă: deschidere doar la piesele cu fronturi, glisantele ca tip de uși.

**Legături**

- nr. 24 (`c3`): „Glisante” iese din deschidere și devine tip de uși.
- nr. 51 (`c7`): „Decide firma” e opțiune în aceeași listă.
- nr. 49 (`c9`): Deschiderea la baie e o întrebare care lipsește (altă grupă).
- nr. 21 (`d3`): Costul în credite se schimbă pentru piesele fără fronturi; d3 reglează formula, ca să nu se măsoare de două ori.

**Întrebări și răspunsuri**

- **[c2-1] Unde întrebăm deschiderea?**
  - Context: Azi e obligatorie la orice piesă, chiar fără uși; clientul bifează ceva fals și firma plătește credite pentru un sistem care nu există.
  - Variante: 1) Doar la piesele cu uși sau sertare · 2) Peste tot, dar opțională · 3) Ca azi
  - **Răspunsul PO:** Doar la piesele cu uși sau sertare (recomandarea). Dispare la rafturi, cuier, oglindă, blat, măsuță, pat fără sertare; la birou, bancă și „altceva” apare cu „Fără uși sau sertare”.
- **[c2-2] Opțiunile de deschidere devin aceleași peste tot: Mâner / Push / Decide firma, iar ușile glisante se întreabă separat, ca tip de uși?**
  - Context: Azi sunt patru liste diferite; „Glisante” amestecă ușile culisante cu sertarele pe glisiere.
  - Variante: 1) Da, listă unică + glisantele ca tip de uși · 2) Listă unică, dar „Glisante” rămâne în ea
  - **Răspunsul PO:** Da, listă unică + glisantele ca tip de uși (recomandarea). Glisantele apar doar la dulap și dressing; la bucătărie rămân în plus Gola și Aventos. Precizare PO: „de precizat ca ezista si usi cu deschidere pe pistoane in sus sau in jos la anumite corpuri”
- **[c2-3] La o piesă, clientul alege un singur fel de deschidere sau mai multe?**
  - Context: Azi poate bifa mai multe (de ex. mâner și push), iar costul ia varianta cea mai scumpă.
  - Variante: 1) Unul singur · 2) Mai multe, ca azi
  - **Răspunsul PO:** Mai multe, ca azi (altfel decât recomandarea: Unul singur). Mai flexibil, dar costul ia mereu varianta cea mai scumpă.

## 28. „Ce material?” înseamnă altceva în fiecare flux (`c1`, P1)

- Mărime: 4,25 zile · risc mediu · versiune nouă de formular
- De ce contează: Fronturile la bucătărie (corpul nu e întrebat), modulele interioare la dressing, „structura” la 7 piese, „materialul principal” la dulap. Aceleași opțiuni PAL / MDF, cu preț pe metru liniar, apar și la oglindă, canapea, fotoliu, pat și masă.
- Cauza: Aceeași listă de materiale pentru fronturi (cu explicații despre fronturi frezate și prețuri pe metru liniar) e pusă la orice piesă, de la corpul de bucătărie la canapea și oglindă, iar titlul nu spune niciodată la ce parte a piesei se referă. Firma nu știe dacă „MDF vopsit” înseamnă fronturi, corp sau tot.
- Ce s-a văzut în cod: Confirmat. În date există un singur material pe piesă (o singură coloană), deci „corpul” și „fronturile” nu se pot salva separat fără schimbare de schemă; al doilea material poate merge doar în descriere. La piesele de catalog (canapea, fotoliu, taburet, bufet etc.) materialul lipsă devine „Altul”, la celelalte „PAL” (CP-30).
- **După răspunsurile PO (2026-11-13):** Rămâne o singură întrebare, „Material pentru fronturi”. La mobilierul de baie și de balcon adaug opțiunea „Integral din MDF (corp și fronturi)”, pentru cazurile rare pomenite de tine; se punctează ca MDF-ul de azi.
- Risc: Cele mai multe texte noi (RO + EN, cu explicații și imagini pe opțiuni); costul în credite se schimbă la tapițate și oglindă.

**Pași**

1. Acum, fără versiune nouă: corectez subtitlurile care se contrazic (dressing „Materialul principal (corp și uși)”, piesele ghidate cu „Confirmă materialul de execuție cu firma.”, ro.json:6483–6525) și scriu „lei pe metru liniar” în loc de „lei/ml”.
2. În versiunea nouă: trei seturi de material în common.ts — corpuri (fronturi), tapițate (cadru) și oglindă (ramă) — plus blaturile din c6; fiecare cu „Decide firma” (c7).
3. Corpurile (bucătărie, dressing, dulapuri, comode, birou, noptiere, biblioteci, baie): un titlu unic „Material pentru fronturi (uși și sertare)”, cu corpul PAL standard spus în subtitlu; fișa firmei primește în descriere „Corp: PAL standard”.
4. Tapițatele și oglinda primesc setul lor; valorile se salvează ca LEMN_MASIV / ALTUL cu descriere (de ex. „Cadru: placaj”), fără valori noi în enum.
5. Prețul pe metru liniar se arată doar la corpuri (un semn pe pas care ascunde indiciul de preț în fereastra de detalii).
6. Aliniez materialul implicit la derivare (PAL vs Altul) în noul constructor.

**Unde în cod**

- packages/shared/src/questionnaire/flows/common.ts:13 — un singur set de materiale (OFFERED_MATERIALS) pentru tot
- packages/shared/src/questionnaire/flows/per-piece.ts:35 — materialul fiecarei piese din camere, fara subtitlu
- packages/shared/src/questionnaire/flows/guided-pieces/builder.ts:24 — materialul pieselor ghidate, acelasi set
- packages/shared/src/questionnaire/flows/guided-pieces/catalog-v1.ts:18 — canapea, fotoliu, taburet si celelalte 4 piese de catalog primesc acelasi pas
- packages/shared/src/questionnaire/flows/dressing.v3.ts:141 — materialul dressingului, subtitlu „Materialul modulelor interioare.” (ro.json:4646)
- apps/backend/prisma/schema.prisma:844 — piesa salvata are un singur material

**Cum se verifică**

- Test în engine pe fiecare set: opțiunile corecte la corp, canapea, oglindă, blat; versiunile vechi neschimbate.
- Test de derivare: canapea „Cadru: placaj” → piesa cu ALTUL și descrierea corectă; corp „MDF vopsit” → descrierea „Corp: PAL standard”.
- Test de conținut: cheile i18n noi există în ro.json și en.json; imaginile opțiunilor noi au acoperire.

**Documente de adus la zi**

- 03-business-rules.md §4.1 (de actualizat): Scrie „material (PAL/MDF/lemn masiv)” pe piesă; trebuie precizat că e materialul fronturilor și că tapițatele / oglinda au seturi proprii.

**Legături**

- nr. 4 (`c6`): Setul de blaturi e unul dintre seturile noi.
- nr. 51 (`c7`): „Decide firma” în fiecare set.
- nr. 53 (`c14`): Dacă PO vrea și întrebarea de corp, adaugă un ecran pe piesă, opusul lui c14.
- nr. 21 (`d3`): Punctajul pe material (PAL 1 … lemn masiv 4) se reaplică pe seturile noi; formula costului trebuie stabilită întâi.
- nr. 42 (`i1`): Același vocabular pentru „fronturi / corp / cadru”.

**Întrebări și răspunsuri**

- **[c1-1] La corpuri, ce întrebăm despre material?**
  - Context: Azi titlul spune „material” fără să spună dacă e vorba de fronturi sau de corp; în practică „MDF vopsit” înseamnă fronturi vopsite pe corp din PAL.
  - Variante: 1) Doar „Material pentru fronturi”; corpul e PAL standard, scris sub întrebare · 2) „Material pentru fronturi” + „Corpul: PAL standard / la fel ca fronturile / decide firma” · 3) „Material principal (corp și fronturi)”, ca la dulapul de azi
  - **Răspunsul PO:** Doar „Material pentru fronturi”; corpul e PAL standard, scris sub întrebare (recomandarea). Zero întrebări în plus; firma vede „Fronturi: MDF vopsit, corp PAL standard”; cine vrea alt corp scrie la „Altul” sau în detalii. Precizare PO: „exista cazuri rare in care de exemplu in bai sau pe balcoane cand se face integral din mdf”
- **[c1-2] La canapea, fotoliu și taburet, ce întrebăm despre material?**
  - Context: Azi primesc lista de fronturi (PAL, MDF vopsit, culori RAL) pentru „structură”; tapițeria se alege deja în 3D.
  - Variante: 1) Nimic: cadrul îl decide firma · 2) „Cadru: lemn masiv / placaj / decide firma”
  - **Răspunsul PO:** Nimic: cadrul îl decide firma (recomandarea). Un ecran mai puțin; costul ia punctaj mediu, ca azi la „Altul”.
- **[c1-3] Oglinda, masa și patul primesc opțiuni proprii, fără prețul pe metru liniar?**
  - Context: Azi oglinda primește PAL / MDF înfoliat cu prețuri „lei/ml”, care nu au sens la o ramă sau la o masă.
  - Variante: 1) Da, opțiuni proprii fiecărei piese · 2) Rămâne setul comun, doar ascundem prețul pe metru
  - **Răspunsul PO:** Da, opțiuni proprii fiecărei piese (recomandarea). Oglinda: ramă fără / lemn / MDF vopsit / metal / decide firma. Masa și patul: setul de lemn, fără preț pe metru. Opțiuni potrivite piesei; câteva texte și imagini noi.

## 51. Nu există „Nu știu / decide firma” (`c7`, P2)

- Mărime: 2 zile · risc mediu · versiune nouă de formular
- De ce contează: O singură ieșire de acest fel în tot formularul. 52 de întrebări de material și 30 de deschidere sunt obligatorii fără ea.
- Cauza: Întrebările tehnice obligatorii (material, deschidere, blat și altele) nu au nicio variantă pentru clientul care nu știe, așa că acesta alege la întâmplare. „Altul” nu e o ieșire, pentru că cere apoi un text obligatoriu.
- Ce s-a văzut în cod: Confirmat: singura ieșire e „Nu m-am decis” la televizorul de la comoda TV. Tehnic, „decide firma” nu cere valoare nouă în baza de date: la material poate fi salvat ca „Altul” cu descrierea „Clientul vrea recomandarea firmei” (punctaj 2, la fel ca azi „Altul”), iar la deschidere ca „fără sistem” (0 puncte).
- Mutată față de ordinea PO: Era pe locul 51. Intră în prima versiune nouă a formularului, pentru că „decide firma” e o opțiune din listele de material și de deschidere pe care le rescriu la nr. 27 și 28.
- Risc: Dacă „decide firma” are punctaj mic, clienții îl pot alege ca să scadă costul cererii; dacă are punctaj mare, firmele plătesc pentru nehotărâre.

**Pași**

1. Acum, fără versiune nouă: contor „x / 120” sub câmpul „Altul” (doar interfața).
2. În versiunea nouă: o opțiune comună „Nu știu — vreau recomandarea firmei” în seturile de material, deschidere și blat, fără text obligatoriu.
3. La salvare: materialul devine ALTUL cu descrierea „Clientul vrea recomandarea firmei”, deschiderea rămâne fără sistem; nicio valoare nouă în enum-uri.
4. Fișa firmei arată „Recomandarea firmei” în locul etichetei „Altul” când descrierea o indică (un marcaj în răspunsuri, nu doar text).
5. Dacă PO alege și alte întrebări (forma, tipul ușilor, mărimea patului), le adaug „decide firma” în aceeași versiune, cu efect zero pe cost.
6. Rânduri de scor în seed pentru valorile noi, ca adminul să le regleze.

**Unde în cod**

- packages/shared/src/questionnaire/flows/common.ts:13 — setul de materiale, fara „decide firma”
- packages/shared/src/questionnaire/flows/common.ts:63 — „Altul” cere text obligatoriu de cel mult 120 de caractere, fara contor
- packages/shared/src/questionnaire/flows/per-piece.ts:55 — deschiderea, minim o bifa
- packages/shared/src/questionnaire/flows/guided-pieces/v3.ts:209 — singurul „Nu m-am decis” (tvSetup)
- apps/backend/prisma/seed.ts:46 — „Altul” valoreaza 2 puncte la material (mediu)
- apps/backend/src/modules/sizing/sizing.service.ts:55 — o optiune fara rand de scor valoreaza 0

**Cum se verifică**

- Test în engine: „decide firma” e acceptat fără text în versiunea nouă și respins în versiunile vechi.
- Test de derivare și cost: material „decide firma” → ALTUL + descriere, punctaj egal cu „Altul”; deschidere „decide firma” → fără sistem.
- Test de componentă: fișa firmei arată „Recomandarea firmei”, nu „Altul”.

**Documente de adus la zi**

- 03-business-rules.md §4.5 scoring (de actualizat): Trebuie scris cât valorează „decide firma” în costul în credite.

**Legături**

- nr. 28 (`c1`): Aceleași liste de material.
- nr. 27 (`c2`): Aceeași listă de deschidere.
- nr. 4 (`c6`): Blatul primește aceeași opțiune.
- nr. 21 (`d3`): Punctajul pentru „decide firma” intră în formula costului în credite.

**Întrebări și răspunsuri**

- **[c7-1] La ce întrebări punem „Nu știu — vreau recomandarea firmei”?**
  - Context: Azi nu există nicăieri (doar la televizor); 52 de întrebări de material și 30 de deschidere sunt obligatorii fără ieșire.
  - Variante: 1) Material, deschidere și blat · 2) Toate întrebările tehnice obligatorii · 3) Doar în modul „Am nevoie de ajutor”
  - **Răspunsul PO:** Material, deschidere și blat (recomandarea). Acoperă întrebările tehnice pe care clientul obișnuit nu le știe; restul rămân cum sunt.
- **[c7-2] Cât costă în credite „decide firma”?**
  - Context: Materialul schimbă costul (PAL 1 punct … lemn masiv 4); „Altul” valorează azi 2.
  - Variante: 1) Mediu: la material ca „Altul” (2), la deschidere 0 · 2) Minim: ca PAL (1) · 3) O valoare separată, reglabilă de admin
  - **Răspunsul PO:** Mediu: la material ca „Altul” (2), la deschidere 0 (recomandarea). Nu încurajează trișatul și nu pedepsește firma; nu cere setări noi.

## 53. Prea multe ecrane: două obligatorii pe fiecare piesă (`c14`, P2)

- Mărime: 3 zile · risc mediu · versiune nouă de formular
- De ce contează: Dormitorul cu toate piesele ajunge la 21 de întrebări, 20 obligatorii. „Am deja un proiect” cere tot 11 răspunsuri. Ecranul de fronturi de la bucătărie are până la 9 întrebări.
- Cauza: Materialul și deschiderea sunt două ecrane separate pentru fiecare piesă, așa că formularul crește cu două ecrane la fiecare piesă bifată. Nu există „același material pentru toate piesele”, ca la bucătărie, iar modul „Am deja un proiect” cere tot aceste răspunsuri.
- Ce s-a văzut în cod: Confirmat: fiecare piesă bifată adaugă două ecrane (material, apoi deschidere), din decizia PO 2026-07-13 (docs/12 S2). Modul „Am deja un proiect” scoate din obligatoriu doar dimensiunile și schițele (decizie PO 2026-07-31, cu test care cere ca restul să rămână obligatorii). Ecranul de fronturi de la bucătărie se poate împărți pe zone doar din interfață, fără versiune nouă.
- Mutată față de ordinea PO: Era pe locul 53. Intră în prima versiune nouă, pentru că unirea materialului cu deschiderea se face chiar pe ecranele pe care le rescriu la nr. 27 și 28.
- **După răspunsurile PO (2026-11-13):** În „Am deja un proiect”, materialul și deschiderea rămân obligatorii, cu „decide firma” printre opțiuni.
- Risc: Răspunsul comun trebuie copiat corect pe fiecare piesă; altfel firma vede piese fără material sau cu material greșit.

**Pași**

1. Acum, fără versiune nouă: ecranul de fronturi al bucătăriei împărțit pe zone (Bază / Suspendate / Insulă) din interfață (din propunerea de redesign).
2. În versiunea nouă: materialul și deschiderea aceleiași piese pe un singur ecran (același id de întrebare, alt grup de ecran), cu cel mult 3 întrebări pe ecran.
3. În versiunea nouă, la camerele cu piese: întrebarea „Același material și aceeași deschidere pentru toate piesele?”; la „Da” un singur ecran comun, la „Nu” câte un ecran pe piesă (ca bucătăria v3).
4. Derivarea copiază răspunsul comun pe fiecare piesă, ca firma să vadă în continuare materialul pe fiecare piesă.
5. Dacă PO aprobă: în modul „Am deja un proiect” materialul și deschiderea devin opționale (o regulă în engine, ca la dimensiuni, fără versiune nouă).
6. Actualizez testul e2e care parcurge toate camerele ecran cu ecran.

**Unde în cod**

- packages/shared/src/questionnaire/flows/per-piece.ts:17 — comentariul deciziei: doua intrebari pe ecrane separate (piece:X si piece:X:systems)
- packages/shared/src/questionnaire/flows/per-piece.ts:54 — ecranul separat pentru deschidere
- packages/shared/src/questionnaire/flows/kitchen.v3.ts:60 — modelul bun: separateFrontMaterials (un material pentru toata bucataria, implicit)
- packages/shared/src/questionnaire/engine.ts:164 — modul „proiect propriu” sare doar peste dimensiuni
- docs/implementation/form-redesign-2026-11-10.md:9 — DECIZIE NECESARA deschisa: material + deschidere pe un ecran
- apps/frontend/src/stores/configurator-store.ts:79 — ciorna tine numarul ecranului (de aceea regruparea cere versiune noua)

**Cum se verifică**

- Test în engine: dormitor cu 6 piese → numărul de ecrane scade de la 20 la cel mult 10; cu „același material” → un singur ecran de material.
- Test de derivare: „același material” → toate piesele au același material și aceeași deschidere.
- Test e2e actualizat care parcurge toate camerele.

**Documente de adus la zi**

- archive/12-feedback-po-formulare-sprints.md S2 (contrazice): PO a cerut pe 2026-07-13 material și deschidere pe ecrane separate; unirea lor schimbă decizia (e deja DECIZIE NECESARA nr. 1 în form-redesign).
- CHANGELOG.md OWN_PROJECT (2026-07-31) (contrazice): Regula scrisă: în modul „Am deja un proiect” doar dimensiunile și schițele sunt sărite, restul rămân obligatorii.

**Legături**

- nr. 28 (`c1`): Dacă se adaugă întrebarea de corp, ecranul piesei are 3 întrebări.
- nr. 27 (`c2`): Deschiderea dispare la piesele fără fronturi, deci ecranul comun e mai scurt.
- nr. 24 (`c3`): Ecranul dulapului din dormitor se regrupează în aceeași versiune.
- nr. 40 (`j1`): Ecranele lungi pe telefon (altă grupă) se rezolvă cu aceeași regrupare.

**Întrebări și răspunsuri**

- **[c14-1] Punem materialul și deschiderea aceleiași piese pe un singur ecran?**
  - Context: Pe 2026-07-13 ai cerut ecrane separate; azi dormitorul cu toate piesele ajunge la 20 de ecrane. Asta e și decizia deschisă din propunerea de redesign.
  - Variante: 1) Da, un ecran pe piesă · 2) Nu, rămân separate
  - **Răspunsul PO:** Da, un ecran pe piesă (recomandarea). Jumătate din ecrane; se schimbă decizia din 2026-07-13 și se notează în jurnalul de decizii.
- **[c14-2] Întrebăm „Același material și aceeași deschidere pentru toate piesele?”**
  - Context: La bucătărie există deja o astfel de bifă; în celelalte camere fiecare piesă se întreabă separat.
  - Variante: 1) Da, fără răspuns preselectat · 2) Nu
  - **Răspunsul PO:** Da, fără răspuns preselectat (recomandarea). La „Da” un singur ecran pentru toată camera; la „Nu” câte unul pe piesă.
- **[c14-3] În modul „Am deja un proiect”, materialul și deschiderea devin opționale?**
  - Context: Pe 2026-07-31 s-a hotărât că doar dimensiunile și schițele se pot sări; clientul cu proiect răspunde tot la 11 întrebări.
  - Variante: 1) Da, opționale (proiectul atașat e sursa) · 2) Nu, rămân obligatorii, cu „decide firma”
  - **Răspunsul PO:** Nu, rămân obligatorii, cu „decide firma” (altfel decât recomandarea: Da, opționale (proiectul atașat e sursa)). Firma primește mereu un răspuns pe fișă, dar clientul cu proiect repetă ce e deja în proiect.

