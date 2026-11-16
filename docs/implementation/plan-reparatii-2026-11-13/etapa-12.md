# Etapa 12 — Mărunțișuri: texte, formate, curățenie

Locurile 54–63. Un singur format de preț și de dată, engleza pusă la punct, un singur șablon de întrebare. Curățenia de chei (nr. 59) o fac ultima, după ce textele sunt așezate.

- Mărime: 11,5 zile de lucru
- Module atinse: backend/auth, backend/companies, backend/penalties, backend/requests, frontend/admin, frontend/auth, frontend/configurator, frontend/marketplace, frontend/messages, frontend/offers, frontend/public, frontend/requests, frontend/studio, shared/questionnaire/flows
- Tabele atinse: audit_logs, companies, penalty_events, system_settings
- Presupuneri: Cheile de traducere folosite de versiunile vechi de formular nu se șterg; curățenia se face cu un script care citește toate versiunile.
- Gata când: Nicio dată în format american pe paginile în română. Scriptul de chei nefolosite nu mai găsește nimic.

## 54. Prețurile orientative au cel puțin șase formate (`c12`, P3)

- Mărime: 1 zi · risc mic
- De ce contează: „600–1100 lei/ml”, „3.000–7.000 lei”, „RON 150–300/lm”, „lei” rămas pe pagina în engleză. „ml” nu e explicat. Prețul pe metru liniar apare și la canapea și oglindă.
- Cauza: Fiecare preț orientativ a fost scris de mână ca text, la momente diferite, fără o regulă de scriere. Aceeași listă de materiale (cu preț pe metru liniar) e folosită la toate piesele, deci și la pat, oglindă sau canapea.
- Ce s-a văzut în cod: Prețurile orientative sunt texte fixe în fișierele de traducere (83 de chei), nu numere formatate de aplicație. În RO am numărat cel puțin 10 forme (cu / fără punct de mii, „lei/ml”, „lei / buc” și „lei/buc”), în EN „lei”, „RON” înainte și după număr și „/lm”.
- Risc: Doar texte; un preț rescris greșit (cifră schimbată) ar arăta clientului o sumă falsă, de aceea testul de tipar și o recitire.

**Pași**

1. Fixez formatul (decizia mea): RO „600–1.100 lei” (punct de mii, liniuță fără spații, „+” doar pentru costuri în plus), unitățile scrise întreg: „lei / m liniar”, „lei / bucată”, „lei / front”, „lei / sertar”.
2. EN în același format, cu moneda după număr: „600–1,100 lei per linear metre” — moneda „lei” sau „RON” după glosarul din i1.
3. Rescriu toate cele 83 de chei în ro.json și en.json (doar text, se vede și pe cererile vechi).
4. Adaug un test care verifică toate cheile „price” după un tipar (cifre, liniuță, monedă, unitate permisă), ca formatul să nu se mai strice la texte noi.
5. Ascunderea prețului pe metru liniar la piesele unde nu are sens (pat, oglindă, canapea, măsuță) se face în c1 (semn pe pas); aici doar textul.

**Unde în cod**

- apps/frontend/src/messages/ro.json — 83 de chei „price” (de ex. common.materials.*.info.price „250–450 lei/ml”, flows.KITCHEN.countertop.*.info.price)
- apps/frontend/src/messages/en.json — aceleași chei: „250–450 RON/lm”, „RON 150–300/lm”, „+RON 3,000–8,000”, „1,200–3,500 lei”
- apps/frontend/src/components/configurator/playing-card.tsx:52-85 și info-dialog.tsx:77-81 — prețul se afișează doar dacă cheia există (se poate ascunde scoțând cheia sau cu o regulă de afișare)
- packages/shared/src/questionnaire/flows/common.ts:40-57 — aceeași listă de materiale, cu același indiciu de preț, la orice piesă

**Cum se verifică**

- Test pe toate cheile „price” din ro.json și en.json: același tipar.
- Verific un ecran de material, unul de deschidere și unul de depozitare în RO și EN.

**Legături**

- nr. 28 (`c1`): C1 hotărăște unde se ascunde prețul pe metru liniar și scrie deja „lei pe metru liniar” în partea fără versiune nouă — aceeași trecere de text.
- nr. 42 (`i1`): Glosarul unic alege între „lei” și „RON”.
- nr. 16 (`b11`): Bugetul folosește același format de bani („36.000 lei” față de „Over 15,000 RON”).

**Întrebări și răspunsuri**

- **[c12-1] Cum arătăm prețul materialelor, care azi e „pe metru liniar”?**
  - Context: „lei/ml” e jargon de bucătărie și se poate citi „mililitru”; pentru o noptieră sau un birou un preț pe metru liniar spune puțin clientului.
  - Variante: 1) „lei / m liniar” scris întreg, cu o frază în detalii · 2) Indicator relativ: lei, lei lei, lei lei lei · 3) Fără preț la materiale
  - **Răspunsul PO:** „lei / m liniar” scris întreg, cu o frază în detalii (recomandarea). Clientul vede cifre reale și află ce înseamnă metrul liniar; rămâne doar la corpuri (după c1).

## 55. Engleza și anglicismele (`i2`, P3)

- Mărime: 1 zi · risc mic
- De ce contează: Română și engleză care nu spun același lucru în câteva locuri, „Debara” tradus „Pantry”, „Dimensiuni custom”, „draft” de 13 ori în Studio față de „ciornă” în rest.
- Cauza: Textele în engleză au fost traduse pe bucăți, uneori liber, iar câteva cuvinte englezești au rămas în română (custom, draft, walk-in, King, showroom). Engleza amestecă forme britanice și americane.
- Ce s-a văzut în cod: În RO „draft” apare de 14 ori (Studio), „Dimensiuni custom” o dată, „Configurează: X” de 7 ori; EN folosește „maker” în 4 subtitluri de material (en.json:6483-6525) și la nota de stofă (:3928). Camera e „Debara” în RO și „Pantry” în EN (ro/en.json:1180, :3624).
- Risc: Doar texte; atenție la „Debara”, care apare și în titlurile cererilor deja publicate.

**Pași**

1. RO: „Dimensiuni custom” → „Altă dimensiune”, „King” scos din descriere, „draft” → „ciornă” în tot Studio, „showroom” și „live” înlocuite, „Bancuță” → „Băncuță”, „Ia lungimea” → „Măsoară lungimea”, „Amortizarea merită” → „Închiderea lină merită”.
2. Explic pe scurt în descrierea cardului termenii tehnici fără explicație (casetieră, rabatabil, corp cu cuvă, soclu); „Walk-in”, „Push”, „Gola”, „Aventos” rămân cu fereastra de detalii existentă.
3. EN: o singură variantă de engleză (decizia mea: britanică, cum sunt deja majoritatea: metre, colour), „maker” → „company”, „How many walls do we use?” → „How many walls will the shelving go on?”, titlurile 3D „Create your …” aliniate cu RO.
4. Aliniez sensul RO / EN la perechile găsite de audit (subtitlurile de canapea, fotoliu, corp suspendat, înălțimea dressingului cu „(H)” în ambele).
5. Numele camerei de depozitare după răspunsul PO, în ambele fișiere și în titlul generat de server dacă se schimbă în RO.
6. Test care caută în ro.json cuvintele interzise (draft, custom, atelier) ca să nu revină.

**Unde în cod**

- apps/frontend/src/messages/ro.json:1180 și :3624 — „Debara” / en.json „Pantry”
- apps/frontend/src/messages/ro.json:4801 — „Dimensiuni custom”; :4798 „King”
- apps/frontend/src/messages/ro.json (Studio.*) — „Drafturile mele”, „Draft salvat în cont.” față de „ciornă” în rest
- apps/frontend/src/messages/en.json:6483-6525 și :3928 — „with the maker” în loc de „company”
- apps/frontend/src/messages/ro.json:547 — „Ia lungimea fiecărui perete…”; :4602 „Amortizarea merită…” (se poate citi ca amortizarea investiției)

**Cum se verifică**

- Testul de cuvinte interzise în ro.json și verificarea că fiecare cheie RO are pereche EN.
- Recitire RO / EN a ecranelor de debară, Studio și pat.

**Legături**

- nr. 62 (`c11`): Aceleași fișiere și aceeași listă de nume (glosarul de piese).
- nr. 42 (`i1`): Glosarul unic al aplicației hotărăște și termenii comuni (ciornă, cerere, lei).
- nr. 54 (`c12`): „RON/lm” în engleză se rezolvă cu formatul unic de preț.

**Alegeri mărunte făcute fără PO (se pot schimba)**

- Cum se numește camera de depozitare în română și în engleză? → RO „Debara”, EN „Storage room”. Se schimbă doar engleza; titlurile cererilor românești rămân la fel.

## 56. Consola de admin: coduri interne, fără motiv la ridicarea suspendării (`k2`, P3)

- Mărime: 1,5 zile · risc mic
- De ce contează: Sub eticheta stării apare și codul ei. Ridicarea suspendării nu cere motiv, iar punctele rămân la prag. Verificarea unei firme nu arată niciun document.
- Cauza: Listele de admin arată dedesubtul fiecărei etichete și codul tehnic. Ridicarea suspendării nu cere motiv și lasă punctele de penalizare la prag, așa că următoarea penalizare suspendă firma din nou. Verificarea firmei nu are documente pentru că nicio regulă nu le cere.
- Ce s-a văzut în cod (altfel decât în audit): Codul de sub etichetă a fost pus intenționat la redesign, ca să fie la îndemână la audit. La ridicarea suspendării punctele rămân la prag, deci următoarea penalizare suspendă firma din nou pe loc.
- Risc: Expirarea punctelor la ridicare schimbă istoricul de penalizări al firmei; trebuie să rămână urma în audit.

**Pași**

1. Codul tehnic trece din rândul vizibil într-un tooltip (atributul title) pe etichetă; căutarea în audit rămâne posibilă.
2. Ridicarea suspendării cere un motiv de cel puțin 3 caractere (ca la respingere), într-un DTO validat, salvat în jurnalul de audit al acțiunii.
3. Dialogul din admin arată câmpul de motiv și ce se întâmplă cu punctele, după decizia PO.
4. Punctele la ridicare: implementez varianta aleasă de PO (de ex. punctele active expiră acum, cu urmă în audit).
5. Verific de unde vine „12 din 12” pe panoul firmei față de lista de evenimente și le aduc la aceeași sursă dacă diferă.
6. Meniul de admin „Proiecte” devine „Cereri” (împreună cu i1).

**Unde în cod**

- apps/frontend/src/app/[locale]/admin/_components/core-list-parts.tsx:132 — componenta care pune codul sub etichetă
- apps/backend/src/modules/companies/admin-companies.controller.ts:56 — ridicarea suspendării, fără corp și fără motiv
- apps/backend/src/modules/companies/companies.service.ts:763 — ridicarea suspendării nu atinge punctele
- apps/backend/src/modules/penalties/penalties.service.ts:97 — la orice penalizare nouă, punctele active ≥ prag suspendă din nou

**Cum se verifică**

- Test e2e: ridicare fără motiv → 400; cu motiv → APPROVED și motivul în audit.
- Test: după ridicare și o penalizare nouă, firma nu e suspendată imediat (dacă PO alege resetarea punctelor).

**Legături**

- nr. 42 (`i1`): „Proiecte” față de „cereri” în meniul de admin e parte din glosar

**Alegeri mărunte făcute fără PO (se pot schimba)**

- Cerem firmelor un document (de exemplu certificatul constatator) la verificare? → Nu acum; adminul verifică CUI-ul în registrul public. Nicio muncă; rămâne cum e scris în reguli.

**Întrebări și răspunsuri**

- **[k2-1] Când administratorul ridică o suspendare, ce se întâmplă cu punctele de penalizare ale firmei?**
  - Context: Azi punctele rămân la prag (12 din 12), așa că orice penalizare nouă, chiar de 2 puncte, suspendă firma din nou pe loc.
  - Variante: 1) Punctele active se anulează (firma o ia de la zero) · 2) Punctele rămân, dar nu mai pot suspenda până expiră · 3) Punctele rămân ca acum
  - **Răspunsul PO:** Punctele active se anulează (firma o ia de la zero) (recomandarea). Ridicarea e un nou început; istoricul rămâne în audit.

## 57. Date în format american pe paginile în română (`g2`, P3)

- Mărime: 1 zi · risc mic
- De ce contează: „Valabilă până la 11/26/2026” în dialogul de acceptare și „mm/dd/yyyy” în formularul de ofertă, lângă „26 noiembrie 2026” în alte locuri.
- Cauza: Câteva locuri formatează data cu setările browserului în loc de limba paginii, iar câmpul de dată din formularul de ofertă e cel nativ al browserului, care urmează limba browserului, nu a site-ului.
- Ce s-a văzut în cod: Mai sunt trei locuri decât în audit (panoul de caz, anularea proiectului, invitația la consultație, ciornele din Studio).
- Risc: Câmpul de dată nou poate scrie o valoare greșită dacă validarea zilei din lună e incompletă.

**Pași**

1. Înlocuiesc toate apelurile fără limbă cu formatatorul next-intl (useFormatter().dateTime) cu fusul Europe/Bucharest, ca restul paginilor.
2. Datele „doar zi” (YYYY-MM-DD) le formatez fără conversie de fus, ca să nu sară o zi.
3. Câmpul „Data livrării” devine un câmp propriu zi/lună/an (trei selecții sau text cu zz.ll.aaaa și validare), care scrie aceeași valoare YYYY-MM-DD.
4. Adaug o regulă de lint care interzice toLocaleDateString()/toLocaleString() fără argument.

**Unde în cod**

- apps/frontend/src/app/[locale]/_components/accept-offer-dialog.tsx:99 — „Valabilă până la” cu toLocaleDateString() fără limbă (și :41 data livrării)
- apps/frontend/src/app/[locale]/_components/agreement-card.tsx:97 — „Acceptată pe” fără limbă (și :42)
- apps/frontend/src/app/[locale]/_components/offer-builder.tsx:309 — câmp nativ type="date" (mm/dd/yyyy pe browser în engleză)
- apps/frontend/src/app/[locale]/_components/project-case-panel.tsx:65 — același tipar
- apps/frontend/src/app/[locale]/_components/client-fulfillment.tsx:66 — același tipar
- apps/frontend/src/app/[locale]/_components/offer-card.tsx:794 — toLocaleString() fără limbă (și studio-page.tsx:976)

**Cum se verifică**

- Test de componentă pe dialogul de acceptare și pe „Acordul vostru” cu locale ro: „26 noiembrie 2026”, nu „11/26/2026”.
- Test pe câmpul de dată: 31.02 e respins, 26.11.2026 → 2026-11-26.

**Legături**

- nr. 22 (`e1`): „Acordul vostru” și dialogul de acceptare se schimbă și acolo
- nr. 19 (`a4`): aceeași fișă de ofertă și același dialog de acceptare

## 58. Navigare și accesibilitate: Back părăsește formularul, butoanele de informații nu au nume (`m1`, P3)

- Mărime: 1,5 zile · risc mediu
- De ce contează: Butonul Back al browserului scoate omul din formular. Butoanele „Vezi detalii” nu spun ale cui sunt pentru cititoarele de ecran. La contact, vizitatorul scrie e-mailul și apoi îl scrie din nou la înregistrare.
- Cauza: Tot formularul stă pe o singură adresă și pașii nu se trec în istoricul browserului, așa că Back iese din pagină. Butoanele de informații de pe cardurile mari folosesc un text fix fără numele opțiunii, iar e-mailul scris de vizitator la contact nu ajunge în formularul de înregistrare.
- Ce s-a văzut în cod: Butoanele „Vezi detalii” fără nume sunt pe cardurile mari și lângă titlul întrebării; cardurile mici au deja nume complet.
- Risc: Istoricul legat de pași se poate încurca cu ecranul de pornire și cu dialogul „Ai o cerere începută”, ducând la bucle de Back.

**Pași**

1. La fiecare schimbare de fază sau de ecran se adaugă o intrare în istoricul browserului (fără date personale în adresă), iar Back / Forward mută formularul la ecranul anterior / următor cu răspunsurile păstrate.
2. „Vezi detalii despre {opțiune}” pe cardurile mari și „Vezi detalii despre {întrebare}” lângă titlu (textul există deja).
3. Formularul de înregistrare deschis din Sumar primește e-mailul din contactul ciornei (din memoria formularului, nu din adresa paginii).
4. Dacă vizitatorul scrie un număr de telefon în câmpul de e-mail, mesajul îi spune să schimbe canalul pe „Telefon”.

**Unde în cod**

- apps/frontend/src/components/configurator/configurator-wizard.tsx:249 — navigarea din pagină nu scrie nimic în istoricul browserului
- apps/frontend/src/stores/configurator-store.ts:461 — pasul curent ținut doar în memorie / ciornă
- apps/frontend/src/components/configurator/playing-card.tsx:114 — „Vezi detalii” fără numele opțiunii
- apps/frontend/src/components/configurator/step-renderer.tsx:107 — butonul de informații de lângă titlu fără numele întrebării
- apps/frontend/src/components/configurator/details-step.tsx:103 — vizitatorul scrie e-mailul la contact; la înregistrare îl scrie din nou

**Cum se verifică**

- Test pe asistent: Back din browser întoarce un ecran, Forward revine, ieșirea din primul ecran părăsește pagina.
- Test de accesibilitate: numele butoanelor de informații conțin opțiunea.
- Test pe înregistrare: e-mailul vine completat din ciornă.

**Legături**

- nr. 9 (`b2`): Același mecanism de Înapoi; Date generale trebuie să rămână la Back din browser.
- nr. 10 (`b3`): Saltul la pasul 1 după publicare trebuie reparat înainte ca istoricul să fie legat de pași.
- nr. 11 (`b4`): Același drum vizitator → înregistrare → întoarcere la ciornă.

## 60. Regulile publice de pe producție: „0 puncte de penalizare” și contact pe adresă personală (`i3`, P3)

- Mărime: 0,5 zile · risc mic
- De ce contează: Propoziția ar trebui să dispară când valoarea e 0. „3 zile lucrătoare pentru proiectele mici, 3 pentru cele medii” repetă aceeași valoare.
- Cauza: Textele secțiunilor 5 și 6 pun mereu numărul de puncte în propoziție, chiar când e 0, și enumeră termenele pe mărimi chiar când sunt egale. Adresa publică e cea scrisă în setările de admin de pe producție.
- Ce s-a văzut în cod: Lista de puncte din secțiunea 7 ascunde deja regulile cu 0 puncte; propozițiile din secțiunile 5 și 6 nu. Adresa de contact nu e în cod: vine din setarea „legal_contact_email” completată în admin pe producție.
- Risc: Formele de plural și variantele trebuie scrise și în engleză, altfel apar chei lipsă.

**Pași**

1. Împart propozițiile cu puncte în variante: cu puncte și fără („creditele rezervate se consumă.”), alese după valoare, ca la secțiunea 7.
2. Termenele: dacă mică = medie = mare → „{n} pentru orice proiect”; dacă două sunt egale → „{a} pentru proiectele mici și medii, {b} pentru cele mari”.
3. Dialogul de preluare („firma primește puncte de penalizare”) folosește aceeași valoare și nu mai pomenește puncte când sunt 0.
4. Adresa de contact: PO schimbă setarea din admin pe adresa aleasă (fără cod).

**Unde în cod**

- apps/frontend/src/messages/ro.json:6756 — sla.b: „…și firma primește {slaMissPoints} de penalizare” și „{small} pentru proiectele mici, {medium}…”
- apps/frontend/src/messages/ro.json:6760 — withdrawals.b: „…firma primește {withdrawalPoints} de penalizare”
- apps/frontend/src/app/[locale]/_components/firm-rules-article.tsx:78 — valorile se pun în text fără verificare de 0 sau de egalitate
- apps/frontend/src/app/[locale]/_components/firm-rules-article.tsx:206 — secțiunea 7 filtrează deja regulile cu 0 puncte (modelul de urmat)
- apps/backend/src/modules/legal/legal.service.ts:43 — adresa de contact vine din system_settings.legal_contact_email

**Cum se verifică**

- Test de componentă pe firm-rules cu puncte 0 și termene egale: propozițiile cu „0 puncte” și repetițiile nu apar.
- Verificare vizuală /ro/firm-rules și /en/firm-rules.

**Legături**

- nr. 30 (`a7`): mesajele de la preluare pomenesc aceleași puncte
- nr. 42 (`i1`): aceiași termeni („termen de răspuns”, „marketplace”)

**Întrebări și răspunsuri**

- **[i3-1] Ce adresă de e-mail publică folosim pentru contact pe site?**
  - Context: Azi subsolul și regulile arată o adresă personală de Yahoo, completată în setările de admin.
  - Variante: 1) O adresă pe domeniul firmei (ex. contact@ sau suport@) · 2) Rămâne adresa de acum până la lansare
  - **Răspunsul PO:** O adresă pe domeniul firmei (ex. contact@ sau suport@) (recomandarea). Arată serios; trebuie creată căsuța și pusă în setări și în e-mailurile de cont.

## 61. Resetarea parolei nu trimite e-mail de confirmare (`f5`, P3)

- Mărime: 0,5 zile · risc mic
- De ce contează: După schimbarea parolei nu pleacă niciun „Parola ta a fost schimbată”. Ecranul de succes nu autentifică și nu duce înapoi.
- Cauza: După resetarea sau schimbarea parolei, serverul închide sesiunile, dar nu trimite niciun e-mail de anunț. Ecranul de succes are doar un link spre login.
- Ce s-a văzut în cod: Nici schimbarea parolei din cont (cu parola veche) nu trimite e-mail.
- Risc: Dacă SMTP pică, resetarea trebuie să reușească totuși; altfel nimic.

**Pași**

1. Adaug un e-mail „Parola ta a fost schimbată” (ro/en după limba contului), cu data și ora în ora României și „Dacă nu ai fost tu, resetează parola și scrie-ne”, cu reply-to la suport.
2. Îl trimit după resetare și după schimbarea din cont, best-effort (o eroare SMTP doar se loghează, ca la celelalte e-mailuri de cont).
3. Pe ecranul de succes, butonul „Intră în cont” precompletează e-mailul; fără autentificare automată (o parolă nouă trebuie folosită o dată conștient).

**Unde în cod**

- apps/backend/src/modules/auth/auth.service.ts:267 — resetarea parolei: schimbă parola, revocă sesiunile, nu trimite e-mail
- apps/backend/src/modules/auth/auth.service.ts:297 — schimbarea parolei din cont: la fel, fără e-mail
- apps/backend/src/modules/auth/auth.service.ts:170 — modelul e-mailului de resetare, de refolosit
- apps/frontend/src/app/[locale]/(auth)/reset-password/page.tsx:56 — ecranul de succes cu „Mergi la autentificare”

**Cum se verifică**

- Test unitar auth.service: resetPassword și changePassword trimit e-mailul de confirmare; eroarea de e-mail nu oprește resetarea.
- Local în Mailpit: după resetare apar două e-mailuri (linkul și confirmarea).

**Legături**

- nr. 45 (`g1`): tot un eveniment fără e-mail; se poate face în aceeași trecere prin e-mailuri

## 62. Aceeași întrebare scrisă în cinci feluri, aceeași piesă cu mai multe nume (`c11`, P3)

- Mărime: 2,5 zile · risc mic
- De ce contează: „Material — dulap”, „Material pentru…”, „Ce material pentru…?”, „Ce material?”, „Ce material dorești…”. „Comodă TV” și „zonă TV”. În Sumar piesele sunt numite „camere”.
- Cauza: Textele au fost scrise cameră cu cameră, în momente diferite, fără un șablon și fără o listă unică de nume pentru piese. Sumarul numără tot ce e în coș cu un singur text („O cameră / # camere”), deși coșul separă camerele de piese.
- Ce s-a văzut în cod: Numărat în ro.json: 21 „Material — X”, 21 „Deschidere — X”, 11 „Material pentru X”, 6 „Deschidere pentru X”, 7 „Ce material pentru X?”, 14 „Ce material?”, 7 „Ce material dorești…”. Titlul cererii generat de server spune „Piese individuale” și „Noptiere” și la una singură.
- Risc: Doar texte; riscul e să schimbi un nume care e folosit și la potrivirea imaginilor sau în teste instantanee.

**Pași**

1. Fixez șablonul (decizia mea): întrebare cu subtitlu peste tot — „Ce material vrei pentru {piesă}?” și „Cum se deschid ușile și sertarele la {piesă}?” (sau formularea aleasă în c1 / c2 pentru versiunea nouă), „Ce piese îți trebuie?” în toate camerele, „Ai o schiță a {camerei}?” la schiță.
2. Fac glosarul de piese (o etichetă RO + EN pe fiecare valoare, folosită în opțiune, titluri, câmpuri, Sumar și titlul cererii): Comodă TV / TV unit, Bibliotecă / Bookcase, Rafturi de perete / Wall shelves, Dulap de depozitare / Storage cabinet, Băncuță, Noptieră (cu număr), Altă piesă / Other piece; „Liniară / Drept / Un perete” aliniate la „Pe un perete”.
3. Rescriu în ro.json / en.json titlurile, câmpurile și subtitlurile de material după șablon (cheile nu se schimbă, deci se aplică și cererilor vechi) și aliniez ventilația baie / spălătorie la aceleași cuvinte.
4. Sumarul numără ca în coș („2 camere · 3 piese”); schița unei piese spune „pentru această piesă”; formularul de ofertă „Preț pe fiecare cameră sau piesă”.
5. Titlul cererii din server folosește aceleași nume („Altă piesă”, „Noptieră / Noptiere” după număr, numele ales pentru biroul-piesă) și un test pentru titlul generat.
6. Titlurile pieselor 3D într-un singur stil în RO („Creează {piesa}”, ca în EN) în loc de „Configurează: X”.

**Unde în cod**

- apps/frontend/src/messages/ro.json:4272-5669 (și en.json) — titlurile de material / deschidere în cinci stiluri; „zonă TV” față de „Comodă TV”; „Bancuță” fără ă
- apps/frontend/src/messages/ro.json:3570 — „cart.totalRooms”: „O cameră / # camere” pentru orice element din coș
- apps/frontend/src/components/configurator/review-step.tsx:434-435 — Sumarul folosește numărătoarea de camere și pentru piese
- apps/frontend/src/messages/ro.json:3588 și :1735 — „pentru această cameră” la schița unei piese; „Preț pe fiecare cameră” în formularul de ofertă
- apps/backend/src/modules/requests/requests.service.ts:954 și :967 — titlul cererii: „Piese individuale”, „Noptiere” la singular
- packages/shared/src/questionnaire/flows/office.v2.ts:26 — piesa „Birou” cu același nume ca și camera „Birou”

**Cum se verifică**

- Test pentru titlul generat al cererii (o noptieră, două noptiere, altă piesă, birou cameră + birou piesă).
- Verific pe câte o cameră din fiecare stil că titlurile de material au aceeași formă în RO și EN.

**Legături**

- nr. 28 (`c1`): C1 schimbă în versiunea nouă ce se întreabă la material („fronturi”, „cadru”, „ramă”); textele se uniformizează o singură dată, după ce formularea e stabilită.
- nr. 27 (`c2`): La fel pentru întrebarea de deschidere.
- nr. 42 (`i1`): Glosarul de piese face parte din același glosar unic al aplicației.
- nr. 17 (`d1`): d1 rescrie numele pieselor generate pentru firmă; trebuie să folosească același glosar.
- nr. 55 (`i2`): Aceleași fișiere de texte, aceeași trecere RO / EN.

**Întrebări și răspunsuri**

- **[c11-1] Cum numim biroul ca piesă, ca să nu se confunde cu camera „Birou”?**
  - Context: O cerere cu camera Birou și piesa Birou primește titlul „Birou + Birou — Oraș”, iar „Birou — București” poate fi citit ca spațiu de birouri.
  - Variante: 1) Camera „Birou”, piesa „Birou de lucru” · 2) Camera „Birou acasă”, piesa „Birou” · 3) Camera „Birou”, piesa „Masă de birou”
  - **Răspunsul PO:** Camera „Birou”, piesa „Birou de lucru” (recomandarea). Titlul devine „Birou + Birou de lucru — Oraș”; numele camerei rămâne cel cunoscut.

## 63. Subtitluri și sfaturi care contrazic întrebarea (`c13`, P3)

- Mărime: 1,5 zile · risc mic
- De ce contează: După bifa „materiale diferite” prima întrebare rămâne „pentru toată bucătăria”. Subtitlul schiței vorbește de televizor și când n-ai ales unul. La balcon deschis textul spune că PAL-ul nu rezistă, dar formularul îl oferă fără avertisment.
- Cauza: Subtitlurile și sfaturile sunt texte fixe, scrise pentru cazul cel mai des întâlnit, deci nu se potrivesc când clientul alege altfel (fără televizor, fără dulap, fără birou, fără insulă). Unde sfatul ar trebui să schimbe formularul (balcon deschis, baie fără aerisire), formularul nu reacționează.
- Ce s-a văzut în cod: Toate textele din audit sunt în ro.json la liniile indicate (de ex. 4463 „Îl folosim la toată bucătăria”, 5075 „peretele cu televizorul”, 4902 „poziția patului și a dulapului”, 5150 „blatul de lucru”, 5249 „recomandăm MDF”, 5606 / 5631 balconul).
- Risc: Textele se schimbă și pe cererile vechi; trebuie să rămână adevărate pentru versiunile vechi ale fluxurilor.

**Pași**

1. Doar text (oricând): subtitluri neutre la schiță („peretele sau zona cu mobilierul, cu dimensiuni, uși, ferestre și prize”), la dimensiunile de birou și hol (ce se cere de fapt), bifa bucătăriei „Vreau materiale diferite pe zone” fără insulă, „Îl folosim la toată bucătăria” → „Pentru toate fronturile, dacă nu bifezi mai jos materiale pe zone”.
2. Doar text: același sfat de umezeală în baie și spălătorie („MDF înfoliat”), aliniat cu insigna; PAL la baie fără „rezistent” în descriere; „Pe câți pereți montăm?” → „Pe câți pereți vin rafturile?”; „Fără” la depozitare cu preț gol în loc de „inclus”.
3. Doar text: subtitluri pentru întrebările care nu au (materialele din camere, depozitarea și tapițarea patului, noptierele), după șablonul din c11.
4. Doar afișare (precedentul docs/archive/12 §4, fără versiune nouă): un avertisment vizibil „nerecomandat aici” pe PAL și MDF la balcon deschis și pe PAL la baia neaerisită, pe lângă insigna „Recomandat” existentă.
5. La balcon deschis scriu în descrierea pieselor pentru firmă „balcon deschis — exterior” (împreună cu d1, care rescrie descrierile), ca firma să știe fără să caute în rezumat.
6. Opțiunile de exterior (după răspunsul PO) intră în versiunea nouă comună, salvate ca „Altul” cu descriere, fără valori noi în listă.

**Unde în cod**

- apps/frontend/src/messages/ro.json:4458-4463 — bucătărie: „Îl folosim la toată bucătăria” și bifa care pomenește insula și fără insulă
- apps/frontend/src/messages/ro.json:5075, :4902, :5150 — subtitlul schiței cu televizor / pat și dulap, subtitlul dimensiunilor de birou cu „blatul de lucru”
- apps/frontend/src/messages/ro.json:5249 și :5457 — baia recomandă „MDF”, spălătoria „MDF înfoliat”
- apps/frontend/src/messages/ro.json:5606 și :5631 — balcon: „PAL-ul și MDF-ul nu rezistă aici”
- packages/shared/src/questionnaire/flows/balcony.v2.ts:79-80 și :117-121 — la balcon deschis singura reacție e „Recomandat” pe lemn masiv; PAL rămâne fără avertisment
- packages/shared/src/questionnaire/flows/bedroom.v2.ts:160-179 — „Depozitare sub pat?” fără subtitlu și fără descrieri; „Fără” are prețul „inclus”

**Cum se verifică**

- Verific în browser bucătăria fără insulă, living fără comodă TV, birou fără birou, balcon deschis și baie neaerisită.
- Testul de acoperire a textelor (cheile noi de avertisment există în ro și en).

**Legături**

- nr. 53 (`c14`): Ecranul de fronturi al bucătăriei se împarte pe zone în interfață la c14; titlurile zonelor rezolvă și textul „pentru toată bucătăria”.
- nr. 4 (`c6`): La balcon și spălătorie insigna de material se schimbă deja la c6 (blatul scos de sub regulă).
- nr. 28 (`c1`): Opțiunile de exterior la balcon intră în seturile de material din versiunea nouă.
- nr. 62 (`c11`): Subtitlurile noi urmează șablonul unic de întrebare.

**Întrebări și răspunsuri**

- **[c13-1] La balcon deschis, ce facem cu materialele de interior (PAL, MDF)?**
  - Context: Textul spune că PAL-ul și MDF-ul nu rezistă afară, dar formularul le oferă fără niciun avertisment, iar singura recomandare e lemnul masiv.
  - Variante: 1) Le lăsăm, cu avertisment vizibil, și adăugăm materiale de exterior · 2) Doar avertisment, fără materiale noi · 3) Le ascundem la balcon deschis
  - **Răspunsul PO:** Doar avertisment, fără materiale noi (recomandarea). Se poate face imediat; firma propune materialul de exterior în ofertă.

## 59. Curățenie: chei de traducere nefolosite și comentarii vechi (`m2`, P3)

- Mărime: 0,5 zile · risc mic
- De ce contează: Chei de traducere rămase de la versiunile vechi ale fluxurilor și comentarii din registru care nu mai descriu realitatea. Nu se văd în aplicație, dar încurcă la întreținere.
- Cauza: Când o întrebare a fost scoasă dintr-o versiune nouă, textele ei au rămas în fișierele de traducere, iar unele comentarii din registru n-au fost actualizate după mutarea patului, mesei și băncuței pe versiunea 3. Multe chei par nefolosite, dar sunt folosite de versiunile vechi, care nu se șterg niciodată.
- Ce s-a văzut în cod (altfel decât în audit): Jumătate din cheile date de audit ca nefolosite sunt de fapt folosite de versiunile vechi, înghețate, ale formularului și nu se pot șterge. Sigur nefolosite sunt trei: două la hol și una la birou.
- Risc: Ștergerea unei chei folosite de o versiune veche ar face să apară codul cheii în locul textului pe cererile vechi; scriptul pe toate versiunile previne asta.

**Pași**

1. Scriu un script de verificare (în teste, nu în aplicație) care încarcă registrul cu TOATE versiunile, inclusiv cele înghețate, parcurge fiecare pas, opțiune, fereastră de detalii și câmp de dimensiune (cu răspunsuri sintetice care aleg toate piesele și formele) și strânge cheile folosite.
2. Adaug cheile folosite direct din componente (căutare după t('…') și prefixele construite, de ex. common.materials.*), apoi compar cu toate cheile din „Configurator.flows” din ro.json.
3. Șterg doar cheile pe care scriptul nu le găsește în nicio versiune și pe care le confirm manual (azi: HALLWAY.depthProfile, HALLWAY.openingSystems, OFFICE.cableManagement), din ro.json și en.json deodată.
4. Las scriptul ca test permanent care pică dacă o cheie folosită de o versiune lipsește din ro / en (protejează versiunile înghețate la curățenii viitoare).
5. Corectez comentariile din registru (index.ts:159-160) și din guided-pieces/v3.ts:25 ca să spună că pat / masă / băncuță pornesc pe v3.

**Unde în cod**

- packages/shared/src/questionnaire/flows/index.ts:159-160 — comentariul spune că pat / masă / băncuță rămân pe v2, dar :165, :167, :170 le pornesc pe v3
- packages/shared/src/questionnaire/flows/hallway.ts:11-15 — depthProfile scos; textele lui rămân în ro.json (flows.HALLWAY.depthProfile)
- packages/shared/src/questionnaire/flows/office.v2.ts:19-20 — întrebarea de cabluri scoasă; cheia flows.OFFICE.cableManagement nefolosită și de office.ts
- packages/shared/src/questionnaire/flows/office.ts:80-96 — versiunea 1 înghețată folosește încă material / openingSystems / notes (cheile NU se șterg)

**Cum se verifică**

- Testul nou: fiecare cheie folosită de orice versiune din registru există în ro.json și en.json.
- Deschid o cerere veche de birou (v1) și una de hol după ștergere: niciun cod de cheie pe ecran.

**Legături**

- nr. 62 (`c11`): După rescrierea textelor și după versiunea nouă comună se văd cheile rămase cu adevărat fără folosință.
- nr. 55 (`i2`): Aceleași fișiere de texte; curățenia vine ultima.

