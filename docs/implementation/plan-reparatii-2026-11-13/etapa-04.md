# Etapa 4 — Ofertele: refuz, variante și comparație

Locul 19, plus problema 29 lipită de ea. Clientul poate refuza o ofertă și vede toate variantele, iar tabelul compară ofertele în lei, cu TVA, cu termenul în aceeași unitate.

- Mărime: 9 zile de lucru · schimbă baza de date
- Module atinse: backend/chat, backend/claims, backend/credits, backend/notifications, backend/pdf, backend/quotes, frontend/landing, frontend/offers, shared/quote
- Tabele atinse: chat_messages, claim_slots, company_offer_field_permissions, credit_transactions, notifications, quote_change_requests, quote_versions, quotes
- Presupuneri: Regula creditelor la refuz o hotărăști tu; până la răspuns nu încep. Ofertele deja trimise rămân cu textul lor liber; rubricile noi se aplică ofertelor noi.
- Gata când: Două oferte, una în lei cu TVA și una în euro fără, apar în tabel pe aceeași linie de total. Refuzul lasă urmă la firmă și în conversație.

## 19. Clientul nu poate refuza o ofertă, iar variantele nu se pot compara (`a4`, P1)

- Mărime: 5 zile · risc mare · schimbă baza de date
- De ce contează: Nu există buton de refuz. Când firma trimite varianta 2, varianta 1 dispare pentru ambele părți. Cererea de modificare e un text liber pe care clientul nu-l mai vede.
- Cauza: Clientul are doar „Cere modificare” și „Acceptă”; nu există un pas de refuz, așa că firma rămâne cu locul și creditele blocate până expiră oferta. Ecranul arată doar ultima variantă, iar formularul variantei noi pornește gol și fără monedă, pentru că moneda e fixată pe toată oferta.
- Ce s-a văzut în cod (altfel decât în audit): Refuzul lipsește cu adevărat. Variantele ofertei ajung deja la client și la firmă, dar ecranul o arată doar pe ultima. Moneda ține de toată oferta, nu de variantă.
- Risc: Refuzul mută credite și închide un loc; o greșeală în tranzacție poate dubla o rambursare sau lăsa locul ocupat (aceeași zonă în care auditul vechi a găsit frauda cu dubla rambursare).

**Pași**

1. Backend: cale nouă pentru client „refuz oferta” (cu cheie de idempotență și lock pe cerere, ca la accept), motiv opțional, stare nouă a ofertei și închiderea locului firmei după regula aleasă de PO; eveniment prin outbox către firmă (clopoțel + e-mail).
2. Migrare: stare nouă în quote_status (de ex. DECLINED) și eventual o stare nouă a locului; moneda copiată pe fiecare variantă (quote_versions.currency, completată din oferta părinte) ca varianta 2 să poată fi în altă monedă.
3. Formularul variantei noi: precompletat din ultima variantă, cu alegerea monedei.
4. Cardul ofertei: lista variantelor (v1, v2…) cu diferențele de preț, termen și descriere, la client și la firmă; cererea de modificare rămâne vizibilă lângă varianta la care a răspuns.
5. Cererea de modificare apare și în conversație ca mesaj de sistem, iar firma primește e-mail; clientul primește e-mail la o variantă nouă.
6. Butonul „Refuz oferta” cu dialog (consecințe + motiv) pe pagina ofertelor; documentează regula nouă în docs/03 §4.13 și docs/07.

**Unde în cod**

- apps/backend/src/modules/quotes/quotes.controller.ts:209-256 — căile clientului: vezi, cere modificare, acceptă, cere prelungire; fără refuz
- apps/backend/prisma/schema.prisma:362-371 — stările ofertei (DRAFT, SENT, WITHDRAWN, EXPIRED, ACCEPTED, SUPERSEDED), fără „refuzată”
- apps/backend/prisma/schema.prisma:1152 — moneda e pe oferta întreagă (quotes.currency), nu pe variantă
- apps/frontend/src/app/[locale]/_components/offer-card.tsx:77, 108-124 — se afișează doar versiunea curentă; cererea de modificare doar cât e în așteptare
- apps/frontend/src/app/[locale]/_components/offer-builder.tsx:83 — formularul fără valori precompletate; offer-card.tsx:551 — varianta nouă primește moneda veche, fără alegere

**Cum se verifică**

- Teste de serviciu: refuz pe ofertă trimisă → stare nouă, loc închis, creditele după regulă, o singură mișcare chiar la două cereri simultane (cheie de idempotență).
- Test: refuz pe ofertă deja acceptată sau retrasă → 409.
- Test de componentă: istoricul v1/v2 cu diferențe; varianta 2 în altă monedă afișată corect în tabelul de comparare.

**Documente de adus la zi**

- 03-business-rules.md §4.13 Ofertă și versiuni (de actualizat): Nu există regulă pentru refuzul ofertei de către client; trebuie adăugată (ce se întâmplă cu locul și cu creditele).
- 03-business-rules.md §4.8 (creditele se consumă conform regulilor de anulare/finalizare) (de actualizat): Un rezultat nou pentru credite la refuz.
- 04-data-model.md quotes / quote_versions / claim_slot_status (de actualizat): Stare nouă a ofertei, monedă pe variantă.

**Legături**

- nr. 29 (`a3`): Aceeași migrare pe quote_versions și același formular de ofertă.
- nr. 3 (`a1`): Locul eliberat la refuz poate fi preluat de altă firmă doar dacă cererea rămâne deschisă după prima ofertă.
- nr. 45 (`g1`): E-mailurile lipsă la cererea de modificare și la varianta nouă fac parte din lista de evenimente fără notificare.
- nr. 47 (`e3`): Același mecanism de mesaj de sistem în conversație pentru clarificări și modificări.

**Întrebări și răspunsuri**

- **[a4-1] Ce se întâmplă cu firma când clientul îi refuză oferta?**
  - Context: Azi clientul nu poate refuza; firma rămâne cu locul și creditele rezervate până expiră oferta (14 zile). Regula existentă: firma care a ofertat și a pierdut nu primește creditele înapoi.
  - Variante: 1) Refuz definitiv: locul se închide, creditele se consumă, firma e anunțată · 2) Refuz definitiv, dar creditele se returnează · 3) Refuz cu drept la o ultimă ofertă
  - **Răspunsul PO:** Refuz definitiv: locul se închide, creditele se consumă, firma e anunțată (recomandarea). La fel ca „clientul a ales altă firmă”; regulă coerentă cu restul. Locul liber poate fi preluat de altă firmă dacă cererea rămâne deschisă (a1).
- **[a4-2] Motivul refuzului e obligatoriu și îl vede firma?**
  - Context: Firma nu află azi de ce pierde; un motiv ajută firmele, dar poate descuraja clientul să refuze.
  - Variante: 1) Opțional, din listă scurtă (preț, termen, altă firmă, renunț) + text liber; firma îl vede · 2) Obligatoriu · 3) Fără motiv
  - **Răspunsul PO:** Opțional, din listă scurtă (preț, termen, altă firmă, renunț) + text liber; firma îl vede (recomandarea). Clientul refuză dintr-un clic; firmele primesc semnal util când e dat.

## 29. Tabelul de comparare nu aduce ofertele la același numitor (`a3`, P1)

- Mărime: 4 zile · risc mediu · schimbă baza de date
- De ce contează: Fără rubrică de TVA, euro lângă lei fără echivalent, „6 săptămâni” lângă „30 de zile lucrătoare”, rubrici diferite de exemplul de pe prima pagină. Termenul și garanția se salvează ca text liber.
- Cauza: Oferta nu are deloc rubrică pentru TVA, transport sau montaj, iar termenul și garanția se salvează ca text liber („6 săptămâni”), deci nu se pot compara. Tabelul pune suma în euro lângă suma în lei fără echivalent și are alte rubrici decât exemplul de pe prima pagină.
- Ce s-a văzut în cod: „Cel mai mic” se calculează corect în lei, dar celula afișează suma în moneda ofertei, fără echivalent. Formularul are deja număr + unitate pentru termen și garanție, însă le lipește într-un text înainte de trimitere.
- Mutată față de ordinea PO: Era pe locul 29. O lipesc de nr. 19, pentru că amândouă schimbă aceeași parte a ofertei în baza de date și același formular de ofertă.
- Risc: Ofertele deja trimise au text liber; tabelul trebuie să le afișeze fără calcul greșit, iar migrarea nu are voie să rescrie versiunile vechi (sunt imuabile).

**Pași**

1. Migrare pe quote_versions: coloane noi pentru TVA (după varianta aleasă), termen ca număr + unitate (WEEKS / WORKING_DAYS), garanție în luni și rubricile suplimentare alese de PO; delivery_term/warranty text rămân pentru ofertele vechi.
2. Schema comună și serviciul de oferte primesc câmpurile structurate (obligatorii la ofertele noi, după decizie); matricea de permisiuni pe câmpuri primește cheile noi.
3. Formularul trimite numărul și unitatea separat, cu întrebarea despre TVA lângă preț; scoate îndemnul despre TVA din descriere.
4. Tabelul: rând „Total în lei, cu TVA” calculat (cursul și data cursului afișate), echivalentul în lei sub sumele în euro, termen adus la zile lucrătoare cu „cel mai rapid” calculat pe el, rânduri pentru rubricile noi; ofertele vechi arată textul liber și „—” la calcul.
5. Aliniază etichetele exemplului de pe prima pagină cu tabelul real; actualizează PDF-ul ofertei și cardul ofertei cu aceleași rubrici.
6. Scoate din dialogul de acceptare îndemnul „întreabă firma dacă prețul include TVA” când rubrica e completată.

**Unde în cod**

- packages/shared/src/quote.schemas.ts:26-37 — oferta: preț, termen text, dată, garanție text, descriere; fără TVA/transport/montaj
- apps/backend/prisma/schema.prisma:1184-1189 — quote_versions: delivery_term și warranty sunt text
- apps/frontend/src/app/[locale]/_components/offer-builder.tsx:31-33, 125-136 — numărul și unitatea se transformă în text („8 săptămâni”) la trimitere
- apps/frontend/src/app/[locale]/_components/offers-comparison.tsx:132-146 — „cel mai mic” în lei, „cel mai rapid” doar dacă toate au dată; :211 — totalul afișat în moneda ofertei
- apps/frontend/src/messages/ro.json:23-26 — exemplul de pe prima pagină („cel mai rapid”, „în același tabel”)

**Cum se verifică**

- Teste pe serviciul de oferte: câmpurile noi obligatorii la ofertele noi, opționale la cele vechi.
- Test de componentă pe tabel: ofertă 3.900 EUR fără TVA lângă 18.500 lei cu TVA → rândul în lei cu TVA și insigna „cel mai mic” corecte.
- Test: „6 săptămâni” vs „30 de zile lucrătoare” ies egale, fără „cel mai rapid”.

**Documente de adus la zi**

- 04-data-model.md quote_versions (de actualizat): Coloane noi pentru TVA, termen structurat, garanție în luni și eventual transport/montaj.
- 03-business-rules.md §4.13 Permisiuni câmpuri ofertă (de actualizat): Lista câmpurilor (PRICE, DELIVERY_TERM, DELIVERY_DATE, WARRANTY, DESCRIPTION) primește câmpurile noi.
- 07-decisions-log.md D-v6-11 Proiectare contra cost (contrazice): Doar dacă PO alege ca firma să poată cere tarif de proiectare și când clientul nu l-a bifat (azi linia apare doar cu bifa clientului).

**Legături**

- nr. 19 (`a4`): Aceeași migrare pe quote_versions (și moneda pe variantă) și același formular de ofertă.
- nr. 37 (`g4`): PDF-ul ofertei trebuie să arate aceleași rubrici.
- nr. 40 (`j1`): Tabelul de comparare e cel tăiat pe telefon; rândurile noi îl lungesc.
- nr. 22 (`e1`): Rândul „Valabilitate” care devine „Acceptată / Înlocuită” după acceptare (SX-17).
- nr. 54 (`c12`): Formatul sumelor trebuie să fie același cu prețurile orientative.

**Întrebări și răspunsuri**

- **[a3-1] Cum aflăm dacă prețul unei oferte conține TVA?**
  - Context: Azi oferta nu are rubrică de TVA; o firmă scrie „TVA inclus”, alta „fără TVA” în descriere, iar tabelul le compară ca și cum ar fi la fel. Unele firme mici nu sunt plătitoare de TVA.
  - Variante: 1) Rubrică obligatorie cu trei variante: include TVA / nu include TVA / firma nu e plătitoare · 2) Rubrică da / nu · 3) Regulă fixă: toate ofertele se dau cu TVA inclus
  - **Răspunsul PO:** Rubrică obligatorie cu trei variante: include TVA / nu include TVA / firma nu e plătitoare (recomandarea). Tabelul calculează „Total cu TVA” corect pentru toate; firma mai bifează o rubrică.
- **[a3-2] Termenul și garanția devin obligatorii în ofertă?**
  - Context: Azi amândouă sunt opționale; când lipsesc, tabelul arată „—” și „cel mai rapid” nu se poate calcula.
  - Variante: 1) Ambele obligatorii · 2) Doar termenul obligatoriu · 3) Rămân opționale
  - **Răspunsul PO:** Ambele obligatorii (recomandarea). Tabelul e mereu complet; firma nu mai poate trimite o ofertă fără termen.
- **[a3-3] Ce costuri separate trebuie să spună firma în ofertă?**
  - Context: Azi transportul, montajul și proiectarea nu au rubrici; tariful de proiectare apare doar dacă clientul a bifat proiectare cu plată (așa e decizia scrisă), așa că firma nu-l poate cere altfel.
  - Variante: 1) Bife „inclus în preț: transport / montaj” + tarif de proiectare oricând · 2) Doar bifele pentru transport și montaj · 3) Sume separate pentru transport și montaj
  - **Răspunsul PO:** Doar bifele pentru transport și montaj (recomandarea). Decizia rămâne neschimbată; proiectarea cerută de firmă rămâne în descriere.

