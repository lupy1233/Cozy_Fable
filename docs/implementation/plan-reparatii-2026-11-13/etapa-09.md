# Etapa 9 — 3D, notificări, portofel și ciorne vechi

Locurile 44–48. Sertare cu înălțime firească, e-mailuri la evenimentele care azi tac, istoric în portofel, urme la clarificări, ciorne vechi curățate.

- Mărime: 15,75 zile de lucru
- Module atinse: backend/billing, backend/chat, backend/claims, backend/companies, backend/fulfillment, backend/marketplace, backend/notifications, backend/prisma-seed, backend/quotes, backend/requests, backend/storage, frontend/configurator, frontend/configurator-3d, frontend/dashboard, frontend/marketplace-claims, frontend/requests, frontend/wallet, shared/piece3d
- Tabele atinse: attachments, claim_slots, clarification_requests, company_credit_wallets, company_locations, company_members, credit_transactions, domain_event_outbox, mock_billing_orders, notifications, quote_versions, quotes, request_contact_preferences, request_versions, requests, subscriptions, users
- Presupuneri: Durata de păstrare a ciornelor o hotărăști tu (nr. 48); jobul șterge și fișierele lor.
- Gata când: Clientul primește e-mail la publicare, iar firma află când apare o cerere nouă în zona ei. Firma vede fiecare mișcare de credite în portofel.

## 44. Configuratorul 3D: încadrare, sertare prea mari, limite discutabile (`l1`, P2)

- Mărime: 4 zile · risc mediu
- De ce contează: Camera nu se reîncadrează la dimensiuni mari. Sertarele cresc odată cu piesa, până la 60 cm și peste. Ordinea tipurilor de zonă diferă între piese. La masă apar combinații fără sens.
- Cauza: Camera 3D se fixează la prima afișare și nu se mai potrivește când piesa crește. Zona de sertare împarte înălțimea în mod egal cu restul zonelor, deci sertarele cresc odată cu dulapul. Ordinea butoanelor de tip de zonă vine din lista fiecărei piese, care servește și ca tip implicit pentru zona nouă.
- Ce s-a văzut în cod: Camera 3D se încadrează o singură dată, la deschidere, și apoi intenționat nu se mai mută (poziția „aparține” clientului). La dimensiuni mari se măresc doar limitele de zoom. Sertarele au minim 15 cm pe front, dar niciun maxim. Specificația aprobată (docs/archive/10) spune coloane de „max ~90 cm”, codul permite 100 cm. Masa rotundă acceptă 70–180 cm la orice tip (inclusiv măsuța de cafea).
- **După răspunsurile PO (2026-11-13):** Frontul de sertar are cel mult 50 cm; când zona e mai înaltă, zona se strânge.
- Risc: Ciornele cu sertare foarte înalte sau coloane de 100 cm se schimbă la redeschidere. Cererile deja publicate nu se schimbă, dar trebuie să rămână valide la editare.

**Pași**

1. Reîncadrez camera automat când piesa nu mai încape în cadru (sau crește peste ~20%), plus un buton mic „Reîncadrează”. Orbita clientului rămâne cât piesa încape.
2. Pun o înălțime maximă pe frontul de sertar (valoarea aleasă de PO). Zona de sertare se blochează implicit la „n × înălțimea frontului”, iar restul înălțimii merge la zonele vecine.
3. Afișez tipurile de zonă mereu în ordinea Deschis · Sertare · Ușă și țin tipul implicit al zonei noi separat, ca azi.
4. Aplic limitele aprobate de PO (lățimea coloanei la bibliotecă, înălțimea minimă la comoda TV), cu mesajul de motiv de la b7.
5. La masă: interval de diametru pe tip (cafea, dining, consolă), avertisment când persoanele nu încap la lățimea aleasă, iar trecerea la rotund/extensibil nu mai mută tacit adâncimea pe maxim.
6. Pe desktop lărgesc scena 3D (coloana de comenzi rămâne 330 px, scena mai înaltă). Teste unitare pentru noile reguli și verificare vizuală pe GPU la dulap 600 × 280 × 80.

**Unde în cod**

- apps/frontend/src/components/configurator/piece3d/stable-orbit-camera.tsx:22-57 — încadrarea se face doar la prima afișare; la schimbarea gabaritului se lărgește doar zoomul
- packages/shared/src/questionnaire/piece3d/config.ts:96-102 și 469-490 — sertare: doar minim 15 cm pe front; înălțimea zonei se împarte egal
- packages/shared/src/questionnaire/piece3d/config.ts:243-317 — ordinea tipurilor de zonă diferă pe piese (Deschis/Sertare/Ușă, Ușă/Sertare/Deschis, Sertare/Ușă/Deschis…)
- packages/shared/src/questionnaire/piece3d/config.ts:345-347 — lățimea maximă a coloanei e 100 cm (specificația spunea ~90 cm)
- packages/shared/src/questionnaire/piece3d/furniture-config.ts:9,85-90 — „Extensibilă” e o formă, nu o opțiune separată; diametrul rotund 70–180 cm la orice tip de masă
- apps/frontend/src/components/configurator/piece3d/configurator3d-step.tsx:1043-1061 — scena are 500 px înălțime și coloana de comenzi 330 px

**Cum se verifică**

- Dulap 600 × 280 × 80 și bibliotecă 400 × 280 × 50: piesa încape în cadru după schimbare (captură pe GPU).
- Dulap 280 cm: frontul de sertar nu trece de maxim.
- Masa de cafea rotundă nu acceptă 180 cm; 6 persoane la 120 cm arată avertisment.
- Cererile vechi cu „EXTENDABLE” și cu coloane de 100 cm trec validarea.

**Legături**

- nr. 23 (`b7`): Regulile noi trebuie explicate și reversibile la fel ca cele existente.
- nr. 43 (`d2`): Configurațiile implicite se schimbă în același fișier.
- nr. 40 (`j1`): Scena 3D se reașază și pe telefon (lipită sus); încadrarea trebuie să țină cont de noua înălțime.

**Întrebări și răspunsuri**

- **[l1-1] Ce înălțime maximă are un front de sertar și ce facem când zona e mai mare?**
  - Context: Azi la dulapul de 280 cm ies 2 sertare de ~67 cm, ceea ce nu există în realitate. Regula PO are doar minim 15 cm.
  - Variante: 1) Maxim 30 cm, zona se strânge · 2) Maxim 30 cm, cresc sertarele
  - **Răspunsul PO (altceva):** „maxim 50 de cm zona se strange”
- **[l1-2] Strângem limitele discutabile din configurator?**
  - Context: Coloana de bibliotecă poate avea 100 cm (polița de PAL se curbează peste ~80 cm; specificația aprobată spunea ~90 cm). Comoda TV poate avea 25 cm înălțime (abia încape un sertar).
  - Variante: 1) Bibliotecă 80 cm, comodă TV min. 35 cm · 2) Doar avertisment · 3) Rămân ca azi
  - **Răspunsul PO:** Bibliotecă 80 cm, comodă TV min. 35 cm (recomandarea). Clientul nu mai poate cere piese greu de făcut; ciornele în afara limitelor se ajustează cu mesaj.
- **[l1-3] La masă, „extensibilă” devine o opțiune separată de formă (da/nu)?**
  - Context: Azi forma e Dreptunghiulară / Rotundă / Extensibilă, așa că nu se poate cere o masă rotundă extensibilă.
  - Variante: 1) Da, separat, doar la dreptunghiulară · 2) Da, și la rotundă · 3) Rămâne ca azi
  - **Răspunsul PO:** Da, separat, doar la dreptunghiulară (recomandarea). Extensibil devine opțiune pentru masa dreptunghiulară de dining, iar formele rămân două. Cererile vechi rămân valide.

## 45. Evenimente fără e-mail sau notificare (`g1`, P2)

- Mărime: 3 zile · risc mediu
- De ce contează: Niciun e-mail la publicare, nicio veste când apare o cerere nouă în zona firmei. Clientul primește notificări despre propriile acțiuni. E-mailurile firmei pleacă la toți membrii, și la cei care nu lucrează la cerere.
- Cauza: Lista evenimentelor cu e-mail a fost construită pe rând și nu include publicarea, cererea nouă în zonă, finalizarea sau recenzia. Destinatarii sunt calculați ca „toată firma plus clientul”, fără să se scoată cel care a făcut acțiunea și fără să se țină cont de responsabilul cererii.
- Ce s-a văzut în cod: Publicarea nu trimite nimic; nu există niciun anunț pentru firme când apare o cerere nouă în zonă. „Mesaj nou” către firmă și „Oferta ta a fost acceptată” pleacă la toți membrii firmei. Clientul primește în clopoțel propriul mesaj și propria acceptare, pentru că e trecut printre destinatari. Pe lângă cele din audit: întrebarea firmei, răspunsul clientului și editarea după preluare nu au deloc eveniment (vezi e3), iar finalizarea și recenzia ajung la firmă doar în clopoțel.
- Risc: Anunțurile de cereri noi pot trimite multe e-mailuri dintr-odată și pot ajunge în spam dacă nu au limită sau rezumat.

**Pași**

1. La trimiterea în clopoțel și pe e-mail scot din destinatari persoana care a făcut acțiunea (mesajul propriu, acceptarea proprie).
2. Pentru evenimentele unei preluări (mesaj nou, ofertă acceptată, clarificare, editare, finalizare, recenzie), e-mailul merge la responsabilul preluării + proprietar/manager, după decizia PO; ceilalți au doar clopoțel.
3. E-mail nou către client la publicare: „Cererea ta e publicată”, cu legătura spre cerere și data expirării.
4. Anunț pentru firme despre cereri noi în zona lor, după decizia PO, trimis doar după ce cererea le devine vizibilă conform planului (întârzierea de 0/30/60 minute).
5. Adaug în lista cu e-mail finalizarea și recenzia către firmă; legăturile din e-mail duc la conversația / fișa exactă, nu la pagina generală de mesaje.
6. Actualizez contractul de evenimente și textele de e-mail RO/EN.

**Unde în cod**

- apps/backend/src/modules/notifications/notification-emails.service.ts:19 — lista evenimentelor care trimit e-mail (fără publicare, finalizare, recenzie)
- apps/backend/src/modules/notifications/notification-emails.service.ts:303 — „Mesaj nou” de la client merge la toți membrii firmei; :310 acceptarea merge la toți membrii
- apps/backend/src/modules/requests/requests.service.ts:360 — la publicare se trimite doar semnalul public de reîmprospătare
- apps/backend/src/modules/chat/chat.service.ts:122 — destinatarii unui mesaj = toți membrii + clientul, inclusiv cel care a scris
- apps/backend/src/modules/quotes/quotes.service.ts:816 — acceptarea anunță și clientul care tocmai a acceptat
- apps/backend/src/modules/fulfillment/fulfillment.service.ts:220 — finalizarea anunță toți membrii, doar în clopoțel

**Cum se verifică**

- Teste pe calculul destinatarilor: cine scrie / acceptă nu primește; la firmă primesc doar responsabilul și proprietarul/managerul.
- Test: anunțul de cerere nouă nu pleacă înainte de întârzierea planului și nu ajunge la firme în afara razei.
- Verific pe local în Mailpit un ciclu complet: publicare, preluare, mesaj, acceptare, finalizare, recenzie.

**Legături**

- nr. 8 (`a5`): E-mailul către responsabil cere ca cel care preia să devină responsabil.
- nr. 19 (`a4`): Refuzul ofertei și cererea de modificare propuse acolo intră în aceeași listă de e-mailuri.
- nr. 47 (`e3`): Clarificarea și editarea după preluare primesc evenimente noi în același loc.
- nr. 34 (`e4`): Anunțul către client la renunțarea firmei.
- nr. 35 (`f4`): Legăturile din e-mail trebuie să meargă și fără sesiune deschisă.
- nr. 30 (`a7`): Mesajele la preluare și retragere se refac în paralel.

**Întrebări și răspunsuri**

- **[g1-1] Cine din firmă primește e-mail pentru o cerere preluată (mesaj nou, ofertă acceptată etc.)?**
  - Context: Azi primesc toți membrii firmei, inclusiv angajații care nu lucrează la acea cerere. În clopoțel pot rămâne toți.
  - Variante: 1) Responsabilul cererii + proprietarul și managerii · 2) Doar responsabilul cererii · 3) Toți membrii, ca azi
  - **Răspunsul PO:** Responsabilul cererii + proprietarul și managerii (recomandarea). Mai puține e-mailuri inutile; conducerea vede tot.
- **[g1-2] Cum află firmele că a apărut o cerere nouă în zona lor?**
  - Context: Azi nu află deloc până nu intră în marketplace. Firmele pe plan mai mic văd cererile cu întârziere (30 sau 60 de minute).
  - Variante: 1) Un e-mail rezumat pe zi cu cererile noi din zonă · 2) Clopoțel imediat ce cererea le devine vizibilă, plus rezumatul zilnic pe e-mail · 3) E-mail imediat pentru fiecare cerere nouă
  - **Răspunsul PO:** Clopoțel imediat ce cererea le devine vizibilă, plus rezumatul zilnic pe e-mail (recomandarea). Reacție rapidă în aplicație fără să inunde e-mailul; puțin mai mult de lucru (+0,5 zile).

## 46. Portofelul nu are istoric, iar comanda în așteptare nu se poate anula (`h3`, P2)

- Mărime: 3 zile · risc mic
- De ce contează: Firma nu vede mișcările de credite și nu-și poate explica creditele de probă. Panoul adună oferte în lei și în euro în aceeași sumă.
- Cauza: Portofelul arată doar soldul, deși fiecare mișcare de credite e salvată; nu s-a construit pagina de istoric. Anularea comenzii există doar în consola de admin, iar suma ofertelor de pe panou adună numerele direct, indiferent de monedă.
- Ce s-a văzut în cod: Registrul mișcărilor de credite există în baza de date, dar nu are nicio pagină și nicio cale prin care firma să-l citească. Doar adminul poate anula o comandă. Panoul firmei adună prețurile ofertelor fără să țină cont de monedă (lei și euro în aceeași sumă).
- Risc: Mișcările vechi au motive scrise liber; unele pot apărea ca „Altă mișcare” până le traducem pe toate.

**Pași**

1. Endpoint nou pentru firmă cu mișcările de credite (paginate, cele mai noi primele) și fila „Istoric” în portofel: dată, ce s-a întâmplat (preluare, decontare, restituire, cumpărare, bonus de probă), cererea legată, soldul după fiecare.
2. Datele demo scriu și mișcarea pentru soldul inițial, ca istoricul să ajungă la sold.
3. „Anulează comanda” pentru proprietar/manager cât comanda e în așteptare și nemarcată „Am plătit”, cu confirmare; refolosește anularea existentă.
4. Lângă sumă afișez până când e valabilă comanda (din setarea de anulare automată, dacă e pornită).
5. Pe panou, valoarea ofertelor se calculează separat pe monede sau convertită, după decizia PO.
6. Texte RO/EN pentru istoric și anulare.

**Unde în cod**

- apps/frontend/src/app/[locale]/marketplace/wallet/_components/credit-wallet-section.tsx:39 — doar Disponibile / Rezervate / Total, fără istoric
- apps/backend/prisma/schema.prisma:1007 — registrul mișcărilor de credite (tip, sumă, motiv, preluare, dată)
- apps/backend/src/modules/billing/billing.controller.ts:23 — firma poate citi soldul, nu și mișcările
- apps/backend/src/modules/billing/payments.controller.ts:189 — anularea comenzii e doar pentru admin
- apps/backend/src/modules/companies/companies.service.ts:171 — suma ofertelor adună prețuri în lei și în euro laolaltă

**Cum se verifică**

- Test backend: istoricul arată doar mișcările firmei proprii, iar soldul calculat la sfârșit egalează soldul portofelului pe datele demo.
- Test backend: firma poate anula doar comanda proprie, în așteptare și nemarcată „Am plătit”.

**Legături**

- nr. 5 (`h2`): Aceeași pagină de portofel.
- nr. 37 (`g4`): Comanda în așteptare și proforma ei sunt pe același ecran.
- nr. 21 (`d3`): Istoricul arată costul în credite al preluărilor, reparat la d3.

**Alegeri mărunte făcute fără PO (se pot schimba)**

- Cum arată pe panoul firmei valoarea ofertelor când unele sunt în lei și altele în euro? → Două totaluri separate: „X lei + Y EUR”. Exact, fără curs; puțin mai lung pe ecran.

## 47. Clarificarea și editarea după preluare nu lasă urme (`e3`, P2)

- Mărime: 2,5 zile · risc mic
- De ce contează: Întrebarea firmei și răspunsul dispar la client. Pauza de clarificare poate muta termenul firmei după expirarea cererii. Editarea după preluare nu anunță firma și nu arată ce s-a schimbat.
- Cauza: La întrebarea firmei și la răspunsul clientului nu pleacă niciun mesaj, iar pagina clientului arată doar întrebările fără răspuns. La editarea după preluare se salvează o versiune nouă a cererii, dar nimeni nu e anunțat și firma nu vede ce s-a schimbat.
- Ce s-a văzut în cod (altfel decât în audit): Termenul firmei mutat după data de expirare nu are niciun efect, pentru că o cerere preluată nu mai expiră; doar eticheta „Expiră” induce în eroare și se repară la nr. 22. Restul e ca în audit, iar regulile de produs cer deja ca firma să fie anunțată la editare.
- Risc: Comparația dintre versiuni poate arăta diferențe false dacă formatul copiei s-a schimbat între versiuni de flux.

**Pași**

1. Evenimente noi pentru întrebarea firmei (către client: clopoțel + e-mail) și pentru răspuns (către responsabil + proprietar/manager: clopoțel + e-mail), scrise prin outbox ca restul.
2. Pe pagina clientului afișez și întrebările cu răspuns (istoric „Întrebare / Răspunsul tău”), nu doar pe cele în așteptare.
3. La editarea după preluare: eveniment către firmele cu preluare activă (clopoțel + e-mail) cu legătură spre fișă.
4. Pe fișa firmei: caseta „Cererea a fost modificată pe … — ce s-a schimbat”, calculată din ultimele două copii salvate ale cererii (câmpurile generale și camerele adăugate / scoase / modificate).
5. Salvarea editării după preluare cere confirmare cu textul despre efectul asupra firmelor (dialog în aplicație, nu fereastra browserului).
6. Texte RO/EN pentru e-mailuri, clopoțel și caseta de modificări; actualizez contractul de evenimente.

**Unde în cod**

- apps/backend/src/modules/claims/clarifications.service.ts:58 — întrebarea se salvează și termenul se mută, fără niciun mesaj către client
- apps/backend/src/modules/claims/clarifications.service.ts:104 — răspunsul se salvează fără niciun mesaj către firmă
- apps/frontend/src/app/[locale]/_components/client-clarifications.tsx:15 — clientul vede doar întrebările fără răspuns; după răspuns blocul dispare
- apps/backend/src/modules/requests/requests.service.ts:443 — editarea trimite doar semnalul public de reîmprospătare, fără firmele care au preluat
- apps/backend/src/modules/requests/requests.service.ts:1226 — fiecare publicare / editare salvează o copie completă a cererii (din care se poate calcula „ce s-a schimbat”)
- apps/backend/src/modules/requests/request-expiration.processor.ts:34 — doar cererile fără preluare expiră

**Cum se verifică**

- Teste backend: întrebarea și răspunsul scriu câte un eveniment cu destinatarii corecți; editarea după preluare anunță doar firmele cu preluare activă.
- Test pentru calculul „ce s-a schimbat” pe două copii cu material diferit.

**Legături**

- nr. 45 (`g1`): Aceeași listă de evenimente cu e-mail și aceeași regulă despre cine din firmă primește.
- nr. 18 (`b8`): Același ecran de editare a cererii publicate.
- nr. 22 (`e1`): Ascunderea „Expiră” după preluare închide partea cu termenul.
- nr. 8 (`a5`): Răspunsul ajunge la responsabil, care trebuie să existe sigur.

## 48. Ciornele anonime nu se șterg niciodată; cererea expirată nu se poate edita (`f6`, P2)

- Mărime: 3,25 zile · risc mediu
- De ce contează: Fiecare vizită pe formular fără ciornă salvată creează una, cu fișierele ei. Nu există curățare. O cerere expirată se poate doar republica identic.
- Cauza: Fiecare vizită pe formular fără ciornă în browser creează una nouă în baza de date și nimic nu le șterge vreodată, nici fișierele încărcate pe ele. O cerere expirată poate fi doar republicată exact cum era, pentru că editarea e permisă numai cât cererea e în piață.
- Ce s-a văzut în cod: Pe lângă audit: ruta de creare a ciornelor nu are limită de frecvență proprie, iar ciorna ștearsă la „Începe o cerere nouă” rămâne în baza de date (doar marcată ștearsă) cu fișierele ei.
- **După răspunsurile PO (2026-11-13):** Ciornele vizitatorilor se șterg după 7 zile, ale clienților cu cont după 90. Cele aproximativ 70 de ciorne de test de pe producție se șterg acum: scriu un script care întâi le listează și face copie, apoi le șterge; îl pornesc doar după ce vezi lista și spui „da”.
- Risc: Un job de ștergere greșit filtrat poate șterge ciorne la care omul încă lucrează sau fișiere ale cererilor publicate.

**Pași**

1. Job BullMQ zilnic (03:30 ora României, ca celelalte joburi repetate) care șterge ciornele DRAFT neatinse de N zile (după updated_at): mai întâi fișierele din storage, apoi rândurile din attachments, apoi ciorna.
2. Același job curăță și ciornele deja marcate șterse și fișierele lor rămase.
3. Pun @Throttle pe crearea ciornelor (ex. 10 pe minut pe IP).
4. Pentru cererea expirată: „Republică cu modificări” deschide formularul precompletat; la salvare se aplică modificările și se republică într-un singur pas (aceeași tranzacție, aceeași regulă „o singură dată”).
5. Pe pagina cererii expirate scot mesajul irelevant „Preluările active ale firmelor vor fi anulate” la ștergere.
6. Notez regula de păstrare în 03 §4.1 și §4.21 și ce se întâmplă la republicare în §4.4.

**Unde în cod**

- apps/backend/src/modules/requests/requests.service.ts:173 — fiecare apel creează un rând DRAFT
- apps/backend/src/modules/requests/requests.controller.ts:46 — ruta de creare a ciornelor fără limită de frecvență proprie
- apps/backend/src/modules/requests/requests.service.ts:211 — singura ștergere: doar marcată ștearsă, fișierele rămân
- apps/backend/src/infra/storage/storage.service.ts:122 — ștergerea din storage există, dar nu e folosită pentru ciorne
- apps/backend/src/modules/requests/requests.service.ts:457 — republicarea doar schimbă starea, fără modificări
- apps/backend/src/modules/requests/requests.service.ts:875 — editarea e permisă doar în IN_MARKETPLACE (și după preluare), nu în EXPIRED

**Cum se verifică**

- Test backend pe job: șterge doar DRAFT mai vechi de N zile; nu atinge cererile publicate, nici ciornele recente; fișierele din storage sunt cerute la ștergere.
- Test e2e: republicare cu modificări pe EXPIRED → IN_MARKETPLACE cu datele noi; a doua încercare → REPOST_ALREADY_USED.
- Test de throttle pe crearea ciornelor.

**Legături**

- nr. 18 (`b8`): „Republică cu modificări” folosește modul de editare al formularului, care azi strică ciorna
- nr. 34 (`e4`): aceleași texte pe pagina cererii la ștergere și expirare

**Întrebări și răspunsuri**

- **[f6-1] Cât timp păstrăm o ciornă la care nimeni n-a mai lucrat?**
  - Context: Azi ciornele și pozele sau planurile încărcate pe ele rămân pentru totdeauna, inclusiv cele începute de vizitatori anonimi.
  - Variante: 1) 30 de zile · 2) 7 zile pentru vizitatori, 90 de zile pentru clienții cu cont · 3) 90 de zile pentru toate
  - **Răspunsul PO:** 7 zile pentru vizitatori, 90 de zile pentru clienții cu cont (altfel decât recomandarea: 30 de zile). Mai puține date străine păstrate, mai mult timp pentru clienții reali; puțin mai multă muncă.
- **[f6-2] Când clientul republică o cerere expirată cu modificări, asta se socotește ca una dintre cele 3 editări permise?**
  - Context: Azi cererea expirată se poate doar republica identic, o singură dată; regula de 3 editări înainte de preluare e separată.
  - Variante: 1) Nu, republicarea cu modificări e un pas separat · 2) Da, consumă o editare
  - **Răspunsul PO:** Nu, republicarea cu modificări e un pas separat (recomandarea). Clientul poate ajusta liber bugetul, termenul și mesajul o dată, apoi are tot 3 editări.
- **[f6-3] Ștergem acum de pe producție cele aproximativ 70 de ciorne de test lăsate de audit (cu „[TEST AUDIT]” în mesaj)?**
  - Context: Sunt ciorne nepublicate, nu le vede nimeni, dar ocupă loc și pot avea fișiere de test. Ștergerea pe producție o hotărăște PO.
  - Variante: 1) Da, acum, cu copie de rezervă înainte · 2) Nu acum, le lasă jobul să le șteargă la termen · 3) Le păstrăm
  - **Răspunsul PO:** Da, acum, cu copie de rezervă înainte (altfel decât recomandarea: Nu acum, le lasă jobul să le șteargă la termen). Un script care ia doar ciornele DRAFT cu „[TEST AUDIT]”, le listează întâi și apoi le șterge cu fișierele lor; îl rulezi tu sau mă lași să-l rulez.

