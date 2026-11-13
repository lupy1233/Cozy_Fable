# Etapa 10 — Formularul, a doua versiune nouă: măsuri și întrebări lipsă

Locurile 49–50. Aceleași măsuri cerute la fel în toate camerele și întrebările fără de care firma nu poate face o ofertă corectă.

- Mărime: 19,5 zile de lucru · versiune nouă de formular
- Module atinse: backend/prisma-seed, frontend/configurator, frontend/illustrations, shared/piece3d, shared/questionnaire, shared/questionnaire/flows
- Tabele atinse: project_sizing_config, request_items, request_rooms
- Presupuneri: Dacă alegi o singură rundă la „Înainte de orice”, etapa aceasta se topește în etapa 6. Ce întrebări noi intră hotărăști tu, pe grupe (nr. 49); nu adaug nimic din proprie inițiativă.
- Gata când: Un raft mic pe un balcon lung nu mai costă cât un balcon mobilat. Tavanul se cere doar când există o piesă înaltă.

## A doua parte din problema 21 (`d3`) — 1 zi

Canapeaua, fotoliul și taburetul primesc puncte pe configurație (locuri, șezlong), ca prețul preluării să urmeze mărimea piesei.

## Costul fix al versiunii noi — 3 zile

Fișierele versiunii noi, testele pe toate fluxurile, imaginile, parcurgerea celor 28 de fluxuri în browser și lansarea. Costul e același oricâte întrebări se schimbă, de aceea le strâng la un loc.

## 49. Întrebări care lipsesc pentru o ofertă corectă (`c9`, P2)

- Mărime: 8 zile · risc mediu · versiune nouă de formular
- De ce contează: Bucătărie: chiuveta, frigider încorporabil, „fără corpuri suspendate”. Dormitor: tapițeria patului, interiorul dulapului. Baie: lavoar inclus sau existent. Canapea: extensibilă, ladă, stofă. Piesa și camera întreabă lucruri diferite pentru același obiect.
- Cauza: Fiecare cameră și fiecare piesă 3D a primit doar întrebările de bază (piese, material, deschidere, lățime), fără întrebările de meserie care schimbă prețul: chiuveta și corpurile de sus la bucătărie, tapițeria patului, lavoarul la baie, aparatele la spălătorie, extensibila la canapea. Câteva răspunsuri existente (electrocasnicele, aparatele de la spălătorie) nici nu ajung în piesele trimise firmei.
- Ce s-a văzut în cod: Toate lipsurile din audit se văd în cod. Răspunsurile noi pot intra în descrierea piesei pentru firmă, fără coloane noi în baza de date.
- Risc: Formularul se lungește; dacă întrebările nu sunt opționale, crește abandonul, iar fiecare răspuns cu puncte schimbă costul în credite.

**Pași**

1. Pe baza răspunsului PO, adaug întrebările din grupele alese, toate opționale și cu „Nu știu — decide firma” (opțiunea comună din c7): bucătărie (zone de corpuri cu „fără corpuri suspendate”, chiuvetă, frigider încorporabil / independent), dormitor (stofa patului tapițat, interiorul dulapului ca la dressing, mărimi 120 × 200 și lungime 190), baie (tipul de lavoar și cine îl aduce, „Altă piesă”), spălătorie (tip de încărcare, aparate standard / altă mărime).
2. La piesele 3D adaug câmpuri noi opționale în configurație: canapea extensibilă / ladă / husă detașabilă, fotoliu rotativ / recliner, pat cu „Altă mărime” și tăblie, masă extensibilă cu lungimea deschisă; configurațiile vechi rămân valide.
3. Răspunsurile noi se scriu în descrierea piesei trimise firmei (de ex. „Chiuvetă: granit, sub blat”), iar „fără corpuri suspendate” nu mai creează piesa respectivă; nicio coloană nouă.
4. Electrocasnicele și aparatele de spălătorie, care azi apar doar în rezumat, ajung și în descrierea pieselor.
5. Randuri de scor cu 0 puncte în seed pentru valorile noi (adminul le poate regla), cu excepția celor alese de PO la întrebarea despre cost.
6. Imagini pentru opțiunile noi (acoperirea de imagini), texte ro / en, teste de motor pe fiecare cameră atinsă; aprox. 8 zile pentru setul recomandat, 13-14 zile pentru toate grupele.

**Unde în cod**

- packages/shared/src/questionnaire/flows/kitchen.v3.ts:70 și :107-110 — corpurile suspendate se creează mereu, fără variantă „fără corpuri sus”
- packages/shared/src/questionnaire/flows/kitchen.v2.ts:204-216 — electrocasnice fără chiuvetă, fără frigider încorporabil / independent; răspunsul nu ajunge în piese
- packages/shared/src/questionnaire/flows/bedroom.v2.ts:135-149 și :181-192, :236-238 — mărimi de saltea fără 120 / 190; „Pat tapițat” doar redenumește piesa
- packages/shared/src/questionnaire/flows/bathroom.v2.ts:85-163 — doar material pe piesă, fără tipul de lavoar, fără deschidere, fără „Altă piesă”
- packages/shared/src/questionnaire/flows/laundry.v2.ts:79-100 și :139 — tipul de amplasare a aparatelor nu e folosit la piese; nu se întreabă încărcarea sau mărimea aparatelor
- packages/shared/src/questionnaire/piece3d/catalog-config.ts:9-22 și furniture-config.ts:5-25 — canapea fără extensibilă / ladă / husă; pat doar 4 mărimi; bancă și hol doar „tapițat da / nu”

**Cum se verifică**

- Teste de motor: bucătărie cu „fără corpuri suspendate” nu mai are piesa și nici întrebările ei; pat 120 × 200 apare corect în descriere.
- Verific fișa firmei: răspunsurile noi apar în descrierea pieselor, în română cu diacritice.

**Documente de adus la zi**

- 03-business-rules.md §4.1 (rândul 9) și §4.5 (de actualizat): Lista câmpurilor formularului și categoriile de scor trebuie completate cu întrebările noi alese.

**Legături**

- nr. 51 (`c7`): „Nu știu — decide firma” e aceeași opțiune comună.
- nr. 28 (`c1`): Stofa patului tapițat și materialul piesei tapițate depind de seturile de material din c1; aceeași versiune nouă.
- nr. 27 (`c2`): Deschiderea la baie e plănuită la c2; „fără corpuri suspendate” ascunde și deschiderea lor.
- nr. 50 (`c5`): Înălțimea dulapului și mărimile patului sunt și măsuri (c5).
- nr. 21 (`d3`): Dacă unele răspunsuri noi primesc puncte, formula costului trebuie stabilită întâi.
- nr. 20 (`c10`): „Altă piesă” în baie și dormitor folosește același model ca la living.

**Întrebări și răspunsuri**

- **[c9-1] Ce grupe de întrebări noi intră în formular?**
  - Context: Auditul a găsit în jur de 40 de lipsuri, strânse în șase grupe: bucătărie, dormitor, baie, spălătorie, birou / debara și piesele 3D (canapea, pat, masă, comodă TV, corp suspendat, dulap).
  - Variante: 1) Doar cele care schimbă prețul · 2) Toate cele șase grupe · 3) Niciuna acum
  - **Răspunsul PO:** Doar cele care schimbă prețul (recomandarea). Bucătărie (fără corpuri sus, chiuvetă, frigider), dormitor (stofa patului, interiorul dulapului, mărimi de saltea), baie (lavoar), spălătorie (încărcare), canapea (extensibilă, ladă), pat (altă mărime), masă (extensibilă); aprox. 8 zile.
- **[c9-2] Întrebările noi sunt obligatorii sau opționale?**
  - Context: Clientul obișnuit nu știe tipul de chiuvetă sau de lavoar; o întrebare obligatorie fără ieșire îl face să aleagă la întâmplare.
  - Variante: 1) Opționale, cu „Nu știu — decide firma” · 2) Obligatorii
  - **Răspunsul PO:** Opționale, cu „Nu știu — decide firma” (recomandarea). Formularul nu blochează pe nimeni; firma vede ce a ales clientul sau că așteaptă recomandarea ei.
- **[c9-3] Răspunsurile noi schimbă costul în credite?**
  - Context: Azi costul vine din tipul camerei, mărime, piese, material și deschidere; o bucătărie primește puncte și pentru corpurile de sus pe care clientul nu le vrea.
  - Variante: 1) Doar „fără corpuri suspendate” (scade) și canapeaua extensibilă (crește); restul 0 puncte · 2) Toate primesc puncte · 3) Niciunul
  - **Răspunsul PO:** Doar „fără corpuri suspendate” (scade) și canapeaua extensibilă (crește); restul 0 puncte (recomandarea). Costul se schimbă doar unde munca se schimbă clar; adminul poate regla restul mai târziu.

## 50. Ce se măsoară diferă de la o cameră la alta (`c5`, P2)

- Mărime: 7,5 zile · risc mediu · versiune nouă de formular
- De ce contează: Living: lățime și înălțime pe piesă. Birou, dormitor, baie, hol: doar lățime. Spălătorie, balcon, cămară: nimic pe piesă. Tavanul e obligatoriu chiar și pentru un singur pat, dar lipsește la toate piesele, inclusiv la dulap. „Walk-in” cere aceleași dimensiuni ca „În L”.
- Cauza: Fiecare cameră a fost construită separat, așa că fiecare cere alte măsuri: living lățime și înălțime pe piesă, birou / dormitor / baie / hol doar lățime, spălătorie / balcon / debara doar peretele. Tavanul e obligatoriu în aproape toate camerele chiar și pentru un pat, dar lipsește la piesele înalte, iar formularul nu știe să facă un câmp de dimensiune opțional.
- Ce s-a văzut în cod: Detaliu: formularul nu are deloc câmpuri de dimensiune opționale — orice câmp afișat e obligatoriu, deci „înălțime opțională” cere o mică schimbare în motorul comun (compatibilă cu versiunile vechi).
- Risc: Schimbă mărimea proiectului (deci costul în credite) la balcon / spălătorie / debara și la camerele unde tavanul dispare; cererile vechi nu se recalculează.

**Pași**

1. Acum, fără versiune nouă (0,5 zile): subtitluri neutre care spun exact ce se cere („Lățimea fiecărei piese alese; tavanul doar dacă ai piese înalte”), eticheta „Lățimea zonei cu rafturi” la birou, ordinea câmpurilor după litere și patul / două noptiere în planșa dormitorului.
2. În motorul comun (o dată, compatibil cu versiunile vechi): un câmp de dimensiune poate fi marcat opțional, cu o valoare tipică afișată ca indiciu („de obicei 75 cm”).
3. În versiunea nouă a camerelor cu piese: tavanul apare doar când există o piesă înaltă (dulap, bibliotecă, vitrină, coloană, dulap înalt, dulap cu oglindă), ca la hol; bucătăria și dressingul rămân cum sunt.
4. În aceeași versiune: lățimea rămâne obligatorie pe fiecare piesă, înălțimea devine opțională la living și se adaugă opțional la piesele înalte din dormitor, baie și birou; la balcon, spălătorie și debara se cere lățimea fiecărei piese, iar peretele rămâne informativ (aceeași schimbare ca la d3).
5. Dressing „Walk-in” primește laturile A / B / C și planșa camerei; latura B / C la bucătărie și dressing pornește de la 0,6 m; holul primește întrebarea simplă „Hol îngust (sub 1,2 m) / generos / nu știu”.
6. Piesele 3D: „Altă mărime” la pat (lățime și lungime saltea, ca în dormitor), înălțime reglabilă la masă și băncuță (câmpuri noi opționale în configurație, cererile vechi rămân valide); teste de motor pe fiecare cameră (aprox. 7 zile în total în versiunea nouă).

**Unde în cod**

- packages/shared/src/questionnaire/engine.ts:93-104 — fiecare câmp de dimensiune afișat e obligatoriu (fără variantă opțională)
- packages/shared/src/questionnaire/flows/office.v2.ts:59-64 și bedroom.v2.ts:67-73 — tavanul se adaugă mereu, chiar doar pentru birou sau pat
- packages/shared/src/questionnaire/flows/hallway.ts:38-50 — singura cameră cu regula „tavan doar la piese înalte”
- packages/shared/src/questionnaire/flows/living.v3.ts:63-101 — lățime + înălțime obligatorii pe fiecare piesă (13 câmpuri cu toate piesele)
- packages/shared/src/questionnaire/flows/balcony.v2.ts:60-77 (la fel laundry.v2.ts:66, pantry.v2.ts:30-46) — doar peretele / balconul, nimic pe piesă
- packages/shared/src/questionnaire/flows/dressing.v3.ts:15-18 — „Walk-in” cere doar laturile A și B, ca „În L”

**Cum se verifică**

- Teste de motor: dormitor doar cu pat nu cere tavan; living cu toate piesele are doar lățimile obligatorii; walk-in cere A / B / C.
- Test de scor: balcon cu un singur raft are mărime mai mică decât balcon mobilat pe aceeași lungime.
- Parcurgere e2e a tuturor camerelor pe versiunea nouă.

**Documente de adus la zi**

- 03-business-rules.md §4.1 (rândul 9) și §4.5 (de actualizat): Formularul „cameră + dimensiuni” și mărimea proiectului din metri liniari: de scris ce se măsoară pe piesă și că peretele de la balcon / spălătorie / debara nu mai dă mărimea.

**Legături**

- nr. 21 (`d3`): d3 plănuiește exact versiunile noi pentru spălătorie, balcon și debara cu mărimea din lățimea pieselor; e aceeași muncă, numărată o singură dată.
- nr. 28 (`c1`): Aceeași versiune nouă comună (valul B, costul fix numărat la C1).
- nr. 49 (`c9`): Înălțimea dulapului din dormitor și mărimile patului sunt atât măsuri, cât și întrebări care lipsesc.
- nr. 41 (`c4`): Câmpurile opționale și indiciul „de obicei 75 cm” folosesc formatatorul în cm.
- nr. 44 (`l1`): Limitele noi din 3D (pat, masă, băncuță) se ating și la l1.

**Întrebări și răspunsuri**

- **[c5-1] Când cerem înălțimea tavanului?**
  - Context: Azi e obligatorie în 9 din 10 camere, chiar și pentru un singur pat sau un birou, dar lipsește la dulapul sau biblioteca comandate ca piese.
  - Variante: 1) Doar când există o piesă înaltă · 2) Mereu, ca azi · 3) Mereu, dar opțional
  - **Răspunsul PO:** Doar când există o piesă înaltă (recomandarea). Mai puține câmpuri pentru client; firma primește tavanul exact unde contează (dulap, bibliotecă, coloană).
- **[c5-2] Ce măsuri cerem pe fiecare piesă?**
  - Context: Living-ul cere lățime și înălțime pe fiecare piesă, celelalte camere doar lățimea, iar unele înălțimi (măsuță, rafturi) sunt greu de știut pentru client.
  - Variante: 1) Lățime obligatorie, înălțime opțională la piesele înalte · 2) Lățime, înălțime și adâncime obligatorii peste tot · 3) Doar lățime peste tot
  - **Răspunsul PO:** Lățime obligatorie, înălțime opțională la piesele înalte (recomandarea). Aceeași regulă peste tot; clientul care nu știe înălțimea o lasă goală și o stabilește cu firma.
- **[c5-3] La balcon, spălătorie și debară cerem lățimea fiecărei piese, pe lângă lungimea peretelui?**
  - Context: Azi firma primește doar lungimea balconului sau a peretelui și nu știe cât de lată vrea clientul fiecare piesă; tot de aici vine și costul în credite.
  - Variante: 1) Da, lățimea pieselor dă mărimea, peretele rămâne informativ · 2) Nu, rămâne doar peretele
  - **Răspunsul PO:** Da, lățimea pieselor dă mărimea, peretele rămâne informativ (recomandarea). Un raft mic pe un balcon lung nu mai costă cât un balcon mobilat; un ecran puțin mai lung.

