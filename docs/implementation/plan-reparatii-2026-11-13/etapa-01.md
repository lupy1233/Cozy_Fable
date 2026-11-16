# Etapa 1 — Opt reparații grave și scurte

Locurile 1–8 din ordinea ta. Dimensiunile cu virgulă se citesc corect, fișierele respinse spun de ce, firma vede fișierele înainte să plătească, iar recenzia nu mai pleacă singură cu 5 stele.

- Mărime: 12,75 zile de lucru
- Module atinse: backend/billing, backend/claims, backend/fulfillment, backend/legal, backend/marketplace, backend/prisma seed, backend/requests, backend/uploads, frontend/client-fulfillment, frontend/company, frontend/configurator, frontend/configurator/piece3d, frontend/dashboard, frontend/hooks, frontend/lib, frontend/marketplace, frontend/marketplace-claims, frontend/requests, frontend/ui, frontend/wallet, shared/company-permissions, shared/questionnaire
- Tabele atinse: attachments, claim_slots, company_credit_wallets, project_sizing_config, request_items, request_project_cases, request_rooms, requests, reviews, subscription_plans, subscriptions, system_settings
- Presupuneri: Regula primei oferte (nr. 3) se schimbă, cum ai hotărât: cererea rămâne deschisă până se ocupă cele 3 locuri, iar întârzierea pe plan dispare. La blat (nr. 4) intră acum doar textul; opțiunile noi vin cu versiunea nouă a formularului, în etapa 6.
- Gata când: „1,6” scris într-un câmp de dimensiuni rămâne 1,6 în toate cele 28 de fluxuri. Un fișier respins arată motivul, iar firma vede fișierele cererii înainte de preluare. Testele existente trec, plus cele noi pentru fiecare reparație.

## 1. Virgula zecimală e aruncată din toate câmpurile de dimensiuni (`b1`, P1)

- Mărime: 1,5 zile · risc mic
- De ce contează: „1,6” devine 16, „150,5” devine 1505 sau maximul permis. Valorile mici trec de verificare de zece ori mai mari. Găsit separat de toți cei șapte agenți de pe producție.
- Cauza: Toate câmpurile de dimensiuni sunt câmpuri numerice ale browserului, care nu acceptă virgula și o aruncă, așa că „1,6” ajunge 16. În 3D, numărul prea mare care rezultă e apoi tăiat fără niciun semn la maximul permis.
- Ce s-a văzut în cod: Sunt cinci locuri separate, nu o singură componentă: câmpul comun de dimensiuni din pașii camerelor și patru câmpuri proprii din 3D (dulapuri, mobilier, catalog, dimensiunile cu lacăt și numărul de zone). În 3D valoarea prea mare e tăiată fără niciun mesaj la maximul permis. Tipul de întrebare „număr simplu” există în cod, dar nu e folosit în niciun flux azi.
- Risc: Un câmp text poate primi caractere pe care cel numeric le bloca; trebuie testat că o ciornă veche cu numere se afișează la fel.

**Pași**

1. Adaug în apps/frontend/src/lib un singur cititor de numere care acceptă virgula și punctul (înlocuiește „,” cu „.”, taie spațiile, respinge textul cu două separatoare sau cu litere).
2. Trec toate cele cinci câmpuri pe type="text" cu inputMode="decimal" și pattern pentru cifre, virgulă și punct, ca telefonul să arate tastatura numerică cu virgulă.
3. Câmpul comun din camere păstrează ce a tastat omul într-o ciornă locală (ca în 3D) și scrie valoarea în ciornă doar când textul se poate citi; altfel arată mesajul „Scrie un număr, de ex. 2,5”.
4. În 3D, o valoare în afara intervalului nu mai e tăiată pe tăcute: rămâne valoarea veche și apare lângă câmp mesajul cu intervalul permis (sau, după răspunsul PO, se ajustează cu mesaj vizibil).
5. Afișez valorile cu virgulă în română (formatarea după limbă), fără să schimb ce se salvează (tot număr în metri sau centimetri).
6. Adaug textele noi în ro.json și en.json.

**Unde în cod**

- apps/frontend/src/components/configurator/step-renderer.tsx:415 — câmpul comun de dimensiuni din pașii camerelor (type=number, citire cu Number(raw) la :428)
- apps/frontend/src/components/configurator/piece3d/configurator3d-step.tsx:102 — DimensionControl: commit cu Number(raw) pe un câmp type=number (:131); la fel LockableSize :251/:261 și ZoneCountInput :310/:319
- apps/frontend/src/components/configurator/piece3d/furniture-controls.tsx:23 — SizeInput (masă, bancă, pat etc.), type=number, Number(draft)
- apps/frontend/src/components/configurator/piece3d/catalog-controls.tsx:8 — CatalogSize (canapea, fotoliu, taburet, lavoar, hol): type=number și tăiere tăcută la min/max la :15
- apps/frontend/src/components/configurator/step-renderer.tsx:456 — tipul de întrebare „number”, același tipar (nefolosit azi în fluxuri, dar de reparat la fel)

**Cum se verifică**

- Test unitar pentru cititor: „1,6”, „1.6”, „ 150,5 ”, „1,2,3”, „abc”, „” și „0”.
- Teste de componentă pentru câmpul comun și pentru câmpul din 3D: „150,5” rămâne 150,5 și nu se mai transformă în maxim.
- Verificare manuală pe un telefon cu tastatură în română (virgula apare și e acceptată).

**Legături**

- nr. 41 (`c4`): aceleași câmpuri de dimensiuni și aceeași afișare a unității m/cm
- nr. 44 (`l1`): limitele din 3D și tăierea la maxim sunt în aceleași componente
- nr. 39 (`b9`): mesajele de validare ale câmpurilor de dimensiuni se rescriu după ce citirea e corectă
- nr. 38 (`b10`): „Fișa cererii” afișează valoarea citită din aceste câmpuri

**Alegeri mărunte făcute fără PO (se pot schimba)**

- În 3D, ce facem când clientul scrie o dimensiune peste limita piesei? → Refuz cu mesaj, rămâne valoarea veche. Clientul vede limita și corectează singur; nicio valoare nu se schimbă fără știrea lui.

## 2. Fișierele respinse dispar fără niciun mesaj (`b5`, P1)

- Mărime: 2 zile · risc mic
- De ce contează: Un fișier prea mare sau de tip nepermis pur și simplu nu apare. La „Am deja un proiect” clientul rămâne blocat fără să afle de ce.
- Cauza: Interfața nu verifică tipul și mărimea fișierului înainte să-l trimită și nu afișează nicăieri refuzul serverului: fișierul pur și simplu nu apare. Pe pasul general nu se arată nici câte locuri au mai rămas.
- Ce s-a văzut în cod: În plus față de audit: tipul și mărimea sunt refuzate de serverul de la intrare cu o eroare generică de validare, nu cu codurile „fișier prea mare / tip nepermis”, deci și o listă de mesaje pe coduri n-ar prinde cazul. Încărcarea mai multor fișiere deodată pe pasul Fișiere folosește o singură operație, care ține minte doar ultimul fișier. Mesajul „Ai atins limita de 10 atașamente” e greșit: limita reală crește cu numărul camerelor. Numele neutre văzute la firmă (SA-29) sunt o decizie scrisă, nu o eroare.
- Risc: Pe Windows unele fișiere vin fără tip cunoscut (de ex. .dwg sau .heic), deci verificarea trebuie să se uite și la extensie, nu doar la tip.

**Pași**

1. Pun în zona de încărcare o verificare înainte de trimitere, cu limitele comune din shared (tipuri permise, 25 MB, fișier gol), și întorc separat fișierele refuzate cu motivul.
2. Sub zona de încărcare afișez o listă „Nu am putut adăuga” cu numele fiecărui fișier și motivul (tip, mărime, limită atinsă, scanare eșuată, eroare de rețea cu „Reîncearcă”), mapată pe codurile de eroare și pe eroarea de validare.
3. Încarc fișierele pe rând, fiecare cu propria stare, ca refuzul unuia să nu-l ascundă pe altul, și arăt pe pasul general câte locuri mai sunt.
4. Pe rândul unui fișier respins la scanare afișez motivul și mărimea reală („sub 1 KB” în loc de „0 KB”); verific separat de ce un PNG valid foarte mic a fost respins la curățarea imaginii.
5. După „Elimină” scot imediat rândul din listă și împiedic o salvare a ciornei aflată pe drum să aducă înapoi lista veche.
6. Corectez textul despre limită ca să spună numărul real de locuri rămase.

**Unde în cod**

- apps/frontend/src/components/configurator/uploads-step.tsx:36 — fiecare fișier pornește aceeași încărcare, fără tratarea erorii; se afișează doar „Se încarcă…” (:101)
- apps/frontend/src/components/configurator/room-sketch-upload.tsx:75 — eroarea e înghițită; comentariul spune că se vede, dar nu e afișată nicăieri
- apps/frontend/src/components/ui/dropzone.tsx:47 — fișierele trase cu mouse-ul nu sunt filtrate după tip sau mărime
- apps/backend/src/modules/requests/dto/request.dto.ts:250 — tipul și mărimea sunt refuzate la intrare cu eroare generică de validare, înaintea codurilor dedicate din uploads.service.ts:91
- apps/frontend/src/hooks/use-requests.ts:120 — încărcarea (cerere de link, trimitere, confirmare repetată cât durează scanarea) și ștergerea (:146), care doar reîmprospătează lista
- apps/frontend/src/messages/ro.json:1251 — „Ai atins limita de 10 atașamente”, deși limita reală e 10 + 8 pe cameră (packages/shared/src/request.schemas.ts:304)

**Cum se verifică**

- Test de componentă: un .txt și un fișier de 30 MB trase în zonă apar în lista de refuzate cu motivul, fără apel la server.
- Test: trei fișiere deodată, unul refuzat de server — celelalte două apar, iar al treilea are mesaj.
- Test: după „Elimină”, rândul dispare imediat și nu revine.
- Verificare manuală pe local cu „Am deja un proiect”: mesajul spune de ce nu se poate continua.

**Documente de adus la zi**

- 02-technical-invariants.md §3.4 (contrazice): Invarianta scrie „10 fișiere/cerere”; codul permite 10 + 8 pe cameră după feedbackul PO din 2026-07-13, iar invarianta nu a fost actualizată. Reparația nu schimbă limita, doar o afișează corect.

**Legături**

- nr. 7 (`a2`): firma vede fișierele înainte de preluare doar dacă ele au ajuns corect pe cerere
- nr. 53 (`c14`): cele două ecrane de încărcare la rând pe aceeași piesă (L7-20) țin de reducerea ecranelor
- nr. 39 (`b9`): mesajele noi de eroare trebuie să aibă același ton cu restul validărilor

**Alegeri mărunte făcute fără PO (se pot schimba)**

- Firma trebuie să vadă numele original al fișierului după ce preia cererea? → Păstrez nume neutre, mai lizibile. Firma vede „Fișier 1 (PDF)” în loc de „attachme….pdf”; regula de confidențialitate rămâne la fel.

## 3. După prima ofertă, cererea se închide pentru celelalte firme (`a1`, P1)

- Mărime: 2 zile · risc mediu
- De ce contează: Regulile publice de pe producție o spun explicit. Dacă prima firmă ofertează repede, clientul primește o singură ofertă, nu trei. Planul de abonament întârzie în plus cererile (local: 60 de minute pe SILVER, 30 pe GOLD, 0 pe PLATINUM), fără ca firma sau regulile să spună asta.
- Cauza: Regula tehnică de bază spune că o cerere care a primit deja o ofertă nu mai poate fi preluată, chiar dacă mai sunt locuri libere; comutatorul care ar ține cererea deschisă există, dar e oprit. Firma care nu mai vede cererea primește mesajul general „Nicio cerere disponibilă”, iar întârzierea pe plan nu e spusă nicăieri, conform unei decizii vechi.
- Ce s-a văzut în cod: Comportamentul nu e o greșeală de cod, ci regula scrisă în invarianta tehnică 3.1 (cererea se poate prelua doar cât e „în piață” sau „parțial preluată”). Comutatorul de admin există deja și e oprit intenționat până la decizia PO (docs/04, nota E-admin-platform-10). Aceeași regulă scoate cererea din piață și după o cerere de modificare (SA-15). Întârzierea pe plan e decizia Î2, iar tăcerea despre ea față de firme e decizia Î3.
- **După răspunsurile PO (2026-11-13):** Cererea rămâne deschisă până se ocupă cele 3 locuri. Întârzierea pe plan dispare: toate planurile văd cererile imediat. Pun întârzierea la 0 pentru toate planurile; setarea rămâne în Admin, dacă o vrei vreodată înapoi. Amândouă schimbă reguli scrise ca finale, așa că le trec în jurnalul de decizii cu data răspunsului tău. Pe producție valorile se schimbă din Admin, la lansarea etapei.
- Risc: Cu cererea deschisă după prima ofertă, o firmă care preia târziu poate pierde cursa dacă clientul acceptă repede (creditele i se returnează, dar a muncit degeaba); trebuie spus în dialogul de preluare.

**Pași**

1. După decizia PO: schimbă valoarea implicită claims_open_after_first_offer la true în setting-defaults.ts și seed.ts și pornește setarea din Admin pe producție (nu cere deploy pentru producție, doar setarea).
2. Actualizează docs/02 §3.1 (lista stărilor permise), docs/03 §4.8 și adaugă o intrare nouă în docs/07; testele existente pe comutator (claims.helpers.spec, marketplace.service.spec, requests.visibility.spec) acoperă deja ambele valori.
3. Pe pagina din piață: când cererea nu mai e disponibilă, backendul întoarce un cod dedicat (de ex. REQUEST_NO_LONGER_CLAIMABLE, doar dacă firma o acoperă pe rază) și pagina spune „Cererea s-a închis: locurile s-au ocupat sau clientul a ales deja” în loc de „Nicio cerere”.
4. Pe cardul „Cine vede cererea” al clientului: text clar pentru fiecare motiv de închidere (locuri ocupate / ofertă acceptată / regula primei oferte, dacă rămâne).
5. Întârzierea pe plan: implementează varianta aleasă de PO la a doua întrebare (paragraf în regulile publice și/sau mesaj pe pagina goală a firmei).
6. Verifică valorile reale de întârziere de pe producție (subscription_plans.marketplace_gating_delay_minutes) din Admin și notează-le în CHANGELOG.

**Unde în cod**

- apps/backend/src/modules/claims/claims.constants.ts:8 — lista stărilor în care cererea se poate prelua (doar IN_MARKETPLACE, CLAIMED_PARTIAL); :14-21 varianta cu OFFERS_RECEIVED/NEGOTIATION, pornită de comutator
- apps/backend/src/common/settings/setting-defaults.ts:11 — claims_open_after_first_offer: false
- apps/backend/src/modules/marketplace/marketplace.service.ts:234 — filtrul pe stare; :238 — întârzierea pe plan; :103-107 — 404 generic când cererea nu mai e vizibilă
- apps/backend/src/modules/requests/requests.service.ts:552-557 — cardul „Cine vede cererea” pentru client, aceeași regulă
- apps/frontend/src/messages/ro.json:1261 — „Cererea nu mai apare în lista firmelor…”; :6745 — regula publică „afterOfferClosed”; :7 și :739 — promisiunea „Trei firme. Trei oferte.”
- apps/frontend/src/app/[locale]/marketplace/[id]/page.tsx:46-62 — orice eroare devine „Nicio cerere disponibilă momentan”

**Cum se verifică**

- Test de integrare: cerere cu o ofertă trimisă și 2 locuri libere rămâne în lista firmei D și se poate prelua; a 4-a preluare dă CLAIM_SLOTS_FULL.
- Test: după acceptare, firma care a preluat târziu fără ofertă primește creditele înapoi.
- Verificare manuală: pagina din piață a unei cereri închise arată motivul, nu „Nicio cerere”.

**Documente de adus la zi**

- 02-technical-invariants.md §3.1 (contrazice): Invarianta spune literal: claim doar dacă status ∈ {IN_MARKETPLACE, CLAIMED_PARTIAL}. Pornirea comutatorului cere amendarea invariantei (docs/04, nota E-admin-platform-10).
- 07-decisions-log.md Î2 Gating delay, Î3 Transparență gating (contrazice): Î3: firma vede doar „publicată acum X”, fără mențiuni despre planuri. Mesajul propus de audit („pe planul tău cererile apar după X minute”) schimbă Î3.
- 03-business-rules.md §4.8, §4.10 (de actualizat): §4.8 „maximum 3 firme”; §4.10 repetă transparența din Î3.

**Legături**

- nr. 19 (`a4`): Refuzul unei oferte eliberează un loc; are sens doar dacă cererea poate fi preluată din nou după prima ofertă.
- nr. 26 (`a6`): Același card „Cine vede cererea” și aceleași texte pentru client.
- nr. 60 (`i3`): Regulile publice pentru firme se rescriu oricum la i3; paragraful despre prima ofertă și întârziere intră acolo.
- nr. 52 (`h1`): Pagina goală a firmei noi e același ecran pe care ar apărea explicația întârzierii.

**Întrebări și răspunsuri**

- **[a1-1] Până când poate fi preluată o cerere de alte firme după ce a venit prima ofertă?**
  - Context: Azi cererea se închide la prima ofertă, chiar dacă mai sunt 2 locuri libere; e scris în regula tehnică de bază și în regulile publice. Prima pagină promite însă „Trei firme. Trei oferte.”
  - Variante: 1) Rămâne deschisă până se ocupă cele 3 locuri · 2) Rămâne deschisă până la 3 locuri, dar cel mult X ore după prima ofertă (de ex. 48 h) · 3) Păstrez regula de azi și schimb promisiunea
  - **Răspunsul PO:** Rămâne deschisă până se ocupă cele 3 locuri (recomandarea). Clientul are șansa la trei oferte; firma care preia târziu riscă să nu apuce să oferteze dacă clientul acceptă repede (primește creditele înapoi). Se schimbă regula tehnică 3.1 și regulile publice. Lucru: o setare + texte, ~2 zile.
- **[a1-2] Spunem firmelor că pe planul lor cererile noi apar cu întârziere?**
  - Context: Azi firma pe GOLD sau SILVER vede „Nicio cerere disponibilă” în primele 30 sau 60 de minute, fără explicație; o decizie scrisă a ales intenționat să nu se pomenească planurile.
  - Variante: 1) Da, în regulile publice și pe pagina goală a firmei · 2) Doar în regulile publice pentru firme · 3) Nu, rămâne decizia de azi
  - **Răspunsul PO (altceva):** „vreau sa nu mai existe acest gatekeep de minute, toate tier-urile sa primeasca ofertele imediat cum apar.”

## 4. Blatul: scrie „Opțional”, dar e obligatoriu; la spălătorie primește materiale de corp (`c6`, P1)

- Mărime: 0,25 zile · risc mic
- De ce contează: La bucătărie nu te lasă să continui fără răspuns, deși textul spune „Opțional”. La spălătorie și balcon blatul primește PAL / MDF de corp, iar „MDF înfoliat” e marcat „Recomandat” și pe blat.
- Cauza: Întrebarea despre blat de la bucătărie e obligatorie, dar textul de sub ea spune „Opțional”. La spălătorie și balcon blatul e tratat ca o piesă de mobilier oarecare, așa că primește lista de materiale pentru fronturi (cu „Recomandat” pe MDF înfoliat când camera nu e aerisită).
- Ce s-a văzut în cod: Exact ca în audit. În plus: la bucătărie blatul nu adaugă nimic la costul în credite (toate opțiunile de blat au 0 puncte în configurația de scor), deci a-l face opțional sau a-i adăuga „Decide firma” nu schimbă costul.
- Împărțită în două: Acum intră textul: dispare „Opțional” și eticheta „Recomandat” de pe blat. Opțiunile noi de blat vin în etapa 6, cu versiunea nouă a formularului.
- Risc: Partea imediată e doar text și un badge; partea din versiunea nouă schimbă felul în care se salvează blatul de la spălătorie și balcon.

**Pași**

1. Acum, fără versiune nouă: scot „Opțional —” din subtitlul blatului în ro.json și en.json (textul spune doar de ce ajută blatul).
2. Acum, fără versiune nouă (schimbare doar de afișare, ca la regula din docs/12 §4): exclud pașii de blat (materialCountertop, materialWorktop) din withRecommendedMaterial în laundry.v2 și balcony.v2.

**Unde în cod**

- packages/shared/src/questionnaire/flows/kitchen.v2.ts:184 — pasul countertop fara optional, refolosit de bucataria v3 (kitchen.v3.ts:72, v2('countertop'))
- apps/frontend/src/messages/ro.json:4341 — subtitlul „Opțional — ajută firma să estimeze mai exact.” (cheia e comuna pentru bucataria v2 si v3)
- packages/shared/src/questionnaire/flows/laundry.v2.ts:43 — piesa COUNTERTOP primeste materialul prin pieceConfigSteps (set de corp)
- packages/shared/src/questionnaire/flows/laundry.v2.ts:125 — withRecommendedMaterial pune „Recomandat” pe MDF_INFOLIAT pe toti pasii material*, inclusiv blatul
- packages/shared/src/questionnaire/flows/balcony.v2.ts:43 — materialWorktop, acelasi set de corp
- packages/shared/src/questionnaire/flows/per-piece.ts:69 — withRecommendedMaterial aplica badge-ul oricarui pas care incepe cu „material”

**Cum se verifică**

- Test în engine: blatul din bucătăria versiunii noi acceptă „Decide firma”; versiunile vechi resping valoarea.
- Test: la spălătoria neaerisită, pasul de blat nu mai are „Recomandat”, iar celelalte piese îl păstrează.
- Test de derivare: blat HPL la spălătorie → piesa cu ALTUL și descrierea „Blat: HPL”.

**Legături**

- nr. 51 (`c7`): „Decide firma” la blat e aceeași opțiune comună din c7.
- nr. 28 (`c1`): Setul de blaturi la spălătorie / balcon intră în aceeași versiune nouă cu regula de material.

**Întrebări și răspunsuri**

- **[c6-1] Blatul de la bucătărie rămâne obligatoriu?**
  - Context: Azi e obligatoriu, dar scrie „Opțional”. Blatul nu schimbă costul în credite.
  - Variante: 1) Obligatoriu, cu „Nu știu — decide firma” · 2) Opțional
  - **Răspunsul PO:** Obligatoriu, cu „Nu știu — decide firma” (recomandarea). Clientul care nu știe are o ieșire; firma primește mereu un răspuns. „Opțional” dispare din text chiar acum.
- **[c6-2] La spălătorie și balcon, blatul primește aceleași opțiuni ca la bucătărie, plus HPL compact?**
  - Context: Azi primește PAL / MDF vopsit / MDF furniruit, adică materiale de fronturi, nepotrivite pentru umezeală.
  - Variante: 1) Da, setul de blaturi · 2) Nu, rămâne setul actual
  - **Răspunsul PO:** Da, setul de blaturi (recomandarea). PAL postformat, HPL, HPL compact, cuarț, lemn masiv, decide firma; firma primește un blat realist.

## 5. Firma cu abonament expirat își pierde lista de preluări (`h2`, P1)

- Mărime: 1,5 zile · risc mic
- De ce contează: Lista e înlocuită cu mesajul de abonament expirat, deși firma are oferte trimise la care clienții așteaptă răspuns. Nicăieri nu scrie când a expirat și ce se întâmplă cu creditele. Poate cumpăra credite pe care nu le poate folosi.
- Cauza: Bariera de abonament e pusă pe toată secțiunea de preluări, deci și pe lista celor existente, nu doar pe preluarea uneia noi. Mesajele despre abonament sunt scrise diferit pe fiecare pagină și nu spun data expirării și nici ce se întâmplă cu creditele.
- Ce s-a văzut în cod: Lista de preluări e blocată pentru că toată zona „preluări” cere abonament activ; trimiterea ofertelor, conversația și fișa unei preluări nu îl cer, de aici amestecul. Tot sub aceeași barieră e și atribuirea unei preluări unui coleg. Avertizarea înainte de expirare există (7 zile, doar proprietar/manager), dar după expirare nu se mai afișează data nicăieri. Starea „activ” rămasă în baza de date după expirare nu are efect (aplicația se uită la dată).
- Risc: Dacă bariera se mută greșit, o firmă fără abonament ar putea prelua cereri noi.

**Pași**

1. Mut bariera de abonament de pe toată secțiunea doar pe preluarea nouă (și pe atribuire, după decizia PO); lista preluărilor existente se vede mereu.
2. Serverul întoarce pentru firmă data ultimei expirări a abonamentului, ca să poată fi afișată.
3. Un singur mesaj de stare, același pe Panou, Marketplace, Preluări, Portofel și Firma mea: „Abonamentul X a expirat pe … Creditele tale (N) rămân în cont, dar le poți folosi doar după reactivare. Preluările în curs le poți termina.” + buton spre reînnoire.
4. Pe panou, butonul „Mergi la marketplace” devine „Reactivează abonamentul” când nu există abonament.
5. Cumpărarea de credite fără abonament: după decizia PO (dezactivată cu explicație, sau permisă cu confirmare explicită).
6. Texte RO/EN unificate pentru abonament expirat.

**Unde în cod**

- apps/backend/src/modules/claims/claims.controller.ts:29 — bariera de abonament e pe toată secțiunea, inclusiv lista (:48) și atribuirea (:53)
- apps/backend/src/common/guards/subscription-active.guard.ts:26 — refuz fără dată sau alte detalii
- apps/frontend/src/app/[locale]/marketplace/claims/page.tsx:130 — la eroare lista e înlocuită complet de mesajul de acces blocat
- apps/frontend/src/app/[locale]/marketplace/wallet/_components/credit-packages-section.tsx:51 — cumpărarea de credite rămâne permisă fără abonament, cu o notă
- apps/backend/src/modules/billing/subscription-expiry.processor.ts:79 — avertizările se trimit doar înainte de expirare

**Cum se verifică**

- Test backend: fără abonament, lista preluărilor răspunde normal, iar preluarea nouă e refuzată.
- Verific pe local firma cu abonament expirat: același mesaj, cu data, pe toate paginile.

**Legături**

- nr. 46 (`h3`): Aceeași pagină de portofel.
- nr. 57 (`g2`): Data expirării se afișează în formatul românesc reparat acolo; tot acolo intră câmpul de dată din reofertare (SX-09).
- nr. 8 (`a5`): Atribuirea preluării unui coleg e sub aceeași barieră.

**Întrebări și răspunsuri**

- **[h2-1] Ce poate face o firmă cu abonament expirat pe preluările pe care le are deja?**
  - Context: Azi poate trimite oferte și scrie în conversație, dar nu își vede lista și nu poate atribui preluarea unui coleg.
  - Variante: 1) Termină tot ce are în curs; doar preluările noi sunt blocate · 2) Doar vede lista și răspunde în conversație; ofertele noi și atribuirile sunt blocate
  - **Răspunsul PO:** Termină tot ce are în curs; doar preluările noi sunt blocate (recomandarea). Vede lista, atribuie, trimite oferte și livrează. Clienții care așteaptă nu sunt afectați de abonamentul firmei.
- **[h2-2] Ce le spunem firmelor despre credite după ce expiră abonamentul?**
  - Context: Regula scrisă zice că creditele rămân valabile 3 luni, dar codul nu le expiră niciodată; regulile de produs o trec drept hotărâre care lipsește.
  - Variante: 1) Creditele rămân în cont fără termen; le folosești după reactivare · 2) Creditele expiră la 3 luni după abonament (regula scrisă)
  - **Răspunsul PO:** Creditele rămân în cont fără termen; le folosești după reactivare (recomandarea). Așa e codul azi; textul spune adevărul; regula de 3 luni se scoate din regulile de produs.
- **[h2-3] O firmă fără abonament activ poate cumpăra credite?**
  - Context: Azi poate, cu o notă galbenă că nu le poate folosi până nu reactivează; risc de plată fără folos imediat.
  - Variante: 1) Nu: pachetele sunt dezactivate, cu butonul „Reactivează abonamentul” alături · 2) Da, cu o confirmare explicită „Le poți folosi doar după reactivare”
  - **Răspunsul PO:** Nu: pachetele sunt dezactivate, cu butonul „Reactivează abonamentul” alături (recomandarea). Fără plăți fără folos și fără cereri de rambursare.

## 6. Recenzia pleacă cu 5 stele la primul clic; livrarea se confirmă dintr-un clic (`e2`, P1)

- Mărime: 3,5 zile · risc mediu
- De ce contează: Nota 5 e aleasă dinainte și nu se mai poate schimba. „Confirmă livrarea” închide proiectul fără întrebare, iar după aceea clientul nu mai are cum să reclame ceva.
- Cauza: Câmpul de notă are valoarea 5 de la început, iar butonul de confirmare a livrării trimite direct, fără întrebare. Raportarea unei probleme e permisă doar cât proiectul e în lucru, nu și după ce firma a marcat livrarea sau după finalizare.
- Ce s-a văzut în cod: Nota pornește de la 5 și se trimite fără alegere; confirmarea livrării e un singur clic. Singura cale de reclamație după finalizare e o recenzie sub 3 stele (deschide automat o dispută la admin). Firma primește clopoțel la recenzie, dar nu e-mail, iar fișa ei nu afișează recenzia.
- **După răspunsurile PO (2026-11-13):** Clientul primește butonul „Raportează o problemă” și după finalizare. Durata o alegi la întrebarea nouă din „Înainte de orice”. Cam o zi și jumătate în plus: un tip nou de caz pentru echipa Cozy Home.
- Risc: Dacă raportul în starea Livrată nu oprește corect ceasul, proiectul se poate finaliza automat cu o problemă deschisă.

**Pași**

1. Nota pornește goală; butonul „Trimite recenzia” devine activ doar după alegerea stelelor, iar înainte de trimitere arăt un rezumat „Trimiți nota X — nu se mai poate schimba”.
2. „Confirmă livrarea” deschide un dialog („Am verificat mobilierul; după confirmare proiectul se închide”) cu varianta „Am o problemă”.
3. „Am o problemă” deschide raportul de proiect existent (motiv „Altul” + notă), permis și în starea Livrată; comportamentul ceasului de 14 zile urmează decizia PO.
4. Pe fișa firmei, după finalizare, afișez „Livrare confirmată” și recenzia primită.
5. Texte RO/EN pentru dialog, rezumat și „Am o problemă”.

**Unde în cod**

- apps/frontend/src/app/[locale]/_components/client-fulfillment.tsx:44 — nota pornește de la 5
- apps/frontend/src/app/[locale]/_components/client-fulfillment.tsx:136 — „Confirmă livrarea” trimite direct, fără dialog și fără alternativă
- apps/frontend/src/app/[locale]/_components/client-fulfillment.tsx:119 — „Proiectul s-a blocat?” apare doar în stările Acceptată / În execuție
- apps/backend/src/modules/fulfillment/project-deadlines.ts:22 — raportul de proiect e permis doar în aceste două stări
- apps/backend/src/modules/fulfillment/fulfillment.service.ts:259 — recenzia sub 3 stele deschide disputa; altă cale de reclamație nu există

**Cum se verifică**

- Test frontend: butonul de recenzie e inactiv fără stele; confirmarea livrării cere dialog.
- Test backend: raport deschis în starea Livrată, apoi rularea finalizării automate — se comportă cum a hotărât PO.

**Documente de adus la zi**

- 07-decisions-log.md D-L1-1 (contrazice): Dacă „Am o problemă” oprește finalizarea automată la 14 zile, decizia D-L1-1 trebuie completată.

**Legături**

- nr. 22 (`e1`): Același panou de după acceptare și același dialog de livrare.
- nr. 45 (`g1`): E-mailul către firmă la recenzie și la finalizare se adaugă acolo.

**Întrebări și răspunsuri**

- **[e2-1] Când clientul apasă „Am o problemă” după ce firma a marcat livrarea, se oprește finalizarea automată de la 14 zile?**
  - Context: Azi, după 14 zile de la „livrat”, proiectul se închide singur și firma își consumă creditele, orice ar fi. Raportul de problemă nu e permis în această stare.
  - Variante: 1) Da, ceasul se oprește până când echipa Cozy Home închide raportul · 2) Nu, ceasul merge mai departe; raportul ajunge doar la admin
  - **Răspunsul PO:** Da, ceasul se oprește până când echipa Cozy Home închide raportul (recomandarea). Completează decizia scrisă despre finalizarea automată; clientul e protejat; adminul trebuie să răspundă la rapoarte.
- **[e2-2] După finalizare, clientul poate raporta o problemă (de exemplu în garanție)?**
  - Context: Azi singura cale după finalizare e o recenzie sub 3 stele, care deschide automat o dispută; altfel nu există niciun buton.
  - Variante: 1) Nu acum: recenzia sub 3 stele rămâne calea, plus un link „Contactează-ne” spre suport · 2) Da, un buton „Raportează o problemă” timp de un număr de luni după finalizare
  - **Răspunsul PO:** Da, un buton „Raportează o problemă” timp de un număr de luni după finalizare (altfel decât recomandarea: Nu acum: recenzia sub 3 stele rămâne calea, plus un link „Contactează-ne” spre suport). Regulă nouă de produs și un tip nou de caz pentru admin; +1–2 zile; adminul preia reclamațiile de garanție.

## 7. Firma nu vede fișierele cererii înainte de preluare (`a2`, P1)

- Mărime: 0,5 zile · risc mic
- De ce contează: Pozele, schițele și PDF-ul de la „Am deja un proiect” nu apar în piață, deși formularul îi spune clientului că apar. Firma plătește credite fără să fi văzut proiectul.
- Cauza: Pagina cererii din piață arată doar fișierele legate de o cameră; pozele, planurile și proiectul încărcate la pasul „Fișiere” nu țin de nicio cameră, așa că nu apar nicăieri. Serverul le trimite deja, iar fișa de lucru de după preluare le afișează.
- Risc: PDF-urile nu se curăță la încărcare și pot conține numele clientului; clientul e deja avertizat la pasul Fișiere, deci comportamentul promis nu se schimbă.

**Pași**

1. Mută componenta GeneralFiles din fișa de lucru într-un fișier comun (de ex. components/configurator/request-general-files.tsx), cu props rooms + attachments.
2. Folosește-o pe pagina din piață sub camere, cu același titlu „Fișierele cererii”; pe fișa de lucru rămâne neschimbată.
3. Pentru cererile „Am deja un proiect”, pune secțiunea de fișiere imediat sub rezumat, înaintea camerelor.
4. Verifică faptul că mascarea camerelor din piață (maskRoomForFirm) păstrează trimiterile la fișiere din răspunsuri, ca schițele de cameră să nu apară de două ori.

**Unde în cod**

- apps/frontend/src/app/[locale]/marketplace/[id]/page.tsx:120-122 — fișierele merg doar în cardurile de cameră
- apps/frontend/src/components/configurator/room-spec-card.tsx:71-78 — cardul afișează doar fișierele referite de răspunsurile camerei
- apps/frontend/src/app/[locale]/marketplace/claims/[claimSlotId]/page.tsx:717-737 — secțiunea „Fișierele cererii” (filtrul pe fișierele nereferite), doar după preluare
- apps/backend/src/modules/marketplace/marketplace.service.ts:123, 141 — toate fișierele cererii, cu nume neutre, trimise firmei înainte de preluare
- apps/frontend/src/messages/ro.json:3693 — „Fișierele sunt vizibile firmelor verificate din zona ta înainte de preluare”

**Cum se verifică**

- Test de componentă: un fișier nereferit de camere apare în secțiunea nouă pe pagina din piață, o schiță de cameră nu se repetă.
- Verificare manuală pe o cerere „Am deja un proiect” cu PDF.

**Legături**

- nr. 17 (`d1`): Aceeași pagină a cererii din piață.
- nr. 33 (`d4`): Imaginea 3D a piesei e tot un fișier al cererii; trebuie să apară o singură dată.

## 8. Cine preia cererea nu devine responsabil de ea (`a5`, P1)

- Mărime: 1,5 zile · risc mic
- De ce contează: Chiar și când o preia proprietarul, fișa spune „Neatribuit — preluarea se anulează automat în 59 de min”. O atribuire eșuată nu dă niciun mesaj. Termenul de răspuns se află abia după preluare.
- Cauza: Cererea se preia mereu „fără responsabil”, iar responsabilul trebuie ales separat în fișă în cel mult o oră, altfel preluarea se anulează. Termenul de răspuns se calculează abia în momentul preluării, deci nu se poate arăta în dialog.
- Ce s-a văzut în cod: Serverul știe deja să atribuie preluarea chiar celui care o face, dar pagina nu-i cere asta niciodată. Un angajat cu acces complet poate prelua, dar nu poate atribui nimănui, deci preluarea lui se anulează sigur dacă nu intervine conducerea. La atribuirea eșuată codul afișează un mesaj mic sub listă; cauza probabilă a lui 409 e că persoana aleasă are deja altă preluare fără ofertă.
- Risc: Un proprietar care preia mai multe cereri la rând se lovește de regula „o preluare fără ofertă de persoană”; dialogul trebuie să-i ofere clar „Atribui mai târziu”.

**Pași**

1. Dialogul de preluare: cel care preia devine responsabil implicit; proprietarul și managerul au în plus „Atribui mai târziu” sau un coleg din listă; angajatul cu acces complet preia mereu pentru el.
2. Dacă cel care preia are deja o preluare fără ofertă, dialogul spune asta înainte de confirmare și oferă „Atribui mai târziu” (doar conducerii) în loc de o eroare după.
3. Backend: detaliul cererii din piață primește data estimată a termenului de răspuns (aceeași funcție de zile lucrătoare ca la preluare), iar dialogul și panoul o afișează („ai până pe 17 nov., 23:59”).
4. Fișa de lucru: mesajul de atribuire eșuată devine alertă vizibilă lângă listă, cu textul codului primit; lista revine la valoarea reală.
5. Actualizează nota din docs/03 §4.9 că responsabilul implicit e cel care preia.

**Unde în cod**

- apps/frontend/src/app/[locale]/marketplace/[id]/page.tsx:264-266 — preluarea se trimite fără responsabil
- apps/backend/src/modules/claims/claims.service.ts:123, 241-244 — serverul acceptă un responsabil la preluare; fără el pornește ceasul de o oră
- apps/backend/src/modules/claims/claims.service.ts:226-229 — termenul de răspuns (3 sau 5 zile lucrătoare) calculat doar la preluare
- packages/shared/src/company-permissions.ts:9-10 — doar proprietarul și managerul pot atribui; angajatul cu acces complet poate prelua, dar nu-și poate atribui
- apps/frontend/src/app/[locale]/marketplace/claims/[claimSlotId]/page.tsx:401, 427-473 — lista de atribuire și mesajul de eroare mic sub ea

**Cum se verifică**

- Test de serviciu: preluare cu responsabil = cel care preia → fără ceas de o oră; a doua preluare fără ofertă → ACTIVE_CLAIM_WITHOUT_OFFER_EXISTS.
- Test de componentă: dialogul arată data termenului și opțiunile după rol.
- Verificare manuală: atribuire către un coleg ocupat arată alerta.

**Documente de adus la zi**

- 03-business-rules.md §4.9 (self-assign, atribuire în 1h) (de actualizat): Preluarea pentru tine există deja; se schimbă doar ce e implicit.

**Legături**

- nr. 30 (`a7`): Același panou și dialog de preluare, aceleași mesaje de eroare.
- nr. 52 (`h1`): Ghidul pentru firma nouă poate explica atribuirea după ce regula e fixată.

**Întrebări și răspunsuri**

- **[a5-1] Cine devine responsabil de cerere imediat după preluare?**
  - Context: Azi nimeni; dacă în o oră nu e ales cineva, preluarea se anulează. Regula „o singură preluare fără ofertă de persoană” rămâne oricum.
  - Variante: 1) Cel care preia, cu opțiunea „Atribui mai târziu” pentru proprietar și manager · 2) Mereu cel care preia, fără excepții · 3) Alegerea responsabilului obligatorie în dialogul de preluare
  - **Răspunsul PO:** Cel care preia, cu opțiunea „Atribui mai târziu” pentru proprietar și manager (recomandarea). Cazul obișnuit merge dintr-un clic; conducerea poate încă prelua pentru echipă, cu regula de o oră.

