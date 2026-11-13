# Raport CS — învelișul formularului și drumul cererii după publicare

Agent: CS · Metodă: **doar citirea codului** (nu am rulat aplicația, nu am deschis site-ul, deci nu am verificat WebGL/GPU). Repo: `E:\Cozy Fable`, branch `claude/design-canvas-frontend-2026-11-12`. Nicio modificare în repo.

Fiecare constatare de mai jos e verificată în cod (fișier:linie). Ce nu am putut confirma fără să rulez aplicația e marcat **„de verificat”**.

## 1. Ce am acoperit

| Zonă | Fișiere principale citite | Până unde | Ce NU am acoperit |
|---|---|---|---|
| Pasul Pornire (3 moduri) | `components/configurator/start-mode-step.tsx`, `configurator-wizard.tsx`, `stores/configurator-store.ts` | complet: alegere, schimbare mod, efecte asupra `hasOwnProject` / `includesPaidDesign`, ordinea fazelor | — |
| Coș (doar învelișul: bifa „am proiect”) | `room-cart-step.tsx` | bifa „Am deja un proiect pentru toată locuința” | conținutul camerelor / pieselor (alți agenți) |
| Fișiere | `uploads-step.tsx`, `room-sketch-upload.tsx`, `ui/dropzone.tsx`, `hooks/use-requests.ts`, `backend uploads.service.ts` | limite, tipuri, mesaje, obligativitate pe mod | scanarea antivirus propriu-zisă |
| Date generale | `details-step.tsx`, `budget-slider.tsx`, `address-autocomplete.tsx`, `shared/request.schemas.ts`, `backend requests/dto/request.dto.ts`, `geo.service.ts` | fiecare câmp: interfață vs Zod vs DTO | `phone-input.tsx` în detaliu |
| Sumar + publicare | `review-step.tsx`, `review-facts-card.tsx`, `requests.controller.ts`, `requests.service.ts` (publish / edit / repost), login / register / verify-email | complet pe cod | comportamentul real după login (de verificat live) |
| Ciornă | wizard + store + `requests.service.ts` (createDraft / patchDraft / discardDraft) | salvare, reluare, token mort, editare, ciorne abandonate | — |
| Panoul „Fișa cererii” | `review-rail.tsx` | etichete vs întrebări | — |
| Detaliul cererii (client) | `app/[locale]/requests/[id]/page.tsx` | complet | `RoomSpecCard` pe întrebări (alți agenți) |
| Piață (firmă) înainte și după preluare | `marketplace/[id]/page.tsx`, `marketplace.service.ts`, `marketplace/claims/[claimSlotId]/page.tsx` (parțial) | ce se vede / se ascunde | lista din piață (carduri) — superficial |
| Preluare | `claims.service.ts`, mesajele `Marketplace.apiErrors` | erori și mesaje | portofel / abonament în detaliu |
| Ofertă + comparare + pagina de start | `shared/quote.schemas.ts`, `_components/offers-comparison.tsx`, `offer-card.tsx` (parțial), `app/[locale]/page.tsx` | câmpuri, rubrici, unități, monedă, TVA | PDF-ul ofertei |
| Chat | `chat.service.ts`, `_components/chat-panel.tsx`, `shared/chat.schemas.ts` | reguli, erori | socket / timp real |
| Vocabular | `messages/ro.json` (căutare pe chei) | cerere / comandă, proiectare plătită, proiect propriu, mesaj, loc, lei / RON | `en.json` (nu am comparat sistematic) |

## 2. Constatări

### CS-01 · P1 · defect · Editarea unei cereri publicate suprascrie ciorna nouă din browser
- **Unde:** `apps/frontend/src/components/configurator/configurator-wizard.tsx:372-378` (mod editare: `loadSnapshot(buildSnapshotFromRequest(...))`); `apps/frontend/src/stores/configurator-store.ts:296-299, 572-597` (același store, persistat în `localStorage` sub cheia `mm_configurator_v1`).
- **Ce se întâmplă:** `/requests/:id/edit` folosește același store Zustand persistat ca `/requests/new`. Deschiderea editării scrie cererea publicată peste progresul unei cereri noi aflate în lucru: camere, răspunsuri, detalii și contacte. Dacă clientul iese din editare fără să salveze (linkul „Înapoi la cerere”), `localStorage` rămâne cu datele cererii editate. Următoarea vizită pe `/requests/new` le ia drept „progres”: `snapshotHasProgress` (wizard :124-130, :307, :319-336) afișează dialogul „Continui?”. Dacă alege „Continuă”, clientul pornește de fapt o copie a cererii deja publicate, cu id-urile camerelor vechi pe post de `localId`. Sincronizarea automată (:421-430) trimite apoi această copie în ciorna anonimă veche.
- **Ce ar trebui:** editarea să aibă un spațiu de stare separat (store nepersistat sau altă cheie), ca ciorna nouă să rămână neatinsă.
- **Dovadă:** wizard :377 apelează `store.getState().loadSnapshot(...)` și pentru `isEdit`. `persist` nu face diferența între modul creare și modul editare. Doar `onPublished` (:562-567) face `reset()`.
- **Propunere:** un store nepersistat pentru editare (sau `name` diferit). Alternativ, salvează snapshotul de creare înainte de editare și pune-l la loc la ieșire. De verificat live: dialogul de reluare după o editare abandonată.

### CS-02 · P1 · defect · Orice cont autentificat poate publica o cerere, inclusiv contul de firmă
- **Unde:** `apps/backend/src/modules/requests/requests.controller.ts:79-87` (`@Public()`, fără `@Roles`); `requests.service.ts:264-277` (verifică doar `userId != null`); `apps/frontend/src/components/configurator/review-step.tsx:118, 464-475` (`authed = !!me.data`, fără verificarea rolului). Ruta `/requests/new` nu are nicio gardă de rol (`requests/layout.tsx`, `_components/app-shell.tsx`).
- **Ce se întâmplă:** un utilizator de firmă (sau admin) logat vede „Publică cererea”, iar serverul acceptă. Cererea devine `IN_MARKETPLACE` cu `clientUserId` = contul firmei. Redirecționarea de după publicare (`router.push('/requests/:id')`) lovește apoi `@Roles(UserRole.CLIENT)` (controller :140-141), adică un 403, afișat ca „Nicio cerere.” Contul de firmă nu își mai poate vedea, edita sau șterge cererea, dar cererea rămâne în piață.
- **Ce ar trebui:** doar rolul CLIENT poate publica. Interfața ar trebui să spună unei firme că trebuie un cont de client.
- **Propunere:** verificare de rol în `publish` (403 cu un cod dedicat). În sumar, pentru o firmă logată: mesaj clar în locul butonului. De verificat live cu un cont de firmă (nu am voie să mă autentific).

### CS-03 · P1 · defect · Firma nu vede fișierele de proiect înainte de preluare, deși clientului i se spune că le vede
- **Unde:** `apps/frontend/src/app/[locale]/marketplace/[id]/page.tsx:119-122` (atașamentele sunt trimise doar la `RoomSpecCard`); `components/configurator/room-spec-card.tsx:71-78` (afișează doar fișierele referite de răspunsurile camerei). Backendul trimite toate atașamentele: `marketplace.service.ts:119-123, 141`.
- **Ce se întâmplă:** fișierele încărcate la pasul „Fișiere” nu sunt legate de nicio cameră (proiectul tehnic la „Am deja un proiect”, pozele generale, planurile). De aceea nu apar nicăieri pe pagina din piață. Fișa de lucru de după preluare le arată (`marketplace/claims/[claimSlotId]/page.tsx:725-732`, „Fișierele cererii”). Clientului i se spune explicit opusul: „Fișierele sunt vizibile firmelor verificate din zona ta înainte de preluare” (`ro.json:3693`), iar „Cine vede cererea” enumeră și fișierele (`ro.json:1260, 3715`). Pentru o cerere cu proiect propriu, firma vede doar insigna „Proiect propriu” și camere fără dimensiuni, deci decide preluarea (plătită în credite) fără proiect.
- **Ce ar trebui:** aceeași secțiune „Fișierele proiectului” ca în sumar sau în fișa de lucru, și pe pagina din piață.
- **Propunere:** pe pagina din piață, același filtru ca în fișa de lucru (`attachments` nereferite de camere) și randarea lor cu `AttachmentThumb`.

### CS-04 · P1 · defect · Ce scrii la „Date generale” se pierde la „Înapoi”, la reîncărcare și la schimbarea limbii
- **Unde:** `components/configurator/details-step.tsx:173-176` (valorile ajung în store doar la `handleSubmit`); butonul „Înapoi” :399 (`onClick={onBack}` → `setPhase('uploads')`, fără `setDetails`).
- **Ce se întâmplă:** formularul React Hook Form ține descrierea, adresa, județul / orașul, contactele, termenul și bugetul doar în memorie până la „Continuă la sumar”. „Înapoi”, o reîncărcare, schimbarea limbii (remontare) sau închiderea tabului le pierd. Între timp, antetul arată „Salvat la HH:MM” (`DraftStatus`, wizard :185-215), pentru că sincronizarea ciornei trimite starea store-ului, care nu conține ce s-a tastat.
- **Ce ar trebui:** salvare la fiecare modificare (sau cel puțin la „Înapoi” și la `blur`), ca la întrebările camerelor.
- **Propunere:** `watch` + `setDetails` cu debounce, sau `setDetails(getValues())` în `onBack`. De verificat live: schimbarea limbii pe pasul Date generale.

### CS-05 · P1 · defect · Erorile de încărcare a fișierelor nu se văd deloc
- **Unde:** `components/configurator/uploads-step.tsx:36-38, 101` (`upload.mutate` per fișier, se afișează doar `isPending`); `room-sketch-upload.tsx:71-77` (comentariul spune „eroarea e reflectată de upload.isError”, dar `isError` nu e randat nicăieri); `components/ui/dropzone.tsx:47` (`onDrop` nu filtrează tipul sau mărimea).
- **Ce se întâmplă:** un fișier prea mare (> 25 MB), de tip nepermis (ex. `.dwg` / `.heic` trase cu drag & drop, unde `accept` nu se aplică) sau peste limită primește de la server `FILE_TOO_LARGE` / `FILE_TYPE_NOT_ALLOWED` / `FILE_LIMIT_REACHED` (`uploads.service.ts:91-101`). Clientul vede „Se încarcă…”, apoi nimic: fișierul pur și simplu nu apare. În modul „Am deja un proiect”, butonul Continuă rămâne blocat cu mesajul generic „Încarcă cel puțin un fișier…” (`ro.json:3694`), fără să afle de ce n-a mers. Pe pasul general nu există nici plafon calculat în interfață (camera îl are: `room-sketch-upload.tsx:46-48`).
- **Ce ar trebui:** un mesaj per fișier respins (nume + motiv), validare pe client a tipului și mărimii înainte de presign și afișarea locurilor rămase.
- **Propunere:** `onError` → listă de erori sub dropzone, mapate pe `Requests.apiErrors`. Validare `ALLOWED_ATTACHMENT_MIME` / `MAX_ATTACHMENT_BYTES` în `Dropzone`.

### CS-06 · P2 · inconsecvență · „Am proiect” e și mod de pornire, și bifă în coș: două surse de adevăr
- **Unde:** `configurator-wizard.tsx:456-462` (modul setează `hasOwnProject`); `room-cart-step.tsx:286-308` (bifa „Am deja un proiect pentru toată locuința” schimbă tot `hasOwnProject`, dar nu și `startMode`); `uploads-step.tsx:68-80` (singurul loc care le sincronizează).
- **Ce se întâmplă:** în modul „Știu ce vreau” poți bifa în coș „am proiect”: `hasOwnProject = true`, dar `startMode = STANDARD`. În modul „Am deja un proiect” poți debifa: `hasOwnProject = false`, dar cartonașul de la Pornire rămâne „Am deja un proiect”. În plus, alegerea `OWN_PROJECT` nu resetează `includesPaidDesign` (:458). Dacă alegi întâi „Am nevoie de ajutor” și apoi „Am deja un proiect”, cererea pleacă cu „Proiectare cu plată” bifată fără să fi ales-o (bifa e vizibilă la Date generale, dar e precompletată).
- **Ce ar trebui:** o singură decizie, luată la Pornire. În coș doar un rezumat cu „schimbă”.
- **Propunere:** scoate bifa din coș (sau leag-o de `setStartMode`). `OWN_PROJECT` să seteze `includesPaidDesign: false` ca `STANDARD`.

### CS-07 · P2 · defect · Trecerea de pe „Știu ce vreau” pe „Am nevoie de ajutor” publică răspunsuri parțiale, apoi blochează editarea
- **Unde:** `review-step.tsx:155` (cu `designHelp` nu se validează camerele) și :225-232 (răspunsurile se trimit oricum); `apps/backend/src/modules/requests/configurator.service.ts:38-40, 71` (`designBrief` = `includesPaidDesign` → validare `partial`); `configurator-wizard.tsx:79-85` (la editare, modul se deduce: `includesPaidDesign && !hasAnswers` → DESIGN_HELP, altfel STANDARD).
- **Ce se întâmplă:** cine a răspuns la jumătate din întrebări și apoi alege „Am nevoie de ajutor” publică camere pe jumătate completate (serverul le acceptă ca brief). Firma vede răspunsuri trunchiate. La editare, cererea are răspunsuri, deci se deschide ca STANDARD. Validarea locală (`roomIssue`) cere atunci toate întrebările, iar „Salvează modificările” rămâne dezactivat până le completezi pe toate.
- **Ce ar trebui:** la alegerea DESIGN_HELP, fie golești răspunsurile (cu avertisment), fie păstrezi modul în cerere (câmp explicit), nu îl deduci.
- **Propunere:** persistă `startMode` pe cerere sau curăță `answers` la DESIGN_HELP. De verificat live.

### CS-08 · P2 · defect · Adresa aleasă din sugestii pierde blocul, scara și apartamentul
- **Unde:** `components/configurator/address-autocomplete.tsx:54-56, 111-113`.
- **Ce se întâmplă:** la alegerea unei sugestii Google, `addressText` devine doar „stradă + număr” (`route + street_number`). Ce tastase clientul în plus (bl., sc., ap.) dispare din valoarea salvată, deși inputul afișează textul Google. Sumarul și fișa de lucru a firmei arată adresa fără apartament. Doar o nouă tastare în câmp (`onText`) readuce textul complet.
- **Ce ar trebui:** fie păstrezi textul tastat, fie oferi un câmp separat „Bloc / scară / apartament (opțional)”.
- **Propunere:** câmp separat de detalii, concatenat la `addressText`. Geocodarea curăță deja aceste fragmente (`geo.service.ts:62`).

### CS-09 · P2 · defect · Ciornele anonime abandonate (cu fișierele lor) nu se șterg niciodată
- **Unde:** `requests.service.ts:173-201` (`createDraft`); se șterge doar la „Începe o cerere nouă” (:211-225). Am căutat un job de curățare pentru `status: 'DRAFT'` în `apps/backend/src`: nu există.
- **Ce se întâmplă:** fiecare vizită pe `/requests/new` fără token în `localStorage` (alt browser, mod privat, roboți) creează un rând `DRAFT`. Pozele / planurile încărcate pe el (pot conține date personale, iar PDF / ZIP nu sunt curățate de metadate) rămân în storage pe termen nelimitat. Ruta `POST /requests/drafts` nu are `@Throttle` dedicat (controller :46-47).
- **Ce ar trebui:** o regulă de retenție (ex. ciorne neatinse de 30 de zile → ștergere + fișiere) și limitare pe IP.
- **Propunere:** job BullMQ zilnic. Notă în politica GDPR (docs/03 §4.21). DECIZIE NECESARA PO: durata de retenție.

### CS-10 · P2 · defect · Clientul nu își vede în pagina cererii contactele, suma bugetului și opțiunile de proiect
- **Unde:** `apps/frontend/src/app/[locale]/requests/[id]/page.tsx:173-192` (fișa arată doar treapta de buget, termenul, adresa și data de expirare).
- **Ce se întâmplă:** după publicare, clientul nu mai vede canalele de contact transmise firmelor, suma aleasă pe slider (vede „Peste 15.000 RON” în loc de „33.000 lei”, deși firma vede suma exactă: `claims/[claimSlotId]/page.tsx:535-537`), „Proiectare cu plată” și „Proiect propriu”. Sumarul de dinainte de publicare le arăta (`review-facts-card.tsx:47-64`).
- **Ce ar trebui:** aceleași rânduri ca în sumar.
- **Propunere:** reutilizează `ReviewFactsCard` (read-only) pe pagina cererii.

### CS-11 · P2 · inconsecvență · Oferta nu spune dacă prețul conține TVA; tabelul de comparare amestecă monedele
- **Unde:** `packages/shared/src/quote.schemas.ts:27-37` (price fără informație TVA); `ro.json:1739` („Preț”), :1751 (TVA doar ca sugestie în descriere); `_components/offers-comparison.tsx:129-137, 211` (cel mai mic total e calculat în RON, dar celula afișează `v.total` în moneda ofertei); `docs/03-business-rules.md:169` (clientul vede AMBELE valori).
- **Ce se întâmplă:** firma A poate trimite 13.900 lei cu TVA, firma B 11.450 lei fără TVA. Tabelul le pune una lângă alta și o marchează pe B „cel mai mic”. O ofertă în EUR apare ca „2.700 EUR” lângă „13.900 RON”, fără echivalent (cardul ofertei îl are: `offer-card.tsx:174, 223`). Abonamentele, în schimb, spun explicit „lei + TVA” (`ro.json:1449`).
- **Ce ar trebui:** câmp structurat „Prețul include TVA: da / nu” (sau convenția „cu TVA” impusă), plus echivalentul în RON în tabel.
- **Propunere:** câmp `vatIncluded` în ofertă, rând „TVA” în tabel, `≈ X lei` sub totalurile în EUR.

### CS-12 · P2 · inconsecvență · Pagina de start promite un tabel pe care oferta reală nu îl poate umple la fel
- **Unde:** `app/[locale]/page.tsx:63-65` + `ro.json:19-26` (Preț / Termen „6 săpt.” / Garanție „24 luni”, „cel mai rapid”, „Ofertele reale apar în contul tău, în același tabel”); `offers-comparison.tsx:139-155, 249-251` + `ro.json:1846-1849` („Total”, termen text liber + dată opțională, garanție text liber, rând în plus „Valabilitate”); `quote.schemas.ts:30-36` (termen și garanție opționale, text liber).
- **Ce se întâmplă:** rubricile au alte nume (Preț vs Total). Termenul și garanția sunt opționale și libere, deci pot lipsi (apare „—”). „Cel mai rapid” apare doar dacă toate ofertele au dată de livrare. Promisiunea „același tabel” nu se ține.
- **Ce ar trebui:** termen și garanție obligatorii și structurate (număr + unitate: săptămâni / luni), etichete identice.
- **Propunere:** în formularul ofertei, numerele structurate există deja în builder (`ro.json:1753-1764`, unități). Trimite-le structurat, nu concatenat în text, și fă-le obligatorii.

### CS-13 · P2 · defect · Chatul nu afișează nicio eroare
- **Unde:** `_components/chat-panel.tsx:77-90` (`mutateAsync` fără `try/catch`, fără mesaj), :171-178 (fără `maxLength`), :180-186 (input de fișier fără `accept`); `packages/shared/src/chat.schemas.ts:11` (max 5000).
- **Ce se întâmplă:** un mesaj peste 5.000 de caractere, o conversație trecută între timp pe doar-citire (`THREAD_READ_ONLY`, `chat.service.ts:233-237`) sau un fișier respins duc la o promisiune respinsă netratată. Textul rămâne în câmp, mesajul nu pleacă și nu se întâmplă nimic vizibil.
- **Ce ar trebui:** mesaj de eroare sub câmp, contor de caractere, `accept` pe input.
- **Propunere:** `send.error` / `upload.error` → `Alert` mapat pe cod.

### CS-14 · P2 · text · Erori de preluare cu mesaj greșit sau generic
- **Unde:** `claims.service.ts:108-113` (EMPLOYEE_MANAGED → `FORBIDDEN`) vs `ro.json:1509` (`Marketplace.apiErrors.FORBIDDEN` = „Doar proprietarul sau un manager poate **atribui** preluarea.”); `claims.service.ts:443` (`MANAGER_UNASSIGNED_CAP_REACHED`), cheie absentă în `ro.json`, deci afișează „A apărut o eroare. Încearcă din nou.” (`marketplace/[id]/page.tsx:179-183`); `ClaimPanel` (:162-252) arată butonul de preluare și angajaților EMPLOYEE_MANAGED.
- **Ce ar trebui:** butonul ascuns sau dezactivat pentru EMPLOYEE_MANAGED, cu explicația „Preluarea o face proprietarul, un manager sau un angajat cu acces complet”. Mesaj dedicat pentru plafonul managerului.
- **Propunere:** coduri de eroare distincte (ex. `CLAIM_ROLE_NOT_ALLOWED`) și cheile lipsă în `ro.json` / `en.json`.

### CS-15 · P2 · UX · Clientul neautentificat, după verificarea e-mailului, nu e dus înapoi la cerere
- **Unde:** `review-step.tsx:483` (`/login?redirect=/requests/new`); register păstrează `redirect` (`(auth)/register/page.tsx:42-44`), dar `verify-email/page.tsx:33, 50` trimite la `/login` fără `redirect`.
- **Ce se întâmplă:** contul nou se confirmă din e-mail. Linkul deschide pagina de verificare, de acolo login, iar după login clientul ajunge în tabloul de bord, nu la cererea completată. Ciorna există doar în `localStorage`-ul browserului inițial: dacă e-mailul e deschis pe telefon, clientul nu mai găsește cererea. Promisiunea „răspunsurile rămân salvate” (`ro.json:3731`) e adevărată doar în același browser.
- **Ce ar trebui:** redirect păstrat prin linkul de verificare. Dacă e posibil, ciorna legată de e-mailul contului nou (sau link de reluare trimis pe e-mail).
- **Propunere:** `redirect` inclus în URL-ul de verificare. Notificare „Ai o cerere neterminată” în tabloul de bord. De verificat live.

### CS-16 · P2 · text · Sesiunea expirată la publicare dă „eroare neașteptată”
- **Unde:** `requests.service.ts:271-276` (`UNAUTHORIZED`); `review-step.tsx:377-381` caută cheia în `Configurator.apiErrors` / `Requests.apiErrors`, iar `UNAUTHORIZED` nu e în niciuna (`ro.json:1243-1256, 3974-3984`), deci afișează „A apărut o eroare neașteptată”.
- **Propunere:** mesaj „Sesiunea a expirat — intră din nou în cont; cererea rămâne salvată” + buton de login cu `redirect`.

### CS-17 · P3 · text · Mesaje de eroare inexacte
- `Requests.apiErrors.FILE_LIMIT_REACHED` = „Ai atins limita de 10 atașamente” (`ro.json:1251`). Limita reală e 10 + 8 × numărul de camere (`request.schemas.ts:298-307`).
- `Configurator.apiErrors.REQUEST_CONTACT_INFO_IN_TEXT` trimite la „pasul Contact” (`ro.json:3983`), dar nu există un pas cu acest nume (pașii sunt Pornire / Camere / Detalii camere / Fișiere / Date generale / Sumar, `ro.json:3520-3526`). Contactele sunt la „Date generale” → „Preferințe de contact”.
- `budgetEstimateHint`: „Alege intervalul cu care te simți confortabil” (`ro.json:1158`), dar controlul alege o singură valoare (`budget-slider.tsx:57-66`).
- `publishNote` (`ro.json:3744`): „o singură dată după aceea”. Regula (docs/03 §4.3) e „o dată după preluare, **înainte de prima ofertă**”.

### CS-18 · P2 · UX · Bugetul: precompletat „Sub 5.000 RON” când nu există estimare; minimul glisorului nu poate coborî sub estimare
- **Unde:** `details-step.tsx:94` (implicit `UNDER_5K`), :81 (estimarea doar din camere `completed`. În modul „Am nevoie de ajutor” camerele nu sunt niciodată completate, deci nu există estimare); `budget-slider.tsx:57-62` (`min = estimate.minRon`).
- **Ce se întâmplă:** în DESIGN_HELP (și când estimarea pică), clientul primește precompletat „Sub 5.000 RON” și îl poate publica fără să-l fi ales. Cu estimare, nu poate declara un buget mai mic decât estimarea sistemului: dacă bugetul lui real e mai mic, singura ieșire e „Prefer să nu spun”.
- **Propunere:** fără valoare implicită (alegere obligatorie sau „Nu știu”). Text care explică de ce minimul e fixat.

### CS-19 · P3 · inconsecvență · Sumarul repetă aceeași informație pe două rânduri
- **Unde:** `review-facts-card.tsx:62-64`: „Include proiectare cu plată: Da” și „Ajutor pentru planificarea mobilierului: Da” apar împreună în DESIGN_HELP (același lucru). „Am proiectul propriu: Nu” apare și când e irelevant.
- **Propunere:** un singur rând „Cum pornești” cu titlul cartonașului ales.

### CS-20 · P2 · text · Vocabular amestecat pentru aceleași lucruri

| Concept | Variante găsite (ro.json) |
|---|---|
| cererea | „Comandă nouă” = kicker-ul formularului de cerere (`3499`) vs „Cerere nouă” (`1086`); „comandă” și pentru livrare (`2063-2064`) și pentru plățile firmei (`2159+`) |
| proiectare plătită | „Proiectare cu plată inclusă” (`1091`, `1389`), „Include proiectare cu plată” (`1135`), „Proiectare plătită” (`3559`, `3728`), „Ajutor pentru planificarea mobilierului” (`3713`), „Tarif de proiectare” (`1741`), „Proiectare” (`2099`); docs: „Proiectare contra cost” |
| proiect propriu | „Am deja un proiect” (`3550`), „Am deja un proiect pentru toată locuința” (`3571`), „Am proiectul propriu” (`1136`), „Proiect propriu” (`1390`) |
| mesajul clientului | „Mesaj pentru firme” (formular `1143`), „Detaliile proiectului” (sumar `3714`), „Mesajul clientului” (fișa firmei `1643`), „Descriere” (`1132`) |
| locul | „Adresă” (`1137`), „Locul montajului” (`3711`), „Loc” (piață `1568`) |
| monedă | „Sub 5.000 RON” (`1153-1155`) vs „33.000 lei” pe glisor (`budget-slider.tsx:16`) |
| mărimea | „Dimensiune” (`1115`) vs „Mărime” (`1378`) |
| ultimul pas | „Sumar” (bara de faze `3526`) vs titlul „Verifică și publică” (`3722`) |
| jargon pentru client | „trimiți cererea în marketplace” (`3723`, `3731`) |

Pentru „firmă / atelier” nu am găsit „atelier” în textele vizibile din felia mea (doar în comentarii de cod, ex. `configurator-wizard.tsx:55`).
- **Propunere:** glosar unic. Recomand: „cerere” (niciodată „comandă” înainte de acceptare), „Proiectare cu plată”, „Am deja un proiect”, „lei”, „Mesaj pentru firme” peste tot.

### CS-21 · P3 · UX · Costul preluării poate fi foarte mare fără plafon
- **Unde:** `request.schemas.ts:35-80` (1 credit = 1.000 lei din bugetul minim, `max: null` implicit). docs/03 §4.5 / §4.8: DECIZIE NECESARA (plafonul 3..25 propus, neaprobat).
- **Ce se întâmplă:** o cerere cu bucătărie + 3 camere poate costa zeci de credite. Panoul de preluare arată costul, dar nu de unde vine.
- **Propunere:** linie „Cost calculat din bugetul minim estimat (X lei)” în panoul de preluare. Decizia PO pe plafon rămâne deschisă.

### CS-22 · P3 · idee · Firma decide preluarea doar pe treapta de buget
- **Unde:** `marketplace/[id]/page.tsx:100` (doar `budget.${budgetRange}`). După preluare vede suma exactă (`claims/[claimSlotId]/page.tsx:535`).
- **Propunere:** suma (sau intervalul ales) și înainte de preluare: nu e dată de contact și ajută decizia plătită în credite.

## 3. Tabel de consecvență — același câmp în ecrane diferite

| Câmp | Formular (Date generale) | Sumar | Detaliu client | Piață (pre-preluare) | Fișa de lucru (firmă) |
|---|---|---|---|---|---|
| Buget | glisor în lei sau trepte RON | treaptă + „Bugetul tău estimat: X” | doar treapta | doar treapta | suma exactă în lei |
| Termen dorit | carduri, opțional | „Termenul dorit” / „Necompletat” | „Termen dorit” (ascuns dacă lipsește) | „Termen dorit” / „Nu știu încă” | „Termen dorit: …” |
| Adresă | țară + adresă + județ + oraș | „Locul montajului” | „Adresă” | „Loc” (oraș, județ, distanță) | adresa completă |
| Contacte | rând blocat cu e-mailul contului + max 4 | „Canale de contact” | **lipsesc** | ascunse (corect) | cardul „Clientul tău” |
| Proiectare cu plată | bifă / banner | 2 rânduri redundante | **lipsește** | insignă | de verificat |
| Proiect propriu | cartonaș + bifă în coș | „Am proiectul propriu” | **lipsește** | insignă „Proiect propriu” | de verificat |
| Fișiere de proiect | pas Fișiere | „Fișierele proiectului” | „Atașamente” (toate) | **lipsesc** (CS-03) | „Fișierele cererii” |
| Mesaj | „Mesaj pentru firme” | „Detaliile proiectului” | citat fără etichetă | citat fără etichetă | „Mesajul clientului” |

## 4. Top 10 de schimbat (după impact)

1. **CS-03** — afișează fișierele de proiect în piață, înainte de preluare (firma plătește credite pe nevăzute; clientului i se promite opusul).
2. **CS-02** — doar clienții pot publica; firma logată primește un mesaj clar.
3. **CS-01** — store separat pentru editare, ca să nu mai fie suprascrisă ciorna nouă.
4. **CS-04** — salvare continuă la „Date generale”.
5. **CS-05** — mesaje de eroare la încărcarea fișierelor + validare pe client.
6. **CS-11 / CS-12** — TVA structurat, termen / garanție structurate și obligatorii, echivalent RON; rubrici identice cu pagina de start.
7. **CS-06 / CS-07** — o singură sursă pentru modul de pornire, persistată pe cerere.
8. **CS-10** — pagina cererii arată contactele, suma bugetului și opțiunile de proiect.
9. **CS-09** — retenție pentru ciornele anonime + limitare pe IP.
10. **CS-13 / CS-14 / CS-16 / CS-17 / CS-20** — erori afișate în chat, mesaje corecte la preluare și publicare, glosar unic.
