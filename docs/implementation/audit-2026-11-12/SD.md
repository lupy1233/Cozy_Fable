# Raport SD — firma noua (D Atelier Bucov) + client Mihai, stiva LOCALA (2026-11-12)

Mediu: `http://localhost:3000`, Playwright + Edge headless. WebGL verificat: `ANGLE (NVIDIA, NVIDIA GeForce GTX 1070 (0x00001B81) Direct3D11 vs_5_0 ps_5_0, D3D11)` — ruleaza pe GPU.
Capturi: `C:\Users\Wolf\AppData\Local\Temp\claude\826c1772a242ab28\021e0df7-d6c7-42ac-993b-05ae92e81192\scratchpad\audit\shots\SD\<scenariu>\`.
Scripturi: `...\audit\scripts\SD\` (driver `server.cjs` pe portul 4779 + bucati in `q\`).

## 1. Scenarii

| ID | Ce face | Rezultat | Pe scurt |
|---|---|---|---|
| SD-01 | Primele minute ale firmei D | PARTIAL | Panoul nu spune nimic despre configurare („Nimic urgent acum”); portofoliul accepta doar link de poza (fara incarcare); raza nu se poate modifica din UI; matricea de permisiuni e GOALA pentru firma D; colegul nu poate fi invitat pe e-mail (trebuie sa-si faca singur cont de firma inainte) si nu primeste niciun e-mail cand e adaugat. |
| SD-02 | Portofel: cumparare 10 credite prin transfer | PARTIAL | Comanda se plaseaza (PENDING), apar datele de transfer + e-mail; dar „Descarca proforma” da 500 fara mesaj, iar e-mailul nu are proforma atasata desi pagina spune ca a fost trimisa; portofelul nu are istoric al miscarilor de credite. Comanda a fost confirmata ulterior de coordonator (21:14) → stare PLATITA, „Factura MM-11” (descarcarea facturii n-am testat-o). |
| SD-03 | Living, drumul fericit pana la acceptare (si mai departe) | TRECUT cu ocolis | Publicare OK; preluare OK (21 credite rezervate); **oferta respinsa cu 403 pentru PROPRIETAR** pana am bifat eu coloana Proprietar in matrice (SD-01); dupa asta: oferta → intrebare in chat → raspuns → acceptare → „Marcheaza ca livrata” → confirmare client → FINALIZATA, creditele consumate (rezervate 21→0). Stare afisata gresit la firma („OFERTA TRIMISA” dupa acceptare si livrare). |
| SD-04 | Dormitor + piesa Birou, telefon+e-mail in mesaj | TRECUT | Avertisment inline la scriere, publicarea permisa; inainte de preluare textul arata „contact ascuns” in lista, detaliu si API; dupa preluare apar ambele; oferta cu pret pe Dormitor (9.000) + Birou (3.500) = 12.500 OK. Texte: „Pret pe fiecare camera” si „2 camere — Dormitor, Birou” pentru o piesa. |
| SD-05 | Cerere mica in Cluj-Napoca (fara firme in zona) | PICAT (UX) | Nicio avertizare la publicare sau dupa; pagina spune „Cererea e vizibila firmelor verificate din zona ta” si „Asteptam firmele”; firma D nu o vede (lista + 404 pe link direct). Clientul afla abia la expirare (19 nov). |
| SD-06 | Cererile vechi ale lui Mihai | PARTIAL | File si cautare merg; cererea expirata are „Republica” (o singura data, fara editare inainte); n-am apasat (date demo). Ciornele nu apar nicaieri in lista, deci nu se pot sterge. |
| SD-07 | Dupa livrare | PARTIAL | Pe SD-03: confirmare livrare (un clic, fara dialog) → recenzie. **Recenzia s-a trimis cu 5 stele la primul clic pe „Trimite recenzia”, fara sa aleg nimic** (5 e preselectat). Dupa finalizare: niciun buton de disputa / reclamatie, nicio factura pentru client. Pe demo: KITCHEN Cluj finalizata cu recenzie, LIVING Cluj in negociere cu oferta expirata („Cere prelungirea”). |

## 2. Constatari

### SD-01 · P1 · defect (date/seed + lipsa de fallback) — Matricea de permisiuni pe oferta e goala pentru firma D; proprietarul nu are bifat nici „Pret”
- **Unde:** `/ro/company#permissions`; tabela `company_offer_field_permissions`; `apps/backend/src/modules/quotes/quotes.service.ts:1518-1535` (`assertFieldPermissions`).
- **Ce se intampla:** pentru D Atelier Bucov toate cele 20 de casute (5 campuri x 4 roluri) sunt nebifate, inclusiv la PROPRIETAR. In baza de date firma D are 0 randuri in `company_offer_field_permissions` (celelalte firme au 20 fiecare, 80 in total). Backend-ul nu are valoare implicita: orice camp atins fara rand `canEdit=true` → 403 `OFFER_FIELD_NOT_EDITABLE`. Firmele create prin `POST /companies` primesc randurile implicite (`companies.service.ts:330`), dar firma D (seed „aprobata azi”) nu.
- **Ce ar trebui:** o firma aprobata trebuie sa poata trimite oferta din prima; proprietarul ar trebui sa aiba mereu toate drepturile, indiferent de randuri.
- **Dovada:** captura `SD-01\02-ownerd-company.png`; `select count(*) from company_offer_field_permissions where company_id='d9ecb5df-…'` → 0. **Efect confirmat in SD-03:** proprietarul `owner.d` a primit la „Trimite oferta” 403 `{"code":"OFFER_FIELD_NOT_EDITABLE","details":{"fields":["PRICE","DESCRIPTION","DELIVERY_TERM","WARRANTY"]}}` si mesajul „Nu ai permisiunea de a edita unele campuri ale ofertei.” (traceId `f0d444bd-048b-4078-807e-11ec2e24c9a6`). A mers abia dupa ce am bifat cele 5 casute din coloana PROPRIETAR si am salvat (200). O firma reala ar fi ramas blocata: mesajul nu spune unde se repara si nici ca proprietarul insusi e afectat. **Gravitate reala pentru firma D: P0** (nu poate oferta deloc).
- **Propunere:** fallback in `assertFieldPermissions` (OWNER = tot; lipsa randurilor = `defaultOfferFieldPermissions()`), afisarea implicitelor in UI cand nu exista randuri; reparat seed-ul firmei D (si verificat pe productie daca firma D exista acolo la fel).

### SD-02 · P1 · UX — Invitarea unui coleg pe e-mail nu exista: merge doar pentru un cont de firma deja creat, iar eroarea e „Nu am gasit ce cauti.”
- **Unde:** `/ro/company#team` → „Email membru” + „Adauga membru”; `companies.service.ts:520-544` (`addMember` cauta doar `role: 'COMPANY_USER'` existent).
- **Ce se intampla:** cu `audit.sd.1@example.test` (fara cont) → 404 `No company user with this email`, iar pe ecran apare doar „Nu am gasit ce cauti.” sub formular. Nimic nu explica ca omul trebuie sa-si faca intai cont de tip „Firma”. Dupa ce colegul si-a facut cont (Inregistrare → „Firma — Producem mobilier la comanda”), adaugarea a mers (201), chiar INAINTE ca el sa-si confirme e-mailul. Colegul NU primeste niciun e-mail si nicio notificare ca a fost adaugat in firma; afla doar cand intra.
- **Ce ar trebui:** invitatie reala: e-mail cu link „Ai fost invitat in D Atelier Bucov — seteaza-ti parola”, cont creat la acceptare; sau macar un text care explica pasii si un e-mail catre membrul adaugat.
- **Dovada:** `SD-01\12-ownerd-team-after.png` (mesajul), `SD-01\15-ownerd-team-added.png`; Mailpit: singurul e-mail catre coleg = „Confirma adresa de email — Cozy Home” (de la inregistrare).
- **Propunere:** flux de invitatie cu token (tabel de invitatii), mesaj de eroare explicit pana atunci („Persoana nu are cont de firma. Roag-o sa se inregistreze ca Firma cu acest e-mail, apoi adaug-o aici.”), e-mail + notificare la adaugare. Inregistrarea „Firma” ar trebui sa aiba si varianta „Lucrez la o firma deja inscrisa”.

### SD-03 · P2 · UX — Firma noua nu primeste niciun ghid de pornire; panoul spune „Nimic urgent acum”
- **Unde:** `/ro/dashboard` (firma D, zi 0).
- **Ce se intampla:** cu portofoliu gol, o singura locatie, echipa de 1 si permisiuni goale, „De facut acum” afiseaza „Nimic urgent acum. Te anuntam cand apare ceva.” si un buton „Mergi la marketplace”. Nicio lista de configurare (portofoliu, locatii/raza, echipa, e-mail de facturare), nicio explicatie ce inseamna „Abonament GOLD · mai sunt 30 zile” (ca e perioada de proba, ce se intampla la expirare, daca se reinnoieste/plateste automat). Eticheta „PERIOADA DE PROBA” apare doar pe Portofel, lipita de text: „…Acces imediat la cererile noiPERIOADĂ DE PROBĂ”.
- **Ce ar trebui:** un card „Pregateste-ti firma” cu pasii si progres; o fraza clara despre proba: „Proba gratuita GOLD pana pe 12 dec. 2026. Dupa aceea…”.
- **Dovada:** `SD-01\01-ownerd-dash.png`, `SD-01\03-ownerd-wallet.png`.
- **Propunere:** checklist de onboarding pe panou + text despre sfarsitul probei (si un e-mail cu cateva zile inainte).

### SD-04 · P2 · UX — Raza de acoperire nu se poate modifica din interfata; o locatie noua cere latitudine/longitudine scrise de mana
- **Unde:** `/ro/company#locations`. API-ul are `PUT /companies/me/locations/:id` (`companies.controller.ts:68`), dar UI-ul ofera doar „Sterge…” si „Adauga locatie”.
- **Ce se intampla:** ca sa schimbi raza de la 50 km trebuie sa stergi locatia si s-o adaugi din nou; formularul de adaugare cere „Adresa noii locatii, Judet, Oras, Tara, Latitudine (Coordonata zecimala, ex. 46.7712), Longitudine, Raza”. Un om obisnuit nu-si stie coordonatele; formularul de cerere al clientului foloseste sugestii Google, aici nu. N-am schimbat raza (singura locatie a firmei e folosita si de alt agent; stergerea ar fi scos firma din toate cererile).
- **Ce ar trebui:** buton „Modifica” pe locatie (raza cu glisor/selector), adresa cu sugestii Google si coordonate completate automat.
- **Dovada:** `SD-01\06-ownerd-location-add.png`.
- **Propunere:** folosit `PUT` existent intr-un dialog „Modifica locatia”; reutilizat componenta de adresa din formularul de cerere.

### SD-05 · P2 · UX — Portofoliul nu permite incarcarea pozelor; cere „URL imagine” public; eroare generica la URL respins
- **Unde:** `/ro/company#portfolio` → „Adauga proiect” (Titlu, Descriere, URL imagine).
- **Ce se intampla:** nu exista incarcare de fisier (nu am putut pune PNG-ul generat). Cu titlu gol: „Titlul este prea scurt.” (in loc de „Completeaza titlul”). Un URL respins de backend (`imageUrl must be a URL address`) afiseaza doar „Unele campuri nu sunt completate corect. Verifica-le si trimite din nou.” fara sa marcheze campul. Cu `https://example.test/…` lucrarea s-a adaugat, cu imagine rupta (nicio rezerva vizuala, doar `ERR_NAME_NOT_RESOLVED` in consola).
- **Ce ar trebui:** incarcare de poze (presigned, ca la fisierele cererii), mai multe poze per lucrare, mesaj pe camp.
- **Dovada:** `SD-01\05-ownerd-portfolio-add.png`, `SD-01\10-ownerd-dbg2.png`, `SD-01\11-ownerd-portfolio-after2.png`; raspuns 400 `{"details":["imageUrl must be a URL address"]}`.
- **Propunere:** upload prin StorageService; afisarea erorii de backend pe campul `imageUrl`; imagine de rezerva cand poza nu se incarca.

### SD-06 · P1 · defect — „Descarca proforma” da 500 si nu spune nimic; e-mailul de transfer nu are proforma atasata, desi pagina zice ca a fost trimisa
- **Unde:** `/ro/marketplace/wallet` → „Plata prin transfer bancar” → „Descarca proforma”; `GET /api/v1/billing/orders/<id>/proforma` → 500 `INTERNAL_ERROR`. E-mail „Datele pentru plata prin transfer — comanda 2E0361EF”.
- **Ce se intampla:** butonul nu descarca nimic si nu afiseaza nicio eroare. Panoul spune „Ti-am trimis pe email datele de plata si factura proforma.”, dar e-mailul din Mailpit are 0 atasamente (backend-ul trimite fara atasament cand randarea PDF pica — `billing-documents.service.spec.ts:68`). Cauza probabila: randarea PDF (Chromium) nu merge pe stiva locala Windows — **de verificat pe productie** (Docker).
- **Ce ar trebui:** proforma descarcabila; daca randarea pica, mesaj clar si textul de pe pagina sa nu promita un atasament care nu exista.
- **Dovada:** `SD-02\06-ownerd-payment-details2.png`, `SD-02\07-ownerd-proforma-fail.png`; traceId `f36123d0-80b5-464e-9aed-dfb66657cc8c`.
- **Propunere:** toast de eroare la descarcare; textul „ti-am trimis proforma” conditionat de atasamentul real; alerta interna cand randarea PDF pica.

### SD-07 · P2 · UX — Portofelul nu are istoric al miscarilor de credite; creditele de proba nu se pot explica din aplicatie
- **Unde:** `/ro/marketplace/wallet` (file: Credite / Abonament / Cumpara credite / Comenzi si facturi / Penalizari).
- **Ce se intampla:** se vad doar „Disponibile 210 / Rezervate 0 / Total 210”. Nu exista lista „cand am primit / rezervat / consumat / primit inapoi credite”. In baza de date firma D are o singura miscare: `GRANT 10 TRIAL_BONUS`, desi soldul e 210 (restul de 200 vin din seed fara miscare) — deci si un istoric construit din `credit_transactions` n-ar ajunge la sold.
- **Ce ar trebui:** fila „Istoric” cu fiecare miscare (preluare, decontare, restituire, cumparare, bonus de proba) si soldul dupa fiecare.
- **Dovada:** `SD-01\03-ownerd-wallet.png`; `select type, amount, reason from credit_transactions where company_id='d9ecb5df-…'` → `GRANT|10|TRIAL_BONUS`.
- **Propunere:** pagina de istoric din `credit_transactions`; seed care scrie si miscarea pentru soldul initial.

### SD-08 · P3 · text — Date de plata de test in configurarea locala
- **Unde:** panoul de transfer + e-mail: „Beneficiar: Firma Test Reala SRL · CUI RO12345674 · IBAN RO08TEST0000000000000001”.
- **Ce se intampla:** valori de test locale (normal pe local). **De verificat pe productie** ca setarile de facturare au datele reale ale firmei, altfel firmele ar vira bani intr-un IBAN inexistent.
- **Dovada:** `SD-02\06-ownerd-payment-details2.png`.

### SD-09 · P3 · UX — Comanda in asteptare nu poate fi anulata de firma; termenul de valabilitate nu apare
- **Unde:** „Comenzi si facturi” → „Pachet 10 credite · 121,00 lei · IN ASTEPTAREA PLATII” → „Date de plata”.
- **Ce se intampla:** butoane: Copiaza (IBAN / Suma / Detalii), „Am platit”, „Descarca proforma”. Nu exista „Anuleaza comanda” si nici „valabila pana la …” pe pagina (proforma ar avea termenul, dar nu se descarca). Daca firma a apasat din greseala, comanda ramane agatata.
- **Propunere:** „Anuleaza comanda” cat timp e PENDING si fara „Am platit”; termenul afisat langa suma.

### SD-10 · P1 · defect (securitate) — Formularul de autentificare trimis inainte de hidratare pune parola in URL (GET)
- **Unde:** `/ro/login`; `<form>` fara `method`/`action` (verificat: `{"method":null,"action":null}`).
- **Ce se intampla:** la primul login al lui Mihai (pagina abia compilata in dev, JS inca neincarcat), clicul pe „Intra in cont” a facut submit nativ GET: URL-ul a devenit `/ro/login?email=mihai.ionescu%40demo.ro&password=<parola>`. Autentificarea nu s-a facut, iar parola a ajuns in bara de adrese / istoric / loguri de server si proxy. Pe productie se poate intampla pe conexiuni lente sau cand JS-ul pica.
- **Ce ar trebui:** parola nu trebuie sa poata ajunge niciodata in URL.
- **Dovada:** rezultatul pasului `q\20.js` (URL-ul dupa submit, parola mascata de mine in log).
- **Propunere:** `method="post"` (si `action` catre un endpoint care raspunde corect sau o pagina care ignora corpul) pe formularele de login / inregistrare / resetare; butonul de submit dezactivat pana la hidratare.

### SD-11 · P1 · defect — Recenzia pleaca cu 5 stele la primul clic, fara alegere si fara confirmare
- **Unde:** `/ro/requests/<id>/offers` dupa „Confirma livrarea”; `apps/frontend/src/app/[locale]/_components/client-fulfillment.tsx:44` (`useState(5)`).
- **Ce se intampla:** am apasat „Trimite recenzia” fara sa aleg stele si fara text (test de validare). S-a salvat imediat `rating=5, comment=null` (tabela `reviews`), fara posibilitate de modificare. Un client care apasa din greseala da o nota maxima falsa; scorurile firmelor devin umflate.
- **Ce ar trebui:** nicio stea preselectata; butonul activ doar dupa alegerea notei; eventual confirmare.
- **Dovada:** `SD-07\04-mihai-dbg.png` („Recenzie ★★★★★ ·”); rand `reviews` `d38fbcba-…` creat la 19:26:42.
- **Propunere:** `useState<number | null>(null)` + validare; optiune de editare a recenziei cateva zile.

### SD-12 · P1 · UX — Clientul nu afla ca nicio firma nu-i acopera zona (Cluj-Napoca)
- **Unde:** publicare si pagina cererii `a4837037-…` (SD-05).
- **Ce se intampla:** cererea din Cluj-Napoca (firmele active sunt in Bucuresti, raza 50 km) s-a publicat fara avertisment. Pagina spune „Asteptam firmele. Cererea e vizibila firmelor verificate din zona ta. Expira pe 19 noiembrie daca nu o preia nimeni.” — fals in practica: firma D nu o vede (lipsa din lista, 404 la link direct, afisat ca „Nicio cerere disponibila momentan.”). In `ro.json` nu exista niciun text de tip „nicio firma in zona”.
- **Ce ar trebui:** la Sumar / dupa publicare: „Momentan nu avem firme partenere care lucreaza in zona ta. Publicam cererea oricum si te anuntam daca apare una / te anuntam inainte de expirare.”
- **Dovada:** `SD-05\…-mihai-published.png`, `SD-05\…-ownerd-direct-cluj.png`.
- **Propunere:** numarare de firme eligibile (aceeasi interogare ca la marketplace) la Sumar si pe pagina cererii; e-mail catre client si admin cand o cerere nu are nicio firma eligibila.

### SD-13 · P2 · defect — Fisa preluarii la firma ramane „OFERTA TRIMISA” dupa acceptare si dupa livrare; dupa „Marcheaza ca livrata” nu apare nimic in loc
- **Unde:** `/ro/marketplace/claims/821ddfcf-…`.
- **Ce se intampla:** dupa ce clientul a acceptat, eticheta de sus a ramas „OFERTA TRIMISA” (in DB `claim_slots.status = OFFER_SENT`), iar blocul „TERMEN PENTRU OFERTA (SLA)” continua sa spuna „Oferta a fost trimisa…”. Dupa „Da, am livrat” butonul dispare si nu apare niciun mesaj „Livrata — asteptam confirmarea clientului (finalizare automata in 14 zile)”. Abia dupa confirmarea clientului apare „FINALIZATA”. Clientul vede corect „ACCEPTATA” / „LIVRATA”.
- **Dovada:** `SD-03\…-ownerd-firm-after-accept.png`, `SD-03\…-ownerd-firm-delivered.png`.
- **Propunere:** eticheta din starea cererii (ACCEPTED / DELIVERED_BY_COMPANY) cand oferta firmei e cea acceptata; bloc „Ce urmeaza” si la firma.

### SD-14 · P2 · UX — Dupa prima oferta cererea dispare din marketplace; clientul nu e avertizat
- **Unde:** setarea `claims_open_after_first_offer = false`; pagina cererii: „Cererea nu mai apare in lista firmelor, deci firme noi nu o mai pot vedea.”
- **Ce se intampla:** dupa oferta firmei D (1 din 3 locuri ocupate) cererea a trecut in OFFERS_RECEIVED si nu mai poate fi preluata de alte firme. Promisiunea de pe pagini („Trei firme. Trei oferte. Una langa alta.”) nu se tine daca prima firma raspunde repede; clientul afla doar dintr-o fraza discreta.
- **Propunere:** decizie de produs (PO); macar un text clar la publicare si pe pagina comparatiei („Ai primit o oferta; alte firme nu mai pot prelua cererea”) sau o fereastra minima de timp in care raman deschise locurile.

### SD-15 · P2 · UX — Dupa finalizare clientul nu mai are nicio cale de reclamatie / disputa
- **Unde:** pagina ofertei acceptate. Butonul „Proiectul s-a blocat?” exista in starile ACCEPTATA (client si firma); dupa confirmarea livrarii dispare si nu e inlocuit de nimic (si la demo KITCHEN Cluj finalizata).
- **Ce se intampla:** confirmarea livrarii e un singur clic fara dialog („Confirma livrarea” → FINALIZATA direct, in timp ce firma are dialog cu „nu se poate anula”). Daca apare o problema in garantie (24 de luni in oferta), clientul nu are buton.
- **Propunere:** dialog de confirmare la client cu „Am verificat mobilierul”; buton „Raporteaza o problema” si dupa finalizare (macar in perioada de garantie).

### SD-16 · P2 · defect — Sesiunea firmei a cazut de 3 ori in ~25 de minute; actiunile esueaza fara niciun mesaj
- **Unde:** `owner.d`; `POST /api/v1/auth/refresh` → 401, apoi `POST /api/v1/claims` → 401.
- **Ce se intampla:** de trei ori sesiunea `owner.d` a fost invalidata (refresh 401). In cazul preluarii, clicul pe „Da, preiau cererea” a esuat cu 401 si pagina a ramas pe loc, fara mesaj si fara redirect la login. Cauza neclarificata: alt agent folosea in paralel acelasi cont, iar `token.service.ts:71` revoca toata familia la refolosirea unui refresh token (posibil si o cursa intre doua cereri de refresh paralele din aceeasi pagina). **De verificat** (cursa de refresh in `api.ts`).
- **Ce ar trebui:** la 401 definitiv → redirect la login cu mesaj „Sesiunea a expirat” si revenire la pagina; refresh serializat (o singura cerere in zbor).

### SD-17 · P2 · UX — Pe pagina unei cereri acceptate / livrate / finalizate scrie in continuare „EXPIRA 19 nov. 2026, 23:59”
- **Unde:** `/ro/requests/e65f064d-…` in starile ACCEPTATA, LIVRATA, FINALIZATA.
- **Propunere:** ascuns campul „Expira” dupa acceptare (sau inlocuit cu „Acceptata pe …”).

### SD-18 · P2 · UX — Lista „Cererile mele”: ciornele nu apar; cererile finalizate arata „nicio firma”
- **Unde:** `/ro/requests`.
- **Ce se intampla:** filele sunt Toate / Active / In lucru / Finalizate / Expirate — nicio fila pentru ciorne, deci clientul nu-si vede si nu-si poate sterge ciornele (singurul loc e dialogul „Ai o cerere inceputa” din formular, cu o singura ciorna). Cererea mea finalizata (SD-03) si demo KITCHEN Cluj arata „nicio firma · o oferta” desi au avut firma castigatoare.
- **Propunere:** fila „Ciorne” cu Sterge; contorul de firme sa includa firma acceptata.

### SD-19 · P2 · UX — Cererea expirata se poate doar republica identic (fara editare)
- **Unde:** demo „Masa — Voluntari” (EXPIRATA): „O poti republica o singura data, cu un nou termen de expirare.” + „Republica”, dar „In acest stadiu cererea nu mai poate fi editata.”
- **Ce se intampla:** clientul nu poate ajusta bugetul / termenul / mesajul inainte sa republice o cerere care n-a atras nicio firma; nu e spus ce se intampla cu raspunsurile vechi. N-am apasat „Republica” (date demo). Tot aici apare irelevant „Preluarile active ale firmelor vor fi anulate” la stergere.
- **Propunere:** „Republica cu modificari” (deschide formularul precompletat).

### SD-20 · P3 · text — Piesa individuala e numita „camera” in mai multe locuri
- **Unde:** Sumar „2 camere — Dormitor, Birou” si „O camera — Noptiere” (cosul spunea corect „o camera · o piesa”); formularul de oferta „Pret pe fiecare camera” pentru Birou (piesa); titlul previzualizat „Dormitor + Birou (piesa) — Bucuresti” vs. titlul publicat „Dormitor + Birou — Bucuresti”.
- **Propunere:** „camere si piese” / „Pret pe fiecare camera sau piesa”.

### SD-21 · P3 · text — Rezumatul configuratorului 3D fara diacritice in textul vazut de firme
- **Unde:** „Configurat 3D: 160 x 80 x 80 cm, 1 coloana, 3 sertare, finisaj stejar”; „1 zona deschisa”; demo „Masuta cafea”.
- **Propunere:** textul generat cu diacritice si „×”.

### SD-22 · P3 · text — Date in format american in dialogul de acceptare si in „Acordul vostru”
- **Unde:** dialog „Accepti oferta…”: „Valabila pana la 11/26/2026”; „Acceptata pe 11/12/2026” (client si firma), langa „Acceptata pe 12 noiembrie 2026” pe aceeasi pagina. Dialogul nu arata garantia.
- **Propunere:** formatter `ro-RO` comun.

### SD-23 · P3 · text — Avertismentul pentru telefon/e-mail trimite la „pasul Contact”, care nu exista
- **Unde:** Date generale → „Mesaj pentru firme”: „…adauga-le la pasul Contact…”. Pasii sunt Pornire / Camere / Detalii / Fisiere / Date generale / Sumar; contactul e sectiunea „Preferinte de contact” de mai jos.
- **Dovada:** `SD-04\05-mihai-date-generale.png`. Mascarea in sine merge corect („contact ascuns” in lista, detaliu si API; vizibil dupa preluare).

### SD-24 · P3 · UX — E-mailurile „Mesaj nou” / „Oferta ta a fost acceptata” pleaca la toti membrii firmei
- **Unde:** Mailpit: colegul `audit.sd.1` (angajat de incredere, nu responsabil) a primit „Mesaj nou — Living” si „Oferta ta a fost acceptata”; la firma A, 5 membri au primit acelasi „Mesaj nou”.
- **Propunere:** trimis responsabilului + proprietarului; restul optional.

### SD-25 · P3 · UX — Nicio notificare / e-mail catre firma cand apare o cerere noua in zona; niciun e-mail „Cererea ta a fost publicata” catre client
- **Unde:** Mailpit dupa publicarile SD-03/04/05: firma D n-a primit nimic pana la preluare; clientul a primit primul e-mail abia la preluare.
- **Propunere:** rezumat/alerta pentru firme (respectand intarzierea planului); confirmare de publicare pentru client.

## 3. Top 10

1. **Firma D nu poate trimite oferte** — matrice de permisiuni goala si fara valori implicite; nici proprietarul nu poate (SD-01). Fallback in backend + seed reparat.
2. **Parola in URL** la login trimis inainte de hidratare (SD-10). `method="post"` + buton dezactivat pana la hidratare.
3. **Recenzie de 5 stele trimisa implicit** (SD-11). Fara stea preselectata.
4. **Client fara firme in zona nu e anuntat** (SD-12).
5. **Proforma: 500 la descarcare si e-mail fara atasament, desi pagina zice ca a fost trimisa** (SD-06) — de verificat pe productie.
6. **Invitatie de coleg inexistenta** (cont de firma creat separat, eroare „Nu am gasit ce cauti.”, niciun e-mail) (SD-02).
7. **Stari gresite la firma dupa acceptare/livrare** (SD-13) si „Expira” pe cereri acceptate (SD-17).
8. **Sesiune pierduta + actiuni care esueaza tacut** (SD-16).
9. **Onboarding lipsa pentru firma noua + proba neexplicata** (SD-03), raza needitabila / coordonate de mana (SD-04), portofoliu fara upload (SD-05).
10. **Dupa finalizare: fara reclamatie/disputa; confirmarea livrarii fara dialog** (SD-15); portofel fara istoric (SD-07).

## 4. Ce am lasat schimbat (local)
- Firma D: lucrare in portofoliu „[TEST AUDIT SD-01] Bucatarie din MDF vopsit” (imagine `https://example.test/…`, rupta); membru nou `audit.sd.1@example.test` (cont creat de mine, rol Angajat de incredere, confirmat); **matricea de permisiuni: am bifat cele 5 casute din coloana PROPRIETAR** (altfel firma nu putea oferta).
- Comanda #2E0361EF (10 credite, transfer) — confirmata apoi de coordonator, factura MM-11.
- Cereri Mihai: SD-03 Living `e65f064d-…` FINALIZATA (recenzie 5 stele fara text); SD-04 Dormitor+Birou `2a6b33e0-…` OFFERS_RECEIVED (preluata de D, oferta 12.500 RON trimisa, neacceptata, preluare `778e3bb9-…`); SD-05 Noptiere Cluj `a4837037-…` IN_MARKETPLACE (expira 19 nov).
- Credite firma D la final: balance 178, reserved 21 (11 pe SD-04 + 10 pe o preluare a altui agent).
- N-am apasat „Am platit”, „Republica”, nu am deschis disputa, nu am sters ciorne (nu exista vizibile), nu am schimbat raza (fara buton de editare; stergerea singurei locatii ar fi afectat celalalt agent).

## 5. N-am apucat / n-am testat
- Descarcarea facturii MM-11 si a PDF-ului ofertei (PDF-ul ofertei la client a dat 500 o data, intr-un interval cu backend instabil — de verificat).
- Ce vede colegul pe o preluare atribuita lui; schimbarea rolului.
- Dialogul „Proiectul s-a blocat?” (n-am deschis disputa, conform regulilor).
- Varianta mobil 390 px.
