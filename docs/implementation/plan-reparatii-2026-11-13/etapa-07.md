# Etapa 7 — Probleme medii, mici ca efort

Locurile 30–37. Mesaje corecte la preluare, adresa completă, clientul își vede tot ce a trimis, linkurile din e-mail duc unde trebuie, conversația și PDF-urile spun când ceva nu merge.

- Mărime: 11,75 zile de lucru · schimbă baza de date
- Module atinse: backend/billing, backend/claims, backend/marketplace, backend/notifications, backend/quotes, backend/requests, frontend/admin, frontend/auth, frontend/chat, frontend/configurator, frontend/marketplace, frontend/marketplace-claims, frontend/offers, frontend/piece3d, frontend/requests, frontend/wallet, shared/company-permissions, shared/error-codes
- Tabele atinse: attachments, claim_slots, mock_billing_orders, notifications, quotes, request_contact_preferences, requests
- Presupuneri: PDF-urile (nr. 37) au dat eroare doar local; pe producție trebuie apăsate o dată înainte de orice reparație.
- Gata când: „Vezi oferta” din e-mail, deschis fără sesiune, duce la login și apoi la ofertă. Un mesaj prea lung în conversație spune de ce nu pleacă.

## 30. Mesaje greșite sau lipsă la preluare și la retragerea ofertei (`a7`, P2)

- Mărime: 1,5 zile · risc mic
- De ce contează: Angajatul fără drept de preluare vede butonul și primește un mesaj despre atribuire. Un cod de eroare nu are text. Nu apare nicio confirmare după preluare. Dialogul de retragere a ofertei contrazice fișa.
- Cauza: Butonul de preluare apare oricui, iar angajatul fără drept primește un mesaj despre atribuire, pentru că serverul folosește același cod de eroare „interzis”. Unele coduri n-au text și ies ca eroare generică, după preluare nu apare nicio confirmare, iar dialogul de retragere arată altă dată decât fișa și pomenește penalizarea ca și cum ar fi sigură.
- Ce s-a văzut în cod: Toate mesajele greșite din audit se văd în cod. Eroarea 500 de la preluare (SA-25) a venit dintr-o repornire a serverului local sub încărcare; codul a răspuns corect cu mesajul general, deci nu cere reparație. Data diferită de la retragerea ofertei: dialogul arată termenul plus cele 12 ore de grație, fișa arată termenul fără grație.
- Risc: Un cod de eroare nou trebuie adăugat în lista comună și tradus în ambele limbi, altfel cade din nou pe mesajul general.

**Pași**

1. Shared: permisiune nouă de preluare (OWNER, MANAGER, EMPLOYEE_TRUSTED) și cod de eroare nou CLAIM_ROLE_NOT_ALLOWED folosit de server pentru angajatul fără drept.
2. Panoul de preluare: pentru angajatul fără drept, butonul dezactivat cu explicația „Preluarea o face proprietarul, un manager sau un angajat cu acces complet”.
3. Texte RO/EN pentru MANAGER_UNASSIGNED_CAP_REACHED și CLAIM_ROLE_NOT_ALLOWED; după preluare, fișa de lucru arată un mesaj de reușită o dată; subtitlul „apar după preluare” dispare când firma a preluat deja.
4. Dialogul de retragere a ofertei: aceeași dată ca fișa, cu grația explicată separat („termenul e 17 nov., 23:59; mai ai 12 ore de grație”), iar penalizarea spusă la condițional („dacă nu trimiți o ofertă nouă până atunci”).
5. Panoul de preluare: un rând „Costul vine din bugetul minim estimat de client (X lei; 1 credit = Y lei)” și, după decizia PO, suma estimată în locul treptei de buget.

**Unde în cod**

- apps/backend/src/modules/claims/claims.service.ts:108-113 — angajatul fără drept de preluare primește FORBIDDEN generic
- apps/frontend/src/messages/ro.json:1509 — FORBIDDEN = „Doar proprietarul sau un manager poate atribui preluarea.”; MANAGER_UNASSIGNED_CAP_REACHED (claims.service.ts:443) nu are text
- apps/frontend/src/app/[locale]/marketplace/[id]/page.tsx:241-252 — butonul pentru toți; :179-183 — cod fără text → eroare generică; :270-273 — după preluare pagina trece la fișă fără niciun mesaj
- apps/frontend/src/messages/ro.json:1566 — „datele clientului și adresa exactă apar după preluare” rămâne și după preluare
- apps/frontend/src/app/[locale]/_components/offer-card.tsx:758-769 — dialogul de retragere: data cu grație și „Firma primește și X puncte”
- apps/frontend/src/app/[locale]/marketplace/[id]/page.tsx:100 — înainte de preluare firma vede doar treapta de buget

**Cum se verifică**

- Test de serviciu: angajatul fără acces complet primește CLAIM_ROLE_NOT_ALLOWED.
- Test de componentă: butonul dezactivat pentru acest rol; codul plafonului managerului are text în ro.json și en.json.
- Test de componentă pe dialogul de retragere: aceeași dată ca fișa, penalizarea la condițional.

**Legături**

- nr. 8 (`a5`): Același dialog și panou de preluare.
- nr. 21 (`d3`): Rândul care explică costul în credite trebuie să folosească formula reparată la d3.
- nr. 60 (`i3`): Textele despre puncte de penalizare trebuie să spună același lucru ca regulile publice.

**Întrebări și răspunsuri**

- **[a7-1] Firma vede suma estimată de client înainte să plătească preluarea?**
  - Context: Azi firma vede înainte de preluare doar treapta de buget, iar suma exactă abia după ce a plătit creditele; costul în credite se calculează chiar din această sumă.
  - Variante: 1) Da, suma estimată (nu e dată de contact) · 2) Nu, rămâne treapta; spunem doar de unde vine costul
  - **Răspunsul PO:** Da, suma estimată (nu e dată de contact) (recomandarea). Firma decide mai bine dacă merită creditele; clientul nu pierde nimic personal.

## 31. Adresa: apartamentul se pierde, orașul se repetă, 23 de țări în listă (`b12`, P2)

- Mărime: 2,5 zile · risc mic · schimbă baza de date
- De ce contează: La alegerea unei sugestii se păstrează doar strada și numărul. Sumarul scrie „București, București, RO”. Se pot alege Germania sau Finlanda, deși firmele lucrează pe rază în România.
- Cauza: La alegerea unei sugestii Google se păstrează doar strada și numărul, iar blocul, scara și apartamentul tastate dispar. Sumarul lipește la rând adresa, orașul, județul și țara fără să elimine ce se repetă; lista de țări a fost lărgită la 23 pentru livrare internațională.
- Ce s-a văzut în cod: Orașul se repetă și când adresa e aleasă din sugestii (București apare și ca județ, și ca oraș), nu doar la scriere de mână. Aceeași repetare e și pe pagina cererii.
- **După răspunsurile PO (2026-11-13):** Lista de țări rămâne, pentru că firmele lucrează și cu clienți din alte țări. Cum ajunge la firme o cerere din altă țară alegi la întrebarea nouă; provizoriu am socotit varianta recomandată (o zi și jumătate, o schimbare mică în baza de date).
- Risc: Cererile publicate au adresa salvată deja; doar afișarea se schimbă pentru ele.

**Pași**

1. Câmp separat opțional „Bloc, scară, apartament” sub adresă, care nu se șterge la alegerea unei sugestii și se adaugă la adresa salvată (geocodarea curăță deja aceste fragmente).
2. O singură funcție care compune adresa pentru afișare și scoate dublurile (oraș = județ, oraș deja în adresă), iar țara apare doar când nu e România; folosită în Sumar, pe pagina cererii și la firmă.
3. Lista de țări după decizia PO (variantă recomandată: doar România, fără selector).
4. Orașul format doar din spații primește „Completează orașul” (din b9).

**Unde în cod**

- apps/frontend/src/components/configurator/address-autocomplete.tsx:54 — din sugestie se păstrează doar strada + numărul
- apps/frontend/src/components/configurator/address-autocomplete.tsx:112 — la alegere, textul tastat e înlocuit
- apps/frontend/src/components/configurator/review-facts-card.tsx:56 — adresă + oraș + județ + țară lipite fără eliminarea dublurilor
- apps/frontend/src/app/[locale]/requests/[id]/page.tsx:184 — aceeași lipire pe pagina cererii
- apps/frontend/src/components/configurator/details-step.tsx:44 — lista de 23 de țări

**Cum se verifică**

- Test pe compunerea adresei: București / București, oraș deja în adresă, țară străină.
- Test pe câmpul de adresă: alegerea unei sugestii păstrează apartamentul.

**Documente de adus la zi**

- 04-data-model.md requests.country (contrazice): Documentul scrie „livrare internațională, F5 2026-07-08”; dacă lista se reduce la România, nota trebuie schimbată (coloana rămâne).

**Legături**

- nr. 39 (`b9`): Mesajele pentru câmpurile de adresă goale sunt în același formular.
- nr. 9 (`b2`): Câmpul nou trebuie să supraviețuiască la Înapoi / reîncărcare.
- nr. 32 (`d5`): Adresa compusă se afișează și pe pagina cererii.

**Întrebări și răspunsuri**

- **[b12-1] Din ce țări poate fi adresa de montaj?**
  - Context: Azi se pot alege 23 de țări (decizie din iulie, „livrăm și internațional”), dar firmele lucrează pe rază în kilometri în jurul sediului din România.
  - Variante: 1) Doar România, fără selector · 2) România și Republica Moldova · 3) Rămân cele 23
  - **Răspunsul PO (altceva):** „exista firme care lucreaza cu clienti si din alte tari, si invers clienti care cauta firme romanesti pentru un montaj in afara tarii”

## 32. Clientul nu-și vede în pagina cererii tot ce a completat (`d5`, P2)

- Mărime: 2 zile · risc mic
- De ce contează: Lipsesc contactele transmise firmelor, suma bugetului și opțiunile de proiect. Nu i se spune limpede că firma îi vede deja datele. Ciornele nu apar în „Cererile mele”.
- Cauza: Pagina cererii arată doar treapta de buget, termenul, adresa și data de expirare, deși are toate datele trimise de client. Lista „Cererile mele” exclude ciornele, iar numărul de firme nu socotește firma câștigătoare după încheiere.
- Ce s-a văzut în cod: Datele (contacte, suma, opțiunile de proiect) vin deja de la server pe pagina cererii; lipsesc doar din afișare. „Nicio firmă” la cererile finalizate vine din numărarea doar a firmelor cu preluare activă.
- Risc: Fila de ciorne adaugă un drum nou de deschidere a ciornei (fără cheia din browser), care trebuie să verifice că ciorna e a contului.

**Pași**

1. Pe pagina cererii, fișa reia rândurile din Sumar (fără butonul de editare): suma aleasă, termen, adresă, contactele trimise firmelor și un rând „Cum pornești” (proiect propriu / proiectare cu plată / ajutor la planificare), un singur rând în loc de trei, și în Sumar.
2. În „Cine vede cererea”, după preluare: „Firma X îți vede numele, contactele alese și adresa completă” (lista exactă după regulile de vizibilitate).
3. Numărul de firme din „Cererile mele” socotește și firma câștigătoare a unei cereri finalizate.
4. Ciornele în „Cererile mele”, după decizia PO: fila „Ciorne” cu „Continuă” și „Șterge”, doar pentru ciornele legate de cont (ciornele anonime se leagă la autentificare).

**Unde în cod**

- apps/frontend/src/app/[locale]/requests/[id]/page.tsx:179 — doar treapta de buget, termen, adresă și expirare
- apps/frontend/src/app/[locale]/requests/[id]/page.tsx:230 — „Cine vede cererea” nu spune ce date vede firma
- apps/frontend/src/components/configurator/review-facts-card.tsx:62 — „Am proiectul propriu”, „Proiectare cu plată” și „Ajutor pentru planificare” pe rânduri separate, repetate
- apps/backend/src/modules/requests/requests.service.ts:503 — lista clientului exclude ciornele
- apps/backend/src/modules/requests/requests.service.ts:524 — firmele numărate doar cu preluare activă / ofertă trimisă

**Cum se verifică**

- Test pe pagina cererii: toate rândurile din Sumar sunt prezente, inclusiv contactele.
- Test pe server: lista clientului cu ciorne doar ale lui; numărul de firme la cererea finalizată.
- Test pe Sumar: un singur rând „Cum pornești”.

**Legături**

- nr. 16 (`b11`): Ce sumă se arată ca buget depinde de decizia despre buget.
- nr. 31 (`b12`): Adresa compusă fără dubluri e aceeași funcție.
- nr. 22 (`e1`): Contactele și vizibilitatea după acceptare sunt pe aceeași pagină.
- nr. 48 (`f6`): Ștergerea ciornelor și ciornele anonime care nu se șterg niciodată.
- nr. 18 (`b8`): Continuarea unei ciorne din listă nu trebuie să strice ciorna curentă la schimbarea modului.

**Întrebări și răspunsuri**

- **[d5-1] Vrei o filă „Ciorne” în „Cererile mele”?**
  - Context: Azi ciornele nu apar nicăieri în cont; singurul loc e dialogul „Ai o cerere începută” din formular, în același browser.
  - Variante: 1) Da, cu „Continuă” și „Șterge”, pentru ciornele legate de cont · 2) Doar un anunț „Ai o ciornă — continuă” · 3) Nu acum
  - **Răspunsul PO:** Da, cu „Continuă” și „Șterge”, pentru ciornele legate de cont (recomandarea). Clientul își reia ciorna de pe orice dispozitiv; cam o zi de lucru, cu server.

## 33. Imaginea 3D a piesei lipsește din Sumar și se poate pierde (`d4`, P2)

- Mărime: 1,5 zile · risc mediu
- De ce contează: Captura stă doar în memorie și urcă abia la publicare; după o reîncărcare a paginii nu mai există.
- Cauza: Imaginea piesei 3D se ține doar în memoria paginii și urcă abia la „Publică”; după reîncărcare sau pe alt dispozitiv nu mai există, iar cererea pleacă fără ea, în tăcere. În modul „Câmpuri clasice” imaginea nu se face deloc, iar Sumarul nu arată nicio imagine.
- Ce s-a văzut în cod: Mai e o problemă: dacă o publicare eșuează după ce imaginea a urcat, legătura rămâne salvată în răspunsuri; după o reîncărcare și o schimbare de configurație, cererea poate pleca cu imaginea veche.
- Risc: Desenarea ascunsă a scenei la Sumar depinde de placa video; pe telefoane slabe poate fi lentă sau poate eșua, de aceea rămâne doar rezervă.

**Pași**

1. Imaginea urcă imediat după ce clientul termină ecranul 3D (și din nou, cu întârziere, la fiecare schimbare), ca fișier al ciornei; legătura stă în răspunsuri, deci rezistă la reîncărcare și pe alt dispozitiv, iar fișierul vechi se șterge la înlocuire.
2. La Sumar, dacă o piesă configurată nu are imagine sau imaginea e mai veche decât configurația (inclusiv în modul „Câmpuri clasice”), scena se desenează ascuns din configurație și se face imaginea.
3. Miniatura în cardul piesei din Sumar (după decizia PO).
4. Dacă tot nu se poate face imaginea, Sumarul spune asta; publicarea nu se blochează.

**Unde în cod**

- apps/frontend/src/stores/configurator-store.ts:103 — imaginile 3D doar în memorie; :585 nu sunt salvate cu ciorna
- apps/frontend/src/components/configurator/review-step.tsx:188 — urcarea abia la publicare, eșecul ignorat; :199 legătura rămâne în răspunsuri
- apps/frontend/src/components/configurator/piece3d/configurator3d-step.tsx:367 — imaginea se face doar în modul 3D
- apps/frontend/src/components/configurator/review-room-card.tsx:76 — cardul din Sumar fără imagine

**Cum se verifică**

- Test pe ciornă: imaginea urcată rezistă la reîncărcare; schimbarea configurației înlocuiește imaginea și șterge fișierul vechi.
- Test pe Sumar: piesă fără imagine → imagine generată sau mesaj.
- Verificare manuală în browser pe placa video (GTX 1070) că imaginea iese corect.

**Documente de adus la zi**

- archive/10-tylko-3d-configurator-sprints.md D-3D-4 (contrazice): Decizia: imaginea e „automată și invizibilă pentru client”; afișarea ei în Sumar schimbă partea „invizibilă”.

**Legături**

- nr. 11 (`b4`): Clientul nou care revine din e-mailul de confirmare e cazul tipic în care imaginea se pierde.
- nr. 2 (`b5`): Urcarea imaginii folosește același drum de fișiere unde serverul dă azi o eroare generică.
- nr. 38 (`b10`): Același card de cameră din Sumar.
- nr. 32 (`d5`): Imaginea ar trebui să apară și pe pagina cererii văzută de client.

**Întrebări și răspunsuri**

- **[d4-1] Vrei ca imaginea 3D a piesei să apară în Sumar și pe pagina cererii, pentru client?**
  - Context: Decizia din iulie spune că imaginea se face automat și e invizibilă pentru client; o primesc doar firmele.
  - Variante: 1) Da, miniatură în Sumar și pe pagina cererii · 2) Nu, rămâne invizibilă; reparăm doar pierderea
  - **Răspunsul PO:** Da, miniatură în Sumar și pe pagina cererii (recomandarea). Clientul vede exact ce primesc firmele; schimbă decizia „invizibilă”.

## 34. Ștergerea cererii și retragerea firmei: clientul și firma nu află ce urmează (`e4`, P2)

- Mărime: 1 zi · risc mic
- De ce contează: Ștergerea folosește fereastra de confirmare a browserului, fără consecințe explicate, iar oferta firmei apare apoi ca „Retrasă”. Când firma renunță la preluare, clientului i se spune „Nicio firmă încă”.
- Cauza: Confirmarea ștergerii e fereastra standard a browserului, cu un text care nu spune că e definitiv și ce pățesc ofertele și conversațiile. Când o firmă renunță la preluare, mesajul pleacă doar către ea, iar caseta clientului revine la textul de dinainte de preluare.
- Ce s-a văzut în cod: Ștergerea folosește fereastra browserului, fără mesaj de succes; ofertele firmelor primesc starea „Retrasă” la ștergere. Când firma renunță, doar membrii firmei sunt anunțați, clientul nu.
- Risc: Dacă mesajul către client pleacă și la retragerile automate (expirare termen), clientul poate primi mesaje în rafală.

**Pași**

1. Dialog de confirmare în aplicație: ștergerea e definitivă, ofertele primite se anulează, conversațiile devin doar pentru citire, firmele își primesc creditele înapoi; buton roșu „Șterge definitiv”.
2. După ștergere, mesaj de succes pe lista de cereri.
3. La firmă, oferta unei cereri șterse apare „Cererea a fost ștearsă de client”, nu „Retrasă” (doar textul afișat, starea din baza de date rămâne).
4. Când o firmă renunță, clientul primește clopoțel (și e-mail după decizia PO): „O firmă a renunțat; cererea e din nou disponibilă pentru alte firme”.
5. Caseta de contacte arată istoricul: „O firmă a avut acces la datele tale până pe …” în loc de „Nicio firmă încă”.

**Unde în cod**

- apps/frontend/src/app/[locale]/requests/[id]/page.tsx:341 — confirmarea ștergerii cu fereastra browserului, fără mesaj după
- apps/frontend/src/messages/ro.json:1103 — textul confirmării nu spune că e definitiv
- apps/backend/src/modules/requests/requests.service.ts:761 — la ștergere ofertele se marchează retrase și firmele primesc creditele înapoi
- apps/backend/src/modules/claims/withdrawals.service.ts:792 — renunțarea firmei anunță doar membrii firmei
- apps/frontend/src/messages/ro.json:1263 — „Nicio firmă încă …” afișat și după ce o firmă a văzut contactele și a renunțat

**Cum se verifică**

- Test frontend: dialogul de ștergere și mesajul de succes.
- Test backend: renunțarea firmei scrie un eveniment și către client, o singură dată.

**Legături**

- nr. 30 (`a7`): Mesajele la preluare și la retragerea ofertei se refac în același loc.
- nr. 45 (`g1`): E-mailul către client la renunțarea firmei intră în lista de evenimente cu e-mail.

**Alegeri mărunte făcute fără PO (se pot schimba)**

- Clientul primește și e-mail când o firmă renunță la cererea lui, nu doar mesaj în aplicație? → Clopoțel + e-mail. Clientul află imediat că cererea e din nou deschisă; încă un tip de e-mail.

## 35. Linkurile din e-mail fără sesiune dau erori false sau login fără întoarcere (`f4`, P2)

- Mărime: 1,5 zile · risc mediu
- De ce contează: „Vezi oferta” deschis pe telefon, fără sesiune, arată „Nu am putut încărca datele” sau duce la login și apoi pe panou, nu la ofertă. Mesajele de „nu ai acces” nu spun de ce.
- Cauza: Fiecare pagină cu cont își face singură verificarea și trimite la login fără să spună unde era omul; unele pagini nici nu verifică și arată o eroare. Mesajele de „nu ai acces” sunt aceleași ca pentru „nu există”.
- Risc: Atinge multe pagini; o pagină uitată sau un rol greșit în hook poate bloca accesul legitim.

**Pași**

1. Fac un hook comun useRequireAuth(rol opțional) care, fără sesiune, duce la /login?redirect=<cale+query curente>, iar cu rol greșit arată un ecran „Pagina e doar pentru firme / clienți / administratori”.
2. Înlocuiesc cele ~20 de router.replace('/login') cu hook-ul și îl adaug pe paginile care nu verificau deloc (requests/[id], marketplace/[id]).
3. Pe paginile de detaliu despart mesajele: 404/403 → „Cererea nu există sau nu e a ta” / „Preluarea nu există sau nu e a firmei tale”; altă eroare → reîncearcă.
4. Redirecțiile tăcute pe rol (client pe /marketplace sau /admin) arată ecranul de acces cu un buton spre Panou, nu sar fără explicație.
5. Linkul de confirmare a e-mailului și înregistrarea păstrează redirect până la capăt (prin safeRedirect din f1).

**Unde în cod**

- apps/frontend/src/app/[locale]/requests/[id]/page.tsx:86 — fără verificare de sesiune; un 401 ajunge la „Nu am putut încărca datele”
- apps/frontend/src/app/[locale]/marketplace/claims/[claimSlotId]/page.tsx:85 — router.replace('/login') fără redirect
- apps/frontend/src/app/[locale]/requests/[id]/offers/page.tsx:74 — router.replace('/login') fără redirect (linkul „Vezi oferta”)
- apps/frontend/src/app/[locale]/dashboard/page.tsx:46 — același tipar, repetat în ~20 de pagini (admin, marketplace, wallet, messages)
- apps/frontend/src/app/[locale]/marketplace/[id]/page.tsx:51 — orice eroare devine „Nicio cerere disponibilă”

**Cum se verifică**

- Test de componentă pentru useRequireAuth: fără sesiune → login cu redirect; rol greșit → ecranul de acces.
- Manual, în fereastră privată: „Vezi oferta” și „Deschide lucrarea” → login → exact pagina din link.

**Legături**

- nr. 25 (`f3`): aceeași gardă comună și același drum spre login
- nr. 14 (`f1`): întoarcerea folosește funcția sigură de redirect de la f1
- nr. 11 (`b4`): clientul nou dus înapoi la ciornă după confirmarea e-mailului folosește același redirect păstrat

## 36. Conversația nu arată nicio eroare (`g3`, P2)

- Mărime: 0,75 zile · risc mic
- De ce contează: Un mesaj prea lung, o conversație închisă sau un fișier respins: textul rămâne în câmp și nu se întâmplă nimic vizibil. „Trimite” cu mesajul gol tace și el.
- Cauza: Când trimiterea sau încărcarea eșuează, pagina nu afișează nimic, iar textul rămâne în câmp. Pe ecran nu există limită vizibilă a lungimii mesajului și nici o explicație când mesajul e gol.
- Ce s-a văzut în cod: Trimiterea și încărcarea fișierului nu prind nicio eroare; câmpul nu are limită de caractere și selectorul de fișier nu filtrează tipurile. „Trimite” cu mesajul gol iese în tăcere.
- Risc: Lista de tipuri acceptate trebuie ținută la fel ca pe server, altfel un fișier bun poate fi ascuns în selector.

**Pași**

1. Prind erorile la trimitere și la încărcare și afișez sub câmp un mesaj tradus după codul erorii (prea lung, conversație închisă, fișier respins, prea multe fișiere, eroare generală); textul rămâne în câmp.
2. Când conversația a devenit doar pentru citire, reîncarc starea ei ca să apară mesajul „doar citire” în locul câmpului.
3. Contor de caractere și limita de 5.000 pe câmp (aceeași ca pe server).
4. Butonul „Trimite” e inactiv cât mesajul e gol și nu există fișier atașat.
5. Selectorul de fișier acceptă doar tipurile permise la încărcare.
6. Texte RO/EN pentru erori.

**Unde în cod**

- apps/frontend/src/app/[locale]/_components/chat-panel.tsx:78 — mesajul gol iese fără niciun semn
- apps/frontend/src/app/[locale]/_components/chat-panel.tsx:79 — trimiterea fără tratarea erorii
- apps/frontend/src/app/[locale]/_components/chat-panel.tsx:88 — încărcarea fișierului fără tratarea erorii
- apps/frontend/src/app/[locale]/_components/chat-panel.tsx:171 — câmpul de text fără limită și fără contor; :180 selectorul de fișier fără tipuri acceptate
- apps/backend/src/modules/chat/chat.service.ts:233 — conversația doar pentru citire e refuzată cu un cod clar, pe care pagina nu-l afișează

**Cum se verifică**

- Test frontend: eroare simulată la trimitere afișează mesajul și păstrează textul; butonul e inactiv pe mesaj gol; contorul apare peste limită.

**Legături**

- nr. 2 (`b5`): Aceleași mesaje pentru fișiere respinse ca în formularul de cerere.

## 37. Documentele PDF au dat eroare local (`g4`, P2)

- Mărime: 1 zi · risc mic
- De ce contează: „Descarcă PDF” pe ofertă și „Descarcă proforma” au răspuns cu eroare 500, fără mesaj pentru om. E-mailul de transfer nu are proforma atașată, deși pagina spune că a fost trimisă. De apăsat o dată pe producție.
- Cauza: PDF-urile se fac pornind un browser Chrome din server; local acesta lipsește, deci orice PDF dă eroare, iar pe producție trebuie verificat. Ruta ofertei declară dinainte că răspunsul e PDF, așa că eroarea ajunge la client ca fișier stricat, iar textul despre e-mail promite proforma indiferent dacă a fost atașată.
- Ce s-a văzut în cod (altfel decât în audit): Descărcarea proformei are deja mesaj de eroare în cod. Oferta în PDF e un simplu link, așa că la eroare clientul primește un fișier stricat. Pe producție serverul are ce îi trebuie pentru PDF; cele două butoane trebuie totuși apăsate o dată acolo.
- Risc: Dacă pe producție Chromium lipsește sau nu are memorie, toate PDF-urile cad; asta se vede doar apăsând o dată acolo.

**Pași**

1. Pe rutele PDF ale ofertei tipul și numele fișierului se pun doar pe răspunsul reușit (ca la factură), ca eroarea să rămână eroare.
2. „Descarcă PDF” la ofertă descarcă prin aplicație (ca proforma) și arată un mesaj clar dacă nu merge.
3. Comanda ține minte dacă proforma a fost atașată la e-mail; textul de pe pagină spune „ți-am trimis proforma” doar atunci, altfel „descarc-o de aici”.
4. Când randarea PDF pică, se scrie un avertisment clar în jurnal și se anunță adminii (un clopoțel o dată pe zi).
5. Pe producție: apăs o dată „Descarcă PDF” pe o ofertă și „Descarcă proforma” pe o comandă (doar citire, fără plată) — face PO sau eu ca vizitator autentificat de PO.
6. Local: notez în docs cum se instalează Chrome-ul pentru PDF (sau calea spre Edge) ca să se poată testa.

**Unde în cod**

- apps/backend/src/modules/quotes/quotes.controller.ts:86 — tipul PDF fixat pe rută (și la :223 pentru client), deci și eroarea pleacă drept „PDF”
- apps/backend/src/modules/quotes/quote-pdf.service.ts:47 — pornește Chrome fără cale explicită (pe producție vine din variabila setată în Dockerfile)
- Dockerfile.app:82 — imaginea de producție instalează Chromium, fonturi și setează calea lui
- apps/frontend/src/app/[locale]/_components/offer-card.tsx:97 — „Descarcă PDF” e un link simplu, fără mesaj la eroare
- apps/backend/src/modules/billing/billing-documents.service.ts:54 — proforma se atașează doar dacă randarea reușește și comanda nu e de test; altfel e-mailul pleacă fără ea
- apps/frontend/src/messages/ro.json:2185 — „Ți-am trimis pe email datele de plată și factura proformă” afișat necondiționat

**Cum se verifică**

- Test backend: la eroare de randare, ruta ofertei răspunde cu eroare JSON, nu cu tip PDF.
- Test: e-mailul de transfer fără atașament marchează comanda ca „proformă netrimisă”, iar pagina afișează textul potrivit.
- Verificare pe producție a celor două butoane (o singură apăsare fiecare).

**Legături**

- nr. 46 (`h3`): Același ecran cu comanda în așteptare.

